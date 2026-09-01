const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { put, list } = require('@vercel/blob');

let db = null;
let SQL = null;
let DB_FILE = null;
let pauseBackup = false; // Guards against blob uploads during DB initialisation

/**
 * Fetches a URL with up to `retries` attempts (default 2), waiting `delayMs` between each.
 * Needed because Vercel private blob downloadUrls are pre-signed and can transiently 403.
 */
async function fetchWithRetry(url, retries = 2, delayMs = 500) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const headers = {};
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        headers['Authorization'] = `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`;
      }
      const finalUrl = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
      const res = await fetch(finalUrl, { headers });
      if (res.ok) return res;
      lastErr = new Error(`HTTP ${res.status} from blob URL`);
    } catch (e) {
      lastErr = e;
    }
    if (i < retries) await new Promise(r => setTimeout(r, delayMs));
  }
  throw lastErr;
}

// Initialize sql.js and create in-memory/tmp database
async function getDb() {
  if (db) return db;

  if (!DB_FILE) {
    if (process.env.VERCEL || process.env.NOW_REGION) {
      // Vercel serverless apps can only write to /tmp
      DB_FILE = path.join(os.tmpdir(), 'cms_vercel.sqlite');
    } else {
      // Local development or VM deployment uses permanent db file
      DB_FILE = path.join(__dirname, '..', 'cms.db');
    }
  }

  if (!SQL) {
    // Use the ASM.js build (pure JavaScript, no WASM file needed)
    const initSqlJs = require('sql.js/dist/sql-asm.js');
    SQL = await initSqlJs();
  }

  // ── IMPORTANT: Do NOT restore cms_vercel.sqlite from Vercel Blob on serverless workers.
  // The SQLite binary blob grows large over time (base64 attachments etc.) and loading it
  // into sql.js (WASM) triggers an Aborted(OOM) that is unrecoverable — it bypasses all
  // JS try/catch and crashes the entire worker process.
  // Complaint data is already persisted via cms_complaints.json (JSON blob) which does NOT
  // go through sql.js at all. Auth data (users) is re-seeded by initDatabase() on each
  // cold start, so workers are fully functional without the SQLite blob restore.
  console.log('[Persistence] SQLite blob restore DISABLED on Vercel to prevent OOM. Using cms_complaints.json as authoritative store.');
  // (no blob restore — start with a fresh in-memory db every cold start)

  // Load from /tmp only if the file is small enough to not OOM the WASM runtime.
  // sql.js allocates a heap proportional to the DB file size; files >20 MB reliably OOM
  // Vercel's 1792 MB serverless function. Treat large files as stale/corrupt and start fresh.
  const MAX_SAFE_SQLITE_BYTES = 20 * 1024 * 1024; // 20 MB
  try {
    if (fs.existsSync(DB_FILE)) {
      const stat = fs.statSync(DB_FILE);
      if (stat.size > MAX_SAFE_SQLITE_BYTES) {
        console.warn(`[Persistence] /tmp SQLite file is ${Math.round(stat.size / 1024 / 1024)} MB — too large for sql.js WASM heap. Deleting and starting fresh to prevent OOM.`);
        try { fs.unlinkSync(DB_FILE); } catch (_) { }
      } else {
        try {
          const fileBuffer = fs.readFileSync(DB_FILE);
          db = new SQL.Database(fileBuffer);
          console.log('Loaded database from ' + DB_FILE + ' (' + Math.round(stat.size / 1024) + ' KB)');
          return db;
        } catch (e) {
          console.error('Failed to load existing tmp DB, starting fresh.', e.message);
          try { fs.unlinkSync(DB_FILE); } catch (_) { }
        }
      }
    }
  } catch (e) {
    console.error('[Persistence] Error checking /tmp DB file:', e.message);
  }

  db = new SQL.Database();
  return db;
}

// Run query (INSERT, UPDATE, DELETE, CREATE)
async function run(sql, params = []) {
  const database = await getDb();
  try {
    database.run(sql, params);
    const result = database.exec("SELECT last_insert_rowid() as id, changes() as changes");
    const id = result.length > 0 ? result[0].values[0][0] : 0;
    const changes = result.length > 0 ? result[0].values[0][1] : 0;

    // Write in-memory DB state to local /tmp so this worker reuses it within its lifetime.
    // We do NOT upload cms_vercel.sqlite to Blob on every write — the file balloons with
    // base64 attachments and causes sql.js OOM on cold-start restore.
    // cms_complaints.json (written by syncComplaintToBlob) is the authoritative cross-worker
    // persistence path and does not go through sql.js at all.
    if (!pauseBackup && DB_FILE && (sql.trim().toUpperCase().startsWith('INSERT') || sql.trim().toUpperCase().startsWith('UPDATE') || sql.trim().toUpperCase().startsWith('DELETE') || sql.trim().toUpperCase().startsWith('CREATE') || sql.trim().toUpperCase().startsWith('ALTER'))) {
      try {
        const buffer = Buffer.from(database.export());
        fs.writeFileSync(DB_FILE, buffer);
      } catch (err) {
        console.warn('Could not write DB to /tmp:', err.message);
      }
    }

    return { id, changes };
  } catch (err) {
    throw err;
  }
}

// Known valid columns in the complaints table — used to filter blob JSON before re-inserting
const COMPLAINT_COLUMNS = new Set([
  'id', 'user_id', 'title', 'category', 'court_name', 'court_address', 'court_jurisdiction',
  'case_number', 'plaintiff_name', 'defendant_name', 'parties', 'hearing_date',
  'description', 'priority', 'status', 'assignment_status', 'assigned_judge',
  'attachment_path', 'legal_representation',
  'complainant_phone', 'complainant_country', 'complainant_region', 'complainant_woreda',
  'complainant_kebele', 'complainant_language', 'complainant_national_id',
  'respondent_phone', 'respondent_email', 'respondent_country', 'respondent_region',
  'respondent_woreda', 'respondent_kebele', 'respondent_language', 'respondent_national_id',
  'clerk_language', 'judge_language',
  'court_fee_required', 'court_fee_amount', 'court_fee_paid', 'court_fee_receipt', 'respondent_fee_receipt',
  'is_served', 'created_at', 'updated_at'
]);

// Start at -Infinity so the very first request on a fresh worker ALWAYS reads from Blob.
// This is critical: each Vercel worker has its own module scope and its own in-memory DB.
// Without an immediate first-read, a new worker will never learn about complaints filed
// on a different worker.
let lastRehydrateTime = -Infinity;
async function ensureComplaintsRehydrated(database) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  const now = Date.now();
  if (now - lastRehydrateTime < 5000) return; // 5-second throttle per-worker after the first read
  lastRehydrateTime = now;

  try {
    const blobComplaints = await _readComplaintsBlob();
    if (!blobComplaints || !Array.isArray(blobComplaints) || blobComplaints.length === 0) return;

    for (const c of blobComplaints) {
      if (!c || !c.id) continue;
      try {
        const res = database.exec(`SELECT id FROM complaints WHERE id = ${Number(c.id)}`);
        const exists = res.length > 0 && res[0].values.length > 0;

        if (!exists) {
          // Only insert columns that actually exist in the complaints table
          const validKeys = Object.keys(c).filter(k => COMPLAINT_COLUMNS.has(k));
          if (validKeys.length > 0) {
            const placeholders = validKeys.map(() => '?').join(', ');
            const values = validKeys.map(k => c[k]);

            try {
              database.run(
                `INSERT INTO complaints (${validKeys.join(', ')}) VALUES (${placeholders})`,
                values
              );
              console.log(`[Rehydrate] Inserted missing complaint #${c.id} into SQLite memory`);
            } catch (insertErr) {
              console.warn(`[Rehydrate] Failed to insert complaint #${c.id}: ${insertErr.message}`);
              // Last-resort fallback with absolute minimum fields
              try {
                database.run(
                  `INSERT INTO complaints (id, user_id, title, category, description, priority, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                  [c.id, c.user_id || 1, c.title || 'Unknown', c.category || 'Other', c.description || '', c.priority || 'Medium', c.status || 'Filed']
                );
                console.log(`[Rehydrate] Inserted complaint #${c.id} with minimal fallback`);
              } catch (fallbackErr) {
                console.warn(`[Rehydrate] Fallback also failed for #${c.id}: ${fallbackErr.message}`);
              }
            }
          }
        }
      } catch (innerErr) {
        console.warn(`[Rehydrate] Skipped corrupted item #${c.id}: ${innerErr.message}`);
      }
    }
  } catch (e) {
    console.warn('[Rehydrate] Overall Warning:', e.message);
  }
}

// Get single row
async function get(sql, params = []) {
  const database = await getDb();
  if (sql.includes('complaints')) {
    await ensureComplaintsRehydrated(database);
  }
  const stmt = database.prepare(sql);
  stmt.bind(params);
  let row = null;
  if (stmt.step()) {
    const columns = stmt.getColumnNames();
    const values = stmt.get();
    row = {};
    columns.forEach((col, i) => {
      row[col] = values[i];
    });
  }
  stmt.free();
  return row;
}

// Get all rows
async function all(sql, params = []) {
  const database = await getDb();
  if (sql.includes('complaints')) {
    await ensureComplaintsRehydrated(database);
  }
  const stmt = database.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    const columns = stmt.getColumnNames();
    const values = stmt.get();
    const row = {};
    columns.forEach((col, i) => {
      row[col] = values[i];
    });
    rows.push(row);
  }
  stmt.free();
  return rows;
}

// Manually trigger a backup to Vercel Blob
async function forceBackup() {
  const database = await getDb();
  if (DB_FILE) {
    try {
      const buffer = Buffer.from(database.export());
      fs.writeFileSync(DB_FILE, buffer);
      // NOTE: We intentionally do NOT upload cms_vercel.sqlite to Vercel Blob.
      // Uploading a large SQLite binary causes Aborted(OOM) crashes in sql.js WASM
      // on cold-start restore. Complaint persistence flows through cms_complaints.json;
      // auth data is re-seeded by initDatabase() on each cold start.
      // The /tmp write above keeps the DB alive within the same Vercel worker lifetime.
      console.log('[Persistence] DB written to /tmp (Vercel Blob upload disabled to prevent OOM).');
    } catch (err) {
      console.warn('Could not write DB to /tmp:', err.message);
    }
  }
}

// ─────────────────────────────────────────────────────────
//  PERMANENT FILED-COMPLAINT COUNTER
//  Stored as a tiny JSON blob (cms_stats.json) — completely
//  independent of the SQLite blob. Survives cold starts even
//  when the full DB restore fails.
// ─────────────────────────────────────────────────────────
const STATS_BLOB_KEY = 'cms_stats.json';

async function _readStatsBlob() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const { list: blobList } = require('@vercel/blob');
    let blobInfo;
    try {
      const { blobs } = await blobList({ prefix: STATS_BLOB_KEY, limit: 10 });
      // Exact name match to prevent picking random-suffix duplicates
      blobInfo = blobs.find(b => b.pathname === STATS_BLOB_KEY) || null;
    } catch (e) {
      const msg = (e.message || '').toLowerCase();
      if (msg.includes('not found') || msg.includes('does not exist') || msg.includes('blob does not exist') || e.status === 404) return null;
      throw e;
    }
    if (!blobInfo) return null;
    const fetchRes = await fetchWithRetry(blobInfo.downloadUrl);
    return await fetchRes.json();
  } catch (e) {
    console.warn('[Stats] Could not read cms_stats.json:', e.message);
    return null;
  }
}

async function _writeStatsBlob(data) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    const json = JSON.stringify(data);
    await put(STATS_BLOB_KEY, json, { access: 'private', addRandomSuffix: false, contentType: 'application/json', cacheControlMaxAge: 0 });
  } catch (e) {
    console.warn('[Stats] Could not write cms_stats.json:', e.message);
  }
}

// Returns the permanent "ever filed" count.
// Tier 1: cms_stats.json blob (fastest, survives cold starts).
// Tier 2: bootstrap from cms_complaints.json blob (all complaints ever synced).
//         When bootstrapped, the count is written back to cms_stats.json for future calls.
// Tier 3: SQLite filed_complaints_log table (local dev fallback).
async function getFiledCount() {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    // Tier 1 — dedicated stats blob
    const stats = await _readStatsBlob();
    if (stats && typeof stats.totalFiled === 'number' && stats.totalFiled > 0) {
      return stats.totalFiled;
    }

    // Tier 2 — bootstrap from the complaints backup blob.
    // cms_complaints.json contains every complaint ever synced (including soft-deleted ones)
    // so its length equals the true total-ever-filed count.
    try {
      const complaints = await _readComplaintsBlob();
      if (complaints && complaints.length > 0) {
        const count = complaints.length; // ALL entries — never filtered by status
        console.log(`[Stats] Bootstrapping totalFiled=${count} from cms_complaints.json`);
        // Persist so future calls hit Tier 1 directly
        await _writeStatsBlob({ totalFiled: count, bootstrappedAt: new Date().toISOString() });
        return count;
      }
    } catch (bootstrapErr) {
      console.warn('[Stats] Bootstrap from cms_complaints.json failed:', bootstrapErr.message);
    }
  }

  // Tier 3 — local SQLite ledger (works when BLOB_READ_WRITE_TOKEN is absent)
  try {
    const row = await get('SELECT COUNT(*) as val FROM filed_complaints_log');
    return row ? (row.val || 0) : 0;
  } catch (e) {
    return 0;
  }
}

// Atomically increments the permanent filed count by 1.
// Called every time a new complaint is successfully created.
async function incrementFiledCount() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return; // local: SQLite ledger is enough
  try {
    let current = await _readStatsBlob();
    if (!current || typeof current.totalFiled !== 'number' || current.totalFiled === 0) {
      // Bootstrap from cms_complaints.json to avoid starting from 0 when stats blob is new
      try {
        const existing = await _readComplaintsBlob();
        const baseCount = (existing && existing.length > 0) ? existing.length : 0;
        current = { totalFiled: baseCount };
        console.log(`[Stats] Bootstrapped base count to ${baseCount} from cms_complaints.json`);
      } catch (_) {
        current = { totalFiled: 0 };
      }
    }
    const next = { ...current, totalFiled: (current.totalFiled || 0) + 1, updatedAt: new Date().toISOString() };
    await _writeStatsBlob(next);
    console.log('[Stats] totalFiled incremented to', next.totalFiled);
  } catch (e) {
    console.warn('[Stats] Could not increment totalFiled:', e.message);
  }
}

// ─────────────────────────────────────────────────────────
//  PERMANENT COMPLAINTS BACKUP BLOB (cms_complaints.json)
// ─────────────────────────────────────────────────────────
const COMPLAINTS_BLOB_KEY = 'cms_complaints.json';

async function _readComplaintsBlob() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return [];
  try {
    const { list: blobList } = require('@vercel/blob');
    let blobInfo;
    try {
      const { blobs } = await blobList({ prefix: COMPLAINTS_BLOB_KEY, limit: 10 });
      // Exact name match to prevent picking random-suffix duplicates
      blobInfo = blobs.find(b => b.pathname === COMPLAINTS_BLOB_KEY) || null;
    } catch (e) {
      const msg = (e.message || '').toLowerCase();
      if (msg.includes('not found') || msg.includes('does not exist') || msg.includes('blob does not exist') || e.status === 404) return [];
      throw e; // Important: do not swallow real errors
    }
    if (!blobInfo) return [];
    const fetchRes = await fetchWithRetry(blobInfo.downloadUrl);
    const data = await fetchRes.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('[Blob] Could not read cms_complaints.json:', e.message);
    throw new Error('read_failure'); // Propagate to prevent wiping json
  }
}

async function _writeComplaintsBlob(complaintsList) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    const json = JSON.stringify(complaintsList);
    await put(COMPLAINTS_BLOB_KEY, json, { access: 'private', addRandomSuffix: false, contentType: 'application/json', cacheControlMaxAge: 0 });
    console.log('[Blob] cms_complaints.json updated with', complaintsList.length, 'complaints.');
  } catch (e) {
    console.warn('[Blob] Could not write cms_complaints.json:', e.message);
  }
}

async function syncComplaintToBlob(complaintObj) {
  if (!process.env.BLOB_READ_WRITE_TOKEN || !complaintObj || !complaintObj.id) return;

  // Strip large base64 fields before writing to the shared JSON blob.
  // attachment_path and court_fee_receipt are data URIs that can be megabytes each.
  // Keeping them in cms_complaints.json causes the blob to grow until _readComplaintsBlob
  // fails (fetch timeout / OOM), which makes every complaint list appear empty.
  // The /complaints/:id/attachment endpoint reads attachment_path directly from SQLite and
  // is NOT affected by this strip.
  const { attachment_path, court_fee_receipt, complainant_national_id, respondent_national_id, ...safeComplaint } = complaintObj;

  // Retry up to 3 times — Vercel Blob writes can transiently fail
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const list = await _readComplaintsBlob();
      const idx = list.findIndex(c => String(c.id) === String(safeComplaint.id));
      if (idx >= 0) {
        // Preserve stripped fields from existing entry so they are not wiped on status updates
        list[idx] = { ...list[idx], ...safeComplaint, updatedAt: new Date().toISOString() };
      } else {
        list.push({ ...safeComplaint, createdAt: safeComplaint.created_at || new Date().toISOString() });
      }
      await _writeComplaintsBlob(list);
      console.log(`[Blob] Synced complaint #${safeComplaint.id} to cms_complaints.json (attempt ${attempt}).`);
      return; // success
    } catch (e) {
      if (e.message && e.message.includes('read_failure')) {
        console.error('[Blob] Aborting sync to prevent data wipe due to read failure.');
        return;
      }
      console.warn(`[Blob] syncComplaintToBlob attempt ${attempt} failed for #${safeComplaint.id}:`, e.message);
      if (attempt < 3) await new Promise(r => setTimeout(r, 400 * attempt));
    }
  }
  console.error(`[Blob] CRITICAL: All 3 sync attempts failed for complaint #${complaintObj.id}. Data may not persist!`);
}

async function deleteComplaintFromBlob(complaintId) {
  if (!process.env.BLOB_READ_WRITE_TOKEN || !complaintId) return;
  try {
    const list = await _readComplaintsBlob();
    // Soft-delete: mark as Deleted so it is excluded from lists but still in blob for count purposes
    const idx = list.findIndex(c => String(c.id) === String(complaintId));
    if (idx >= 0) {
      list[idx] = { ...list[idx], status: 'Deleted', updatedAt: new Date().toISOString() };
    }
    await _writeComplaintsBlob(list);
    console.log('[Blob] Marked complaint', complaintId, 'as Deleted in cms_complaints.json');
  } catch (e) {
    if (e.message.includes('read_failure')) {
      console.error('[Blob] Aborting delete to prevent metadata wipe due to read failure.');
      return;
    }
    console.warn('[Blob] Failed to delete complaint from blob:', e.message);
  }
}

// ─────────────────────────────────────────────────────────
//  TELEGRAM LINKS BLOB (cms_telegram_links.json)
//  Keeps phone→chat_id mappings alive across cold starts
//  and worker isolation — independent of the SQLite blob.
// ─────────────────────────────────────────────────────────
const TELEGRAM_LINKS_BLOB_KEY = 'cms_telegram_links.json';

async function _readTelegramLinksBlob() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return {};
  try {
    const { list: blobList } = require('@vercel/blob');
    let blobInfo;
    try {
      const { blobs } = await blobList({ prefix: TELEGRAM_LINKS_BLOB_KEY, limit: 10 });
      // Exact name match to prevent picking random-suffix duplicates
      blobInfo = blobs.find(b => b.pathname === TELEGRAM_LINKS_BLOB_KEY) || null;
    } catch (e) {
      const msg = (e.message || '').toLowerCase();
      if (msg.includes('not found') || msg.includes('does not exist') || msg.includes('blob does not exist') || e.status === 404) return {};
      throw e;
    }
    if (!blobInfo) return {};
    const fetchRes = await fetchWithRetry(blobInfo.downloadUrl);
    const data = await fetchRes.json();
    return (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
  } catch (e) {
    console.warn('[TelegramBlob] Could not read cms_telegram_links.json:', e.message);
    return {};
  }
}

async function _writeTelegramLinksBlob(linksMap) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    const json = JSON.stringify(linksMap);
    await put(TELEGRAM_LINKS_BLOB_KEY, json, { access: 'private', addRandomSuffix: false, contentType: 'application/json', cacheControlMaxAge: 0 });
    console.log('[TelegramBlob] cms_telegram_links.json updated with', Object.keys(linksMap).length, 'entries.');
  } catch (e) {
    console.warn('[TelegramBlob] Could not write cms_telegram_links.json:', e.message);
  }
}

/**
 * Persist a phone→chatId link to the shared Telegram links blob.
 * Called after every successful bot linking so ALL workers can see it.
 */
async function syncTelegramLinkToBlob(phoneNumber, chatId) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    const current = await _readTelegramLinksBlob();
    current[phoneNumber] = { chat_id: String(chatId), linked_at: new Date().toISOString() };
    // Also store local 09... variant so lookup always hits
    if (phoneNumber.startsWith('+251')) {
      const localVariant = '0' + phoneNumber.substring(4);
      current[localVariant] = { chat_id: String(chatId), linked_at: new Date().toISOString() };
    }
    await _writeTelegramLinksBlob(current);
  } catch (e) {
    console.warn('[TelegramBlob] syncTelegramLinkToBlob failed:', e.message);
  }
}

/**
 * Look up Telegram chat_id for a phone number.
 * Checks in-memory SQLite first (fast path), then falls back to the shared blob
 * — ensuring cross-worker delivery even on fresh cold-start workers.
 */
async function getTelegramChatIdByPhone(rawPhone) {
  if (!rawPhone) return null;
  const phone = String(rawPhone).trim().replace(/\s+/g, '');

  // Build variant: +251XXXXXXXX <-> 09XXXXXXXX
  const intlVariant = phone.startsWith('0') ? ('+251' + phone.substring(1)) : null;
  const localVariant = phone.startsWith('+251') ? ('0' + phone.substring(4)) : null;
  const alt = intlVariant || localVariant || phone;

  // Fast path: in-memory SQLite
  try {
    const database = await getDb();
    const stmt = database.prepare('SELECT chat_id FROM telegram_links WHERE phone_number = ? OR phone_number = ?');
    stmt.bind([phone, alt]);
    if (stmt.step()) {
      const vals = stmt.get();
      stmt.free();
      if (vals && vals[0]) return String(vals[0]);
    }
    stmt.free();
  } catch (e) {
    console.warn('[Telegram] SQLite lookup failed:', e.message);
  }

  // Blob fallback: cross-worker / cold-start
  try {
    const linksMap = await _readTelegramLinksBlob();
    const entry = linksMap[phone] || linksMap[alt];
    if (entry && entry.chat_id) {
      console.log(`[TelegramBlob] Found chat_id for ${phone} in blob (cross-worker lookup).`);
      // Warm the in-memory DB for subsequent calls on same worker
      try {
        const database = await getDb();
        database.run('INSERT OR REPLACE INTO telegram_links (phone_number, chat_id) VALUES (?, ?)', [phone, entry.chat_id]);
      } catch (_) { }
      return entry.chat_id;
    }
  } catch (e) {
    console.warn('[TelegramBlob] Blob fallback lookup failed:', e.message);
  }

  return null;
}

// ─────────────────────────────────────────────────────────
//  PRIMARY COMPLAINT READ PATH — reads directly from the
//  shared JSON Blob so ALL Vercel workers see the same data.
//  Falls back to in-memory SQLite for local dev (no blob token).
// ─────────────────────────────────────────────────────────
async function getAllComplaintsFromBlob(filters = {}) {
  // On Vercel: read from the authoritative shared JSON blob.
  // This path does NOT call getDb() / sql.js for the complaint data itself,
  // so it is safe even if the SQLite WASM heap is under pressure.
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      let complaints = await _readComplaintsBlob();
      if (!Array.isArray(complaints)) complaints = [];

      // Resolve username: try in-memory SQLite but treat any failure as 'Anonymous'
      // so an OOM/crash in getDb() NEVER blocks the complaint list from loading.
      let database = null;
      try { database = await getDb(); } catch (dbErr) {
        console.warn('[getAllComplaintsFromBlob] getDb() failed — usernames will be Anonymous:', dbErr.message);
      }
      const userCache = {};
      const resolveUsername = (userId) => {
        if (!database) return 'Anonymous';
        if (userCache[userId] !== undefined) return userCache[userId];
        try {
          const r = database.exec(`SELECT username FROM users WHERE id = ${Number(userId)}`);
          const name = (r.length > 0 && r[0].values.length > 0) ? r[0].values[0][0] : 'Anonymous';
          userCache[userId] = name;
          return name;
        } catch (_) { return 'Anonymous'; }
      };

      // Build filtered list (mirrors SQLite-level filters)
      let result = complaints
        .filter(c => c && c.status !== 'Deleted')
        .map(c => ({ ...c, complainant_name: resolveUsername(c.user_id) }));

      // Apply role/user filter
      const { userId, role, status, category, region, search } = filters;
      // Staff (admin/clerk/judge) see ALL complaints.
      // RESPONDENT sees complaints where they are named as respondent.
      // CITIZEN / complainant sees only their own filed complaints.
      const isStaff = ['ADMIN', 'CLERK', 'JUDGE'].includes(role?.toUpperCase());
      const isRespondent = role?.toUpperCase() === 'RESPONDENT';

      // 6-Month TTL filtering REMOVED per user request.
      // Complaints now stay permanently and are viewable by all authorized actors until explicitly deleted by an admin.

      if (!isStaff && !isRespondent && userId) {
        result = result.filter(c => String(c.user_id) === String(userId));
      }
      if (isRespondent && userId) {
        // Respondents see cases where they are named — matched by their user_id stored
        // on the complaint (set when the respondent account was served).
        // Fallback: also include any complaint where the session userId matches respondent_user_id
        // if that field exists, otherwise show all served complaints for their role.
        result = result.filter(c =>
          String(c.user_id) === String(userId) ||
          (c.respondent_user_id && String(c.respondent_user_id) === String(userId)) ||
          Number(c.is_served) === 1
        );
      }
      if (status) result = result.filter(c => c.status === status);
      if (category) result = result.filter(c => c.category === category);
      if (region) result = result.filter(c => c.complainant_region === region);
      if (search) {
        const s = search.toLowerCase();
        result = result.filter(c =>
          (c.title || '').toLowerCase().includes(s) ||
          (c.description || '').toLowerCase().includes(s)
        );
      }

      // Sort newest first
      result.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      return result;
    } catch (e) {
      console.warn('[Blob] getAllComplaintsFromBlob failed, falling back to SQLite:', e.message);
      // Fall through to SQLite fallback below
    }
  }

  // Local dev fallback: use in-memory SQLite
  const { userId, role, status, category, region, search } = filters;
  let query = `
    SELECT c.*, COALESCE(u.username, 'Anonymous') as complainant_name
    FROM complaints c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.status != 'Deleted'
  `;
  const params = [];
  const isStaff = ['ADMIN', 'CLERK', 'JUDGE'].includes(role?.toUpperCase());
  // 6-Month TTL REMOVED per user request
  if (!isStaff && userId) { query += ' AND c.user_id = ?'; params.push(userId); }
  if (status) { query += ' AND c.status = ?'; params.push(status); }
  if (category) { query += ' AND c.category = ?'; params.push(category); }
  if (region) { query += ' AND c.complainant_region = ?'; params.push(region); }
  if (search) {
    query += ' AND (c.title LIKE ? OR c.description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  query += ' ORDER BY c.created_at DESC';
  return all(query, params);
}

// ─────────────────────────────────────────────────────────
//  SINGLE COMPLAINT BLOB LOOKUP
//  Used as fallback in the detail endpoint so a cold-start
//  Vercel worker with empty SQLite can still serve complaint
//  details from the authoritative shared blob.
// ─────────────────────────────────────────────────────────
async function getComplaintFromBlob(complaintId) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const complaints = await _readComplaintsBlob();
    if (!Array.isArray(complaints)) return null;
    const c = complaints.find(x => x && String(x.id) === String(complaintId));
    return c || null;
  } catch (e) {
    console.warn('[Blob] getComplaintFromBlob failed:', e.message);
    return null;
  }
}


// Initialize tables
async function initDatabase() {
  // Pause blob uploads during schema creation / user seeding to prevent
  // uploading an incomplete snapshot that overwrites a complete blob.
  pauseBackup = true;

  // Detect whether this is a truly new, empty database (no users table populated yet).
  // We use this at the end to decide whether to call forceBackup().
  // On cold-start restores the admin user already exists, so isNewDatabase stays false.
  let isNewDatabase = false;
  try {
    await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT CHECK(role IN ('CITIZEN', 'CLERK', 'JUDGE', 'ADMIN', 'RESPONDENT', 'complainant', 'admin')) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // Create Complaints Table
    await run(`
    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      category TEXT CHECK(category IN ('Civil', 'Criminal', 'Family', 'Property', 'Labor', 'Administrative', 'Other')) NOT NULL,
      court_name TEXT NOT NULL DEFAULT '',
      court_address TEXT NOT NULL DEFAULT '',
      court_jurisdiction TEXT NOT NULL DEFAULT '',
      case_number TEXT NOT NULL DEFAULT '',
      plaintiff_name TEXT,
      defendant_name TEXT,
      parties TEXT,
      hearing_date TEXT,
      description TEXT NOT NULL,
      priority TEXT CHECK(priority IN ('Low', 'Medium', 'High', 'Urgent')) NOT NULL,
      status TEXT CHECK(status IN ('Pending', 'In Progress', 'Resolved', 'Rejected', 'Filed', 'Under Review', 'Scheduled', 'Judgment Awaited', 'Closed', 'Appeal Filed', 'Deleted')) DEFAULT 'Filed',
      assignment_status TEXT CHECK(assignment_status IN ('Unassigned', 'Assigned to Judge', 'Assigned to Court')) DEFAULT 'Unassigned',
      assigned_judge TEXT,
      attachment_path TEXT,
      legal_representation TEXT,
      complainant_phone TEXT,
      complainant_country TEXT,
      complainant_region TEXT,
      complainant_woreda TEXT,
      respondent_phone TEXT,
      respondent_email TEXT,
      respondent_country TEXT,
      respondent_region TEXT,
      respondent_woreda TEXT,
      complainant_language TEXT,
      respondent_language TEXT,
      complainant_national_id TEXT,
      respondent_national_id TEXT,
      clerk_language TEXT,
      judge_language TEXT,
      court_fee_required INTEGER DEFAULT 0,
      court_fee_amount REAL DEFAULT 0,
      court_fee_paid INTEGER DEFAULT 0,
      court_fee_receipt TEXT,
      respondent_fee_receipt TEXT,
      is_served INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

    // Migration step: gracefully add new columns if upgrading existing local SQLite DB
    const newCols = [
      'complainant_phone TEXT', 'complainant_country TEXT', 'complainant_region TEXT', 'complainant_woreda TEXT',
      'respondent_phone TEXT', 'respondent_email TEXT', 'respondent_country TEXT', 'respondent_region TEXT', 'respondent_woreda TEXT',
      'is_served INTEGER DEFAULT 0',
      'court_address TEXT NOT NULL DEFAULT ""',
      'court_fee_required INTEGER DEFAULT 0', 'court_fee_amount REAL', 'court_fee_paid INTEGER DEFAULT 0', 'court_fee_receipt TEXT', 'respondent_fee_receipt TEXT',
      'complainant_kebele TEXT', 'respondent_kebele TEXT',
      'complainant_language TEXT', 'respondent_language TEXT', 'clerk_language TEXT', 'judge_language TEXT',
      'complainant_national_id TEXT', 'respondent_national_id TEXT'
    ];
    for (const colDef of newCols) {
      try {
        // Will throw if column already exists
        await run(`ALTER TABLE complaints ADD COLUMN ${colDef}`);
      } catch (err) {
        // Ignore "duplicate column name" error naturally.
      }
    }

    // Create Remarks Table
    await run(`
    CREATE TABLE IF NOT EXISTS remarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      remark TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

    // Create Court Sessions Table
    await run(`
    CREATE TABLE IF NOT EXISTS court_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL,
      session_number INTEGER NOT NULL,
      judge_name TEXT NOT NULL,
      session_date TEXT NOT NULL,
      session_time TEXT,
      courtroom TEXT,
      hearing_type TEXT CHECK(hearing_type IN ('Preliminary', 'Substantive', 'Interim', 'Final', 'Judgment')) NOT NULL,
      outcome TEXT,
      next_hearing_date TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
    )
  `);

    // Create Case Notes Table (Confidential)
    await run(`
    CREATE TABLE IF NOT EXISTS case_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      note_text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

    // Create Case Orders/Judgments Table
    await run(`
    CREATE TABLE IF NOT EXISTS case_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL,
      order_date TEXT NOT NULL,
      order_type TEXT CHECK(order_type IN ('Interim', 'Final Judgment', 'Dismissal', 'Settlement', 'Appeal')) NOT NULL,
      judge_name TEXT NOT NULL,
      order_details TEXT NOT NULL,
      compensation_amount REAL,
      document_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
    )
  `);

    // Create Filed Complaints Ledger Table (append-only — NEVER deleted, survives admin deletion)
    await run(`
    CREATE TABLE IF NOT EXISTS filed_complaints_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      filed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // Create SMS Logs Table (audit trail for AI-generated SMS notifications)
    await run(`
    CREATE TABLE IF NOT EXISTS sms_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL,
      recipient_phone TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'sent',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
    )
  `);

    // Create Telegram Links Table (links phone numbers to Telegram Chat IDs)
    await run(`
    CREATE TABLE IF NOT EXISTS telegram_links (
      phone_number TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      linked_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // Create In-App Notifications Table 
    await run(`
    CREATE TABLE IF NOT EXISTS in_app_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      complaint_id INTEGER,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
    )
  `);

    // Insert default administrators
    const adminExists = await get("SELECT * FROM users WHERE username = 'admin' LIMIT 1");
    if (!adminExists) {
      // No admin means this is a brand-new, empty database — mark it so we backup at the end.
      isNewDatabase = true;
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      await run(
        "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)",
        ['admin', 'admin@cms.com', hashedPassword, 'ADMIN']
      );
      console.log('Default Admin user seeded.');
    }

    // Insert default users
    const userExists = await get("SELECT * FROM users WHERE username = 'user' LIMIT 1");
    if (!userExists) {
      const hashedPassword = bcrypt.hashSync('user123', 10);
      await run("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)", ['user', 'user@cms.com', hashedPassword, 'CITIZEN']);
    }
    const clerkExists = await get("SELECT * FROM users WHERE username = 'clerk' LIMIT 1");
    if (!clerkExists) {
      const hashedPassword = bcrypt.hashSync('clerk123', 10);
      await run("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)", ['clerk', 'clerk@cms.com', hashedPassword, 'CLERK']);
    }
    const judgeExists = await get("SELECT * FROM users WHERE username = 'judge' LIMIT 1");
    if (!judgeExists) {
      const hashedPassword = bcrypt.hashSync('judge123', 10);
      await run("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)", ['judge', 'judge@cms.com', hashedPassword, 'JUDGE']);
    }

    const respondentExists = await get("SELECT * FROM users WHERE username = 'respondent' LIMIT 1");
    if (!respondentExists) {
      const hashedPassword = bcrypt.hashSync('resp123', 10);
      await run("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)", ['respondent', 'respondent@cms.com', hashedPassword, 'RESPONDENT']);
      console.log('Default Respondent user seeded.');
    }

  } finally {
    pauseBackup = false;
  }

  // CRITICAL: Only call forceBackup() on a brand-new empty database.
  // On cold starts the blob was already restored into /tmp before getDb() returned,
  // so calling forceBackup() here would OVERWRITE the blob with just default users
  // and zero complaints — wiping all filed data!
  if (isNewDatabase) {
    console.log('[Persistence] Fresh database detected — uploading initial snapshot to Vercel Blob.');
    await forceBackup();
  } else {
    console.log('[Persistence] Restored database — skipping forceBackup() to preserve existing blob data.');
  }
  console.log('Database initialized successfully.');
}

module.exports = {
  getDb,
  run,
  get,
  all,
  initDatabase,
  forceBackup,
  getFiledCount,
  incrementFiledCount,
  syncComplaintToBlob,
  deleteComplaintFromBlob,
  getAllComplaintsFromBlob,
  getComplaintFromBlob,
  syncTelegramLinkToBlob,
  getTelegramChatIdByPhone
};

