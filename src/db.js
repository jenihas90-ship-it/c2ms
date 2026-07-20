const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const os = require('os');

let db = null;
let SQL = null;
let DB_FILE = null;

// Initialize sql.js and create in-memory/tmp database
async function getDb() {
  if (db) return db;

  if (!DB_FILE) {
    // Vercel serverless apps can only write to /tmp
    DB_FILE = path.join(os.tmpdir(), 'cms_vercel.sqlite');
  }

  if (!SQL) {
    // Use the ASM.js build (pure JavaScript, no WASM file needed)
    const initSqlJs = require('sql.js/dist/sql-asm.js');
    SQL = await initSqlJs();
  }

  try {
    if (fs.existsSync(DB_FILE)) {
      const fileBuffer = fs.readFileSync(DB_FILE);
      db = new SQL.Database(fileBuffer);
      console.log('Loaded database from ' + DB_FILE);
      return db;
    }
  } catch (e) {
    console.warn('Failed to load existing tmp DB, starting fresh.', e);
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

    // Persist to Vercel's /tmp filesystem
    if (DB_FILE && (sql.trim().toUpperCase().startsWith('INSERT') || sql.trim().toUpperCase().startsWith('UPDATE') || sql.trim().toUpperCase().startsWith('DELETE') || sql.trim().toUpperCase().startsWith('CREATE') || sql.trim().toUpperCase().startsWith('ALTER'))) {
      try {
        const data = database.export();
        fs.writeFileSync(DB_FILE, Buffer.from(data));
      } catch (err) {
        console.warn('Could not persist to tmp:', err.message);
      }
    }

    return { id, changes };
  } catch (err) {
    throw err;
  }
}

// Get single row
async function get(sql, params = []) {
  const database = await getDb();
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

// Initialize tables
async function initDatabase() {
  // Create Users Table
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
      court_jurisdiction TEXT NOT NULL DEFAULT '',
      case_number TEXT NOT NULL DEFAULT '',
      plaintiff_name TEXT,
      defendant_name TEXT,
      parties TEXT,
      hearing_date TEXT,
      description TEXT NOT NULL,
      priority TEXT CHECK(priority IN ('Low', 'Medium', 'High', 'Urgent')) NOT NULL,
      status TEXT CHECK(status IN ('Pending', 'In Progress', 'Resolved', 'Rejected', 'Filed', 'Under Review', 'Scheduled', 'Judgment Awaited', 'Closed', 'Appeal Filed')) DEFAULT 'Filed',
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
    'is_served INTEGER DEFAULT 0'
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

  // Insert default administrator
  const adminExists = await get("SELECT * FROM users WHERE role = 'ADMIN' LIMIT 1");
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    await run(
      "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)",
      ['admin', 'admin@cms.com', hashedPassword, 'ADMIN']
    );
    console.log('Default Admin user seeded.');
  }

  // Insert default users
  const userExists = await get("SELECT * FROM users WHERE role = 'CITIZEN' LIMIT 1");
  if (!userExists) {
    const hashedPassword = bcrypt.hashSync('user123', 10);
    await run("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)", ['user', 'user@cms.com', hashedPassword, 'CITIZEN']);
  }
  const clerkExists = await get("SELECT * FROM users WHERE role = 'CLERK' LIMIT 1");
  if (!clerkExists) {
    const hashedPassword = bcrypt.hashSync('clerk123', 10);
    await run("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)", ['clerk', 'clerk@cms.com', hashedPassword, 'CLERK']);
  }
  const judgeExists = await get("SELECT * FROM users WHERE role = 'JUDGE' LIMIT 1");
  if (!judgeExists) {
    const hashedPassword = bcrypt.hashSync('judge123', 10);
    await run("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)", ['judge', 'judge@cms.com', hashedPassword, 'JUDGE']);
  }

  const respondentExists = await get("SELECT * FROM users WHERE role = 'RESPONDENT' LIMIT 1");
  if (!respondentExists) {
    const hashedPassword = bcrypt.hashSync('resp123', 10);
    await run("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)", ['respondent', 'respondent@cms.com', hashedPassword, 'RESPONDENT']);
    console.log('Default Respondent user seeded.');
  }

  console.log('Database initialized successfully.');
}

module.exports = {
  getDb,
  run,
  get,
  all,
  initDatabase
};
