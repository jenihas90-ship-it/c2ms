const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { put, list } = require('@vercel/blob');

let db = null;
let SQL = null;
let DB_FILE = null;
let pauseBackup = false; // Guards against blob uploads during DB initialisation
let detectedBlobAccess = 'private'; // Live store is confirmed private; auto-adapts if public

/**
 * Fetches a URL with up to `retries` attempts (default 4), waiting `delayMs` between each.
 * Supports both private and public Vercel Blobs by injecting Authorization header.
 */
async function fetchWithRetry(url, retries = 4, delayMs = 1000) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      let finalUrl = url;
      try {
        const u = new URL(url);
        u.searchParams.delete('download');
        u.searchParams.set('cache', '0');
        finalUrl = u.toString();
      } catch (_) {
        finalUrl = url + (url.includes('?') ? '&' : '?') + 'cache=0';
      }
      const headers = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      };
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        headers['Authorization'] = `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`;
      }
      const res = await fetch(finalUrl, {
        cache: 'no-store',
        headers
      });
      if (res.ok) return res;
      lastErr = new Error(`HTTP ${res.status} from blob URL (${url})`);
    } catch (e) {
      lastErr = e;
    }
    if (i < retries) await new Promise(r => setTimeout(r, delayMs));
  }
  throw lastErr;
}

/**
 * Universal JSON reader for Vercel Blobs using the official SDK get() method.
 * Works seamlessly with both private and public storage tiers without 403 or 400 errors.
 */
async function readBlobJson(urlOrPathname) {
  if (!process.env.BLOB_READ_WRITE_TOKEN || !urlOrPathname) return null;
  const { get: blobGet } = require('@vercel/blob');

  // If a full URL is passed, extract the pathname to ensure clean query-free retrieval
  let target = urlOrPathname;
  if (typeof target === 'string' && (target.startsWith('http://') || target.startsWith('https://'))) {
    try {
      const parsed = new URL(target);
      target = parsed.pathname.replace(/^\//, '');
    } catch (_) { }
  }

  const preferred = detectedBlobAccess || 'private';
  const modes = [preferred, preferred === 'private' ? 'public' : 'private'];

  let lastErr = null;
  for (const access of modes) {
    try {
      // NOTE: Do NOT pass token or useCache: false here!
      // When token is omitted, @vercel/blob handles authentication via its native mechanism.
      // Passing token explicitly triggers a 400 Bad Request on private store endpoints.
      const res = await blobGet(target, { access });
      if (res && res.statusCode === 200 && res.stream) {
        detectedBlobAccess = access;
        const text = await new Response(res.stream).text();
        try {
          return JSON.parse(text);
        } catch (jsonErr) {
          console.error('[readBlobJson] JSON parse failed for:', target, 'content:', text.substring(0, 100));
          return null;
        }
      }
      if (res && res.statusCode === 404) return null;
    } catch (e) {
      lastErr = e;
      continue;
    }
  }

  // Fallback to fetchWithRetry with Authorization header
  try {
    const res = await fetchWithRetry(urlOrPathname);
    return await res.json();
  } catch (fetchErr) {
    throw lastErr || fetchErr;
  }
}

/**
 * Safe put wrapper that automatically handles private and public store configurations.
 * Prevents "Cannot use public access on a private store" and vice versa.
 */
async function putBlobSafe(pathname, data, options = {}) {
  const json = typeof data === 'string' ? data : JSON.stringify(data);
  const preferred = detectedBlobAccess || 'private';
  const modes = [preferred, preferred === 'private' ? 'public' : 'private'];

  let lastErr;
  for (const access of modes) {
    try {
      const res = await put(pathname, json, {
        ...options,
        access,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: options.contentType || 'application/json',
        cacheControlMaxAge: 0
      });
      detectedBlobAccess = access;
      return res;
    } catch (err) {
      lastErr = err;
      const msg = err.message || '';
      if (
        msg.includes('Cannot use public access on a private store') ||
        msg.includes('Cannot use private access on a public store')
      ) {
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// Pre-computed bcrypt hashes (cost=10) for standard default users to ensure instantaneous, synchronous seeding
const DEFAULT_USER_HASHES = {
  admin: '$2a$10$gUfnusHJqn82lkFrU8on0uGumhGUkQ4SWSqaxKXQVBB6SHkH/B8pK',
  user: '$2a$10$.fEm.Tkf0Z2XVPMs/4hmiuvNzrylaU9Un5L4JMqg9Tv.BDGkowzr.',
  clerk: '$2a$10$ca9SCDu43PRALJB9lvP1a.fDoIs9wePhoIPhNAu1WUYi8O4ePt8i.',
  judge: '$2a$10$MqDottWwjj4KO.LFJxLUMu5hdvScfGhpW0EAQ930Z0hK2KIxq6OPG',
  respondent: '$2a$10$gir3hT1jVV.HDG930mzimuNRoIpFpd8NKdHTi13xvDMdAmW0Qk8.S'
};

function _ensureColumnMigrations(database) {
  const newCols = [
    'complainant_phone TEXT', 'complainant_country TEXT', 'complainant_region TEXT', 'complainant_woreda TEXT',
    'respondent_phone TEXT', 'respondent_email TEXT', 'respondent_country TEXT', 'respondent_region TEXT', 'respondent_woreda TEXT',
    'is_served INTEGER DEFAULT 0',
    'court_address TEXT NOT NULL DEFAULT ""',
    'court_fee_required INTEGER DEFAULT 0', 'court_fee_amount REAL', 'court_fee_paid INTEGER DEFAULT 0', 'court_fee_method TEXT', 'court_fee_receipt TEXT', 'respondent_fee_receipt TEXT',
    'complainant_kebele TEXT', 'respondent_kebele TEXT',
    'complainant_language TEXT', 'respondent_language TEXT', 'clerk_language TEXT', 'judge_language TEXT',
    'complainant_national_id TEXT', 'respondent_national_id TEXT', 'formal_response TEXT',
    'respondent_user_id INTEGER'
  ];
  for (const colDef of newCols) {
    try {
      database.run(`ALTER TABLE complaints ADD COLUMN ${colDef}`);
    } catch (_) { }
  }
}

function ensureSchema(database) {
  if (!database) return;
  try {
    const check = database.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
    const usersExist = check.length > 0 && check[0].values.length > 0;
    if (usersExist) {
      _ensureColumnMigrations(database);
      return;
    }
  } catch (_) { }

  try {
    database.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT CHECK(role IN ('CITIZEN', 'CLERK', 'JUDGE', 'ADMIN', 'RESPONDENT', 'complainant', 'admin')) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    database.run(`
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
        complainant_kebele TEXT,
        respondent_phone TEXT,
        respondent_email TEXT,
        respondent_country TEXT,
        respondent_region TEXT,
        respondent_woreda TEXT,
        respondent_kebele TEXT,
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
        court_fee_method TEXT,
        respondent_fee_receipt TEXT,
        is_served INTEGER DEFAULT 0,
        formal_response TEXT,
        respondent_user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    database.run(`
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

    database.run(`
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

    database.run(`
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

    database.run(`
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

    database.run(`
      CREATE TABLE IF NOT EXISTS filed_complaints_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        filed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    database.run(`
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

    database.run(`
      CREATE TABLE IF NOT EXISTS telegram_links (
        phone_number TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        linked_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    database.run(`
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

    // Seed default users if users table has no admin
    const adminCheck = database.exec("SELECT id FROM users WHERE username = 'admin' LIMIT 1");
    if (adminCheck.length === 0 || adminCheck[0].values.length === 0) {
      const defaultUsers = [
        ['admin', 'admin@cms.com', DEFAULT_USER_HASHES.admin, 'ADMIN'],
        ['user', 'user@cms.com', DEFAULT_USER_HASHES.user, 'CITIZEN'],
        ['clerk', 'clerk@cms.com', DEFAULT_USER_HASHES.clerk, 'CLERK'],
        ['judge', 'judge@cms.com', DEFAULT_USER_HASHES.judge, 'JUDGE'],
        ['respondent', 'respondent@cms.com', DEFAULT_USER_HASHES.respondent, 'RESPONDENT'],
        ['landlord_john', 'jenihas90@gmail.com', DEFAULT_USER_HASHES.respondent, 'RESPONDENT']
      ];
      for (const [uname, uemail, upass, urole] of defaultUsers) {
        database.run(
          "INSERT OR IGNORE INTO users (username, email, password, role) VALUES (?, ?, ?, ?)",
          [uname, uemail, upass, urole]
        );
      }
      console.log('[ensureSchema] Core tables created and default accounts seeded.');
    }

    _ensureColumnMigrations(database);
  } catch (err) {
    console.error('[ensureSchema] Error ensuring schema:', err.message);
  }
}

// Initialize sql.js and create in-memory/tmp database
async function getDb() {
  if (db) {
    ensureSchema(db);
    return db;
  }

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
          ensureSchema(db);
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
  ensureSchema(db);
  return db;
}

// Run query (INSERT, UPDATE, DELETE, CREATE)
async function run(sql, params = []) {
  const database = await getDb();

  // CRITICAL: If we are about to INSERT into the complaints table, rehydrate first.
  // On a fresh cold-start worker the in-memory SQLite is empty (AUTOINCREMENT at 0).
  // Without rehydration, the new INSERT gets id=1 which collides with the existing
  // id=1 in cms_complaints.json. The blob merge then OVERWRITES the old complaint
  // with the new one, causing data loss. Rehydrating first loads all existing
  // complaints from the blob, so SQLite's AUTOINCREMENT correctly continues from
  // max(existing id) + 1.
  const sqlUpper = sql.trim().toUpperCase();
  if (sqlUpper.startsWith('INSERT') && sql.toLowerCase().includes('into complaints')) {
    try {
      // Force rehydration (bypass throttle) so SQLite has the latest IDs from the blob
      // before AUTOINCREMENT picks the next value — prevents ID collisions across workers.
      await ensureComplaintsRehydrated(database, true);
    } catch (rehydrateErr) {
      console.warn('[run] Pre-INSERT rehydration failed (non-fatal):', rehydrateErr.message);
    }
  }

  // CRITICAL: If we are about to INSERT into the users table, rehydrate first
  // so SQLite has the latest user IDs from cms_users.json before AUTOINCREMENT picks next value.
  if (sqlUpper.startsWith('INSERT') && sql.toLowerCase().includes('into users')) {
    try {
      await ensureUsersRehydrated(database, true);
    } catch (rehydrateErr) {
      console.warn('[run] Pre-INSERT user rehydration failed (non-fatal):', rehydrateErr.message);
    }
  }

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
    if (!pauseBackup && DB_FILE && (sqlUpper.startsWith('INSERT') || sqlUpper.startsWith('UPDATE') || sqlUpper.startsWith('DELETE') || sqlUpper.startsWith('CREATE') || sqlUpper.startsWith('ALTER'))) {
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
  'court_fee_required', 'court_fee_amount', 'court_fee_paid', 'court_fee_method', 'court_fee_receipt', 'respondent_fee_receipt',
  'is_served', 'created_at', 'updated_at',
  // Respondent formal response — must be listed here so it survives cold-start rehydration
  'formal_response', 'respondent_user_id'
]);

// Start at -Infinity so the very first request on a fresh worker ALWAYS reads from Blob.
// This is critical: each Vercel worker has its own module scope and its own in-memory DB.
// Without an immediate first-read, a new worker will never learn about complaints filed
// on a different worker.
let lastRehydrateTime = -Infinity;
async function ensureComplaintsRehydrated(database, force = false) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  const now = Date.now();
  // Allow callers to bypass the throttle (e.g. before an INSERT) to prevent ID collisions
  if (!force && (now - lastRehydrateTime < 30000)) return;
  lastRehydrateTime = now;

  try {
    const blobComplaints = await _readComplaintsBlob();
    if (!blobComplaints || !Array.isArray(blobComplaints) || blobComplaints.length === 0) return;

    for (const c of blobComplaints) {
      if (!c || !c.id) continue;
      if (!c.created_at && c.createdAt) c.created_at = c.createdAt;
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
  if (sql.toLowerCase().includes('users')) {
    await ensureUsersRehydrated(database);
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
  if (sql.toLowerCase().includes('users')) {
    await ensureUsersRehydrated(database);
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
    return await readBlobJson(STATS_BLOB_KEY);
  } catch (e) {
    console.warn('[Stats] Could not read cms_stats.json:', e.message);
    return null;
  }
}

async function _writeStatsBlob(data) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    await putBlobSafe(STATS_BLOB_KEY, data);
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
const LEGACY_COMPLAINTS_BLOB_KEY = 'cms_complaints.json';

async function _readComplaintsBlob() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return [];
  // Declare results OUTSIDE try so the catch block can reference it safely.
  // Previously results was declared inside try with const — causing a ReferenceError
  // in the catch handler and silently swallowing partial results.
  const results = [];
  try {
    const { list: blobList } = require('@vercel/blob');
    let hasMore = true;
    let cursor = undefined;
    const allBlobs = [];

    // First, list all individual complaint blobs
    while (hasMore) {
      const { blobs, cursor: nextCursor, hasMore: more } = await blobList({ prefix: 'cms_complaint_', cursor, limit: 1000 });
      if (blobs) allBlobs.push(...blobs);
      cursor = nextCursor;
      hasMore = more;
    }

    // Group by ID to locate the most recently timestamped blob per complaint
    const latestBlobsMap = new Map();
    for (const b of allBlobs) {
      // match: cms_complaint_ID_TIMESTAMP.json
      const match = b.pathname.match(/^cms_complaint_(\d+)_(\d+)\.json$/);
      if (match) {
        const id = match[1];
        const ts = parseInt(match[2], 10);
        if (!latestBlobsMap.has(id) || latestBlobsMap.get(id).ts < ts) {
          latestBlobsMap.set(id, { ts, pathname: b.pathname, url: b.url || b.downloadUrl });
        }
      }
    }

    // Download all latest blobs in parallel using readBlobJson
    const itemsToFetch = Array.from(latestBlobsMap.values());
    const maxConcurrency = 20;

    for (let i = 0; i < itemsToFetch.length; i += maxConcurrency) {
      const batch = itemsToFetch.slice(i, i + maxConcurrency);
      const batchResults = await Promise.all(batch.map(async item => {
        try {
          return await readBlobJson(item.pathname || item.url);
        } catch (e) {
          // Non-fatal: a single blob failing should not wipe out the entire list.
          console.error('[Blob] Non-fatal: Failed to read individual complaint blob:', item.pathname, e.message);
          return null;
        }
      }));
      results.push(...batchResults.filter(x => x !== null && x.id !== undefined));
    }

    // Attempt fetching legacy cms_complaints.json for backwards compatibility
    try {
      const { blobs } = await blobList({ prefix: LEGACY_COMPLAINTS_BLOB_KEY, limit: 10 });
      const legacyInfo = blobs.find(b => b.pathname === LEGACY_COMPLAINTS_BLOB_KEY) || null;
      if (legacyInfo) {
        const legacyData = await readBlobJson(legacyInfo.pathname || legacyInfo.url).catch(() => null);
        if (Array.isArray(legacyData)) {
          const existingIds = new Set(results.map(c => String(c.id)));
          for (const lc of legacyData) {
            if (lc && lc.id && !existingIds.has(String(lc.id))) {
              results.push(lc);
              // Auto-migrate it to individual blob quietly
              syncComplaintToBlob(lc).catch(() => { });
            }
          }
        }
      }
    } catch (e) {
      // ignore legacy fetch failure
    }

    return results;
  } catch (e) {
    // Return whatever partial results were collected thus far rather than throwing.
    // This ensures a transient Blob API error never causes the entire complaint list
    // to vanish. A partial list is far better than an empty one.
    console.error('[Blob] Warning: Partial failure reading complaint blobs:', e.message, '— returning', results.length, 'partial results.');
    if (results.length > 0) return results;
    throw new Error('read_failure');
  }
}

async function _writeComplaintsBlob(complaintsList) {
  // Deprecated: We no longer write the monolithic array.
  return;
}

async function syncComplaintToBlob(complaintObj) {
  if (!process.env.BLOB_READ_WRITE_TOKEN || !complaintObj || !complaintObj.id) return;
  const { attachment_path, court_fee_receipt, complainant_national_id, respondent_national_id, ...safeComplaint } = complaintObj;

  const timestamp = Date.now();
  const created_at = safeComplaint.created_at || safeComplaint.createdAt || new Date().toISOString();
  const complaintToSave = {
    ...safeComplaint,
    created_at,
    createdAt: created_at
  };

  try {
    const { list, del } = require('@vercel/blob');

    // 1. Write the new unique file using putBlobSafe (handles private/public automatically)
    await putBlobSafe(`cms_complaint_${safeComplaint.id}_${timestamp}.json`, complaintToSave);
    console.log(`[Blob] Synced complaint #${safeComplaint.id} to individual json blob.`);

    // 2. Clean up strictly OLDER versions of THIS EXACT complaint ID
    // Using exact complaint ID regex prevents deleting complaints with prefix overlap (e.g. 1 matching 10)
    const { blobs } = await list({ prefix: `cms_complaint_${safeComplaint.id}_` });
    const regex = new RegExp(`^cms_complaint_${safeComplaint.id}_(\\d+)\\.json$`);
    const oldBlobs = blobs.filter(b => {
      const match = b.pathname.match(regex);
      if (match) {
        return parseInt(match[1], 10) < timestamp;
      }
      return false; // don't delete unrecognized files just in case
    });
    if (oldBlobs.length > 0) {
      await del(oldBlobs.map(b => b.url));
    }
  } catch (e) {
    console.error(`[Blob] CRITICAL: syncComplaintToBlob failed for #${safeComplaint.id}:`, e.message);
  }
}

async function deleteComplaintFromBlob(complaintId) {
  if (!process.env.BLOB_READ_WRITE_TOKEN || !complaintId) return;
  try {
    const { list, del } = require('@vercel/blob');
    const timestamp = Date.now();

    // We soft-delete by writing a new blob for this ID with status: 'Deleted'
    const deletedState = { id: complaintId, status: 'Deleted', updatedAt: new Date().toISOString() };

    await putBlobSafe(`cms_complaint_${complaintId}_${timestamp}.json`, deletedState);

    const { blobs } = await list({ prefix: `cms_complaint_${complaintId}_` });
    // Clean up strictly OLDER versions of THIS EXACT complaint ID
    const regex = new RegExp(`^cms_complaint_${complaintId}_(\\d+)\\.json$`);
    const oldBlobs = blobs.filter(b => {
      const match = b.pathname.match(regex);
      if (match) {
        return parseInt(match[1], 10) < timestamp;
      }
      return false;
    });
    if (oldBlobs.length > 0) {
      await del(oldBlobs.map(b => b.url));
    }

    console.log('[Blob] Soft-deleted complaint', complaintId, 'via individual blob');
  } catch (e) {
    if (e.message && e.message.includes('read_failure')) {
      console.error('[Blob] Aborting delete to prevent metadata wipe due to read failure.');
      return;
    }
    console.warn('[Blob] Failed to mark complaint deleted in individual blob:', e.message);
  }
}

// ─────────────────────────────────────────────────────────
//  PERMANENT USERS BACKUP BLOB (cms_users.json)
//  Persists registered users (Citizens, Respondents, etc.)
//  across Vercel serverless cold starts and multi-worker routing.
// ─────────────────────────────────────────────────────────
const USERS_BLOB_KEY = 'cms_users.json';

async function _readUsersBlob() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return [];
  try {
    const data = await readBlobJson(USERS_BLOB_KEY);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('[UsersBlob] Could not read cms_users.json:', e.message);
    return [];
  }
}

async function _writeUsersBlob(usersList) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    await putBlobSafe(USERS_BLOB_KEY, usersList);
    console.log('[UsersBlob] cms_users.json updated with', usersList.length, 'users.');
  } catch (e) {
    console.warn('[UsersBlob] Could not write cms_users.json:', e.message);
  }
}

async function syncUserToBlob(userObj) {
  if (!process.env.BLOB_READ_WRITE_TOKEN || !userObj) return;
  try {
    const users = await _readUsersBlob();
    const existingIndex = users.findIndex(u =>
      (userObj.id && String(u.id) === String(userObj.id)) ||
      (userObj.username && u.username && u.username.toLowerCase() === String(userObj.username).toLowerCase()) ||
      (userObj.email && u.email && u.email.toLowerCase() === String(userObj.email).toLowerCase())
    );

    const userRecord = {
      id: userObj.id,
      username: userObj.username,
      email: userObj.email,
      password: userObj.password,
      role: userObj.role,
      created_at: userObj.created_at || new Date().toISOString()
    };

    if (existingIndex >= 0) {
      users[existingIndex] = { ...users[existingIndex], ...userRecord };
    } else {
      users.push(userRecord);
    }

    await _writeUsersBlob(users);
    console.log(`[UsersBlob] Synced user ${userRecord.username} (id=${userRecord.id}, role=${userRecord.role}) to blob.`);
  } catch (e) {
    console.error(`[UsersBlob] Error syncing user to blob:`, e.message);
  }
}

let lastUsersRehydrateTime = -Infinity;
async function ensureUsersRehydrated(database, force = false) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  const now = Date.now();
  if (!force && (now - lastUsersRehydrateTime < 15000)) return;
  lastUsersRehydrateTime = now;

  try {
    const blobUsers = await _readUsersBlob();
    if (!blobUsers || !Array.isArray(blobUsers) || blobUsers.length === 0) return;

    for (const u of blobUsers) {
      if (!u || !u.username || !u.password) continue;
      try {
        const checkSql = `SELECT id FROM users WHERE id = ${Number(u.id)} OR LOWER(username) = ? OR LOWER(email) = ?`;
        const stmt = database.prepare(checkSql);
        stmt.bind([(u.username || '').toLowerCase(), (u.email || '').toLowerCase()]);
        let exists = false;
        let existingId = null;
        if (stmt.step()) {
          exists = true;
          const vals = stmt.get();
          existingId = vals[0];
        }
        stmt.free();

        if (!exists) {
          if (u.id) {
            database.run(
              `INSERT INTO users (id, username, email, password, role, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
              [Number(u.id), u.username, u.email, u.password, u.role, u.created_at || new Date().toISOString()]
            );
          } else {
            database.run(
              `INSERT INTO users (username, email, password, role, created_at) VALUES (?, ?, ?, ?, ?)`,
              [u.username, u.email, u.password, u.role, u.created_at || new Date().toISOString()]
            );
          }
          console.log(`[UsersRehydrate] Loaded user ${u.username} (#${u.id}, ${u.role}) from blob into SQLite`);
        } else if (existingId) {
          database.run(
            `UPDATE users SET password = ?, role = ? WHERE id = ?`,
            [u.password, u.role, existingId]
          );
        }
      } catch (innerErr) {
        console.warn(`[UsersRehydrate] Error rehydrating user ${u.username}:`, innerErr.message);
      }
    }
  } catch (e) {
    console.warn('[UsersRehydrate] Warning:', e.message);
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
    const data = await readBlobJson(TELEGRAM_LINKS_BLOB_KEY);
    return (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
  } catch (e) {
    console.warn('[TelegramBlob] Could not read cms_telegram_links.json:', e.message);
    return {};
  }
}

async function _writeTelegramLinksBlob(linksMap) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    await putBlobSafe(TELEGRAM_LINKS_BLOB_KEY, linksMap);
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
function _applyComplaintListFilters(complaints, filters, resolveUsername = () => 'Anonymous') {
  let result = complaints
    .filter(c => c && c.status !== 'Deleted')
    .map(c => ({
      ...c,
      created_at: c.created_at || c.createdAt || new Date().toISOString(),
      complainant_name: c.complainant_name || resolveUsername(c.user_id)
    }));

  const { userId, role, status, category, region, search } = filters;
  const isStaff = ['ADMIN', 'CLERK', 'JUDGE'].includes(role?.toUpperCase());
  const isRespondent = role?.toUpperCase() === 'RESPONDENT';

  // INVARIANT: Complaints stay permanently visible to all actors (until explicitly deleted by Admin).
  // There are NO time-based expiration filters (e.g. no 6-month or 1-year auto-hide).
  // Furthermore, user requested that all complaints be public to all actors.
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

  result.sort((a, b) => {
    const timeA = new Date(a.created_at || a.createdAt || 0).getTime();
    const timeB = new Date(b.created_at || b.createdAt || 0).getTime();
    if (timeB !== timeA) return timeB - timeA;
    return Number(b.id || 0) - Number(a.id || 0);
  });
  return result;
}

async function _querySqliteComplaints(filters = {}) {
  const { userId, role, status, category, region, search } = filters;
  let query = `
    SELECT c.*, COALESCE(u.username, 'Anonymous') as complainant_name
    FROM complaints c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.status != 'Deleted'
  `;
  const params = [];
  const isStaff = ['ADMIN', 'CLERK', 'JUDGE'].includes(role?.toUpperCase());
  const isRespondent = role?.toUpperCase() === 'RESPONDENT';
  if (status) { query += ' AND c.status = ?'; params.push(status); }
  if (category) { query += ' AND c.category = ?'; params.push(category); }
  if (region) { query += ' AND c.complainant_region = ?'; params.push(region); }
  if (search) {
    query += ' AND (c.title LIKE ? OR c.description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  query += ' ORDER BY c.created_at DESC, c.id DESC';
  return all(query, params);
}

async function getAllComplaintsFromBlob(filters = {}) {
  // On Vercel: read from the authoritative shared JSON blob AND supplement with
  // local SQLite data. Both sources are always merged — this prevents the
  // "empty list" bug where blob-empty → SQLite fallback on cold-start worker
  // → SQLite also empty → returns []. By always unioning, a complaint filed
  // on any worker is visible immediately even if blob sync is still in-flight.
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      // Read blob — non-fatal if empty or missing
      let blobComplaints = [];
      try {
        const raw = await _readComplaintsBlob();
        if (Array.isArray(raw)) blobComplaints = raw;
      } catch (blobErr) {
        console.warn('[getAllComplaintsFromBlob] Blob read failed (non-fatal):', blobErr.message);
      }

      // Resolve username from in-memory SQLite (best-effort)
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

      // Apply filters to blob data
      let result = _applyComplaintListFilters(blobComplaints, filters, resolveUsername);

      // ALWAYS supplement with SQLite complaints (covers: just-filed on this worker,
      // blob-empty cold-start, blob sync lag). Auto-syncs any SQLite-only rows to blob.
      // First, warm up SQLite from blob on cold-start so the supplement is also populated.
      try {
        if (database) await ensureComplaintsRehydrated(database);
      } catch (_) { /* non-fatal */ }
      try {
        const sqliteRows = await _querySqliteComplaints(filters);
        const knownIds = new Set(result.map(c => String(c.id)));
        for (const row of sqliteRows) {
          if (!knownIds.has(String(row.id))) {
            result.push(row);
            // Fire-and-forget sync so blob catches up without blocking the response
            syncComplaintToBlob(row).catch(err =>
              console.warn(`[Blob] Auto-sync complaint #${row.id} from SQLite supplement failed:`, err.message)
            );
          }
        }
        result.sort((a, b) => {
          const timeA = new Date(a.created_at || a.createdAt || 0).getTime();
          const timeB = new Date(b.created_at || b.createdAt || 0).getTime();
          if (timeB !== timeA) return timeB - timeA;
          return Number(b.id || 0) - Number(a.id || 0);
        });
      } catch (suppErr) {
        console.warn('[Blob] SQLite supplement skipped:', suppErr.message);
      }

      return result;
    } catch (e) {
      console.warn('[Blob] getAllComplaintsFromBlob failed, falling back to SQLite:', e.message);
      // Fall through to SQLite fallback below
    }
  }

  // Local dev / last-resort fallback: ensure SQLite is warm from blob, then query it.
  // Without rehydration here a cold-start Vercel worker returns an empty list even when
  // cms_complaints.json has data — because in-memory SQLite starts empty on every cold start.
  try {
    const database = await getDb();
    await ensureComplaintsRehydrated(database);
  } catch (_) { /* non-fatal */ }
  return _querySqliteComplaints(filters);
}

// ─────────────────────────────────────────────────────────
//  SINGLE COMPLAINT BLOB LOOKUP
//  Used as fallback in the detail endpoint so a cold-start
//  Vercel worker with empty SQLite can still serve complaint
//  details from the authoritative shared blob.
//
//  FAST PATH: scans only blobs whose name starts with
//  cms_complaint_ID_ (just a handful), not the full list.
//  This avoids fetching every complaint on every detail view.
// ─────────────────────────────────────────────────────────
async function getComplaintFromBlob(complaintId) {
  if (!process.env.BLOB_READ_WRITE_TOKEN || !complaintId) return null;
  try {
    const { list: blobList } = require('@vercel/blob');
    const prefix = `cms_complaint_${complaintId}_`;
    const { blobs } = await blobList({ prefix, limit: 20 });

    if (!blobs || blobs.length === 0) {
      // No individual blob found — fall back to full scan for legacy data
      const all = await _readComplaintsBlob().catch(() => []);
      return (Array.isArray(all) ? all.find(x => x && String(x.id) === String(complaintId)) : null) || null;
    }

    // Pick the latest timestamped blob for this complaint
    let latestTs = -1;
    let latestTarget = null;
    const regex = new RegExp(`^cms_complaint_${complaintId}_(\\d+)\\.json$`);
    for (const b of blobs) {
      const match = b.pathname.match(regex);
      if (match) {
        const ts = parseInt(match[1], 10);
        if (ts > latestTs) { latestTs = ts; latestTarget = b.pathname || b.url || b.downloadUrl; }
      }
    }

    if (!latestTarget) return null;
    const data = await readBlobJson(latestTarget);
    // Guard: the blob could be the soft-delete marker (only has id+status)
    if (!data || data.status === 'Deleted' || !data.title) return null;
    return data;
  } catch (e) {
    console.warn('[Blob] getComplaintFromBlob failed:', e.message);
    return null;
  }
}


// Initialize tables and rehydrate state
async function initDatabase() {
  pauseBackup = true;
  try {
    const database = await getDb();
    ensureSchema(database);
    await ensureUsersRehydrated(database);
    await ensureComplaintsRehydrated(database);
    if (DB_FILE) {
      try {
        const buffer = Buffer.from(database.export());
        fs.writeFileSync(DB_FILE, buffer);
      } catch (_) { }
    }
  } catch (err) {
    console.error('[initDatabase] Error during initialization:', err);
    throw err;
  } finally {
    pauseBackup = false;
  }
  console.log('Database initialized successfully.');
}

module.exports = {
  getDb,
  run,
  get,
  all,
  initDatabase,
  ensureSchema,
  forceBackup,
  getFiledCount,
  incrementFiledCount,
  syncComplaintToBlob,
  deleteComplaintFromBlob,
  getAllComplaintsFromBlob,
  getComplaintFromBlob,
  syncTelegramLinkToBlob,
  getTelegramChatIdByPhone,
  syncUserToBlob,
  ensureUsersRehydrated,
  putBlobSafe,
  fetchWithRetry,
  readBlobJson
};

