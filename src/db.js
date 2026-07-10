const bcrypt = require('bcryptjs');

let db = null;
let SQL = null;

// Initialize sql.js and create in-memory database
async function getDb() {
  if (db) return db;

  if (!SQL) {
    const initSqlJs = require('sql.js');
    SQL = await initSqlJs();
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
      role TEXT CHECK(role IN ('complainant', 'admin')) NOT NULL,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create Remarks Table (Discussion timeline)
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

  // Insert default administrator
  const adminExists = await get("SELECT * FROM users WHERE role = 'admin' LIMIT 1");
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    await run(
      "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)",
      ['admin', 'admin@cms.com', hashedPassword, 'admin']
    );
    console.log('Default Admin user created: admin / admin123');
  }

  // Insert a default complainant user
  const userExists = await get("SELECT * FROM users WHERE role = 'complainant' LIMIT 1");
  if (!userExists) {
    const hashedPassword = bcrypt.hashSync('user123', 10);
    await run(
      "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)",
      ['user', 'user@cms.com', hashedPassword, 'complainant']
    );
    console.log('Default Complainant user created: user / user123');
  }

  console.log('Database initialized successfully (in-memory).');
}

module.exports = {
  getDb,
  run,
  get,
  all,
  initDatabase
};
