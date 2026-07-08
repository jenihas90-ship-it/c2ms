const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, '../cms.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err);
  } else {
    console.log('Connected to SQLite database at', dbPath);
  }
});

// Run query wrapped in Promise
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

// Get single row
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

// Get all rows
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
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

  // Insert default administrator if none exists
  const adminExists = await get("SELECT * FROM users WHERE role = 'admin' LIMIT 1");
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    await run(
      "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)",
      ['admin', 'admin@cms.com', hashedPassword, 'admin']
    );
    console.log('Default Admin user created: admin / admin123');
  }

  // Insert a default complainant user if none exists (for quick login/testing)
  const userExists = await get("SELECT * FROM users WHERE role = 'complainant' LIMIT 1");
  if (!userExists) {
    const hashedPassword = bcrypt.hashSync('user123', 10);
    await run(
      "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)",
      ['user', 'user@cms.com', hashedPassword, 'complainant']
    );
    console.log('Default Complainant user created: user / user123');
  }

  // Ensure complaints table includes full court case schema and additional status values.
  try {
    const row = await get("SELECT sql FROM sqlite_master WHERE type='table' AND name='complaints'");
    const complaintsSql = row && row.sql ? row.sql : '';
    const needsMigration = complaintsSql && (
      !complaintsSql.includes('Rejected') ||
      !complaintsSql.includes('case_number') ||
      !complaintsSql.includes('court_name') ||
      !complaintsSql.includes('hearing_date') ||
      !complaintsSql.includes('Filed') ||
      !complaintsSql.includes('Under Review') ||
      !complaintsSql.includes('Scheduled') ||
      !complaintsSql.includes('Closed') ||
      complaintsSql.includes("CHECK(category IN ('Billing', 'Technical', 'Facility', 'HR', 'Other'))")
    );

    if (needsMigration) {
      console.log('Migrating complaints table to court case schema...');

      await run('PRAGMA foreign_keys = OFF');

      await run(`
        CREATE TABLE IF NOT EXISTS complaints_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          category TEXT CHECK(category IN ('Civil', 'Criminal', 'Family', 'Administrative', 'Other')) NOT NULL,
          court_name TEXT NOT NULL DEFAULT '',
          case_number TEXT NOT NULL DEFAULT '',
          parties TEXT,
          hearing_date TEXT,
          description TEXT NOT NULL,
          priority TEXT CHECK(priority IN ('Low', 'Medium', 'High')) NOT NULL,
          status TEXT CHECK(status IN ('Pending', 'In Progress', 'Resolved', 'Rejected', 'Filed', 'Under Review', 'Scheduled', 'Closed')) DEFAULT 'Filed',
          attachment_path TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      await run(`
        INSERT INTO complaints_new (id, user_id, title, category, description, priority, status, attachment_path, created_at, updated_at)
        SELECT id, user_id, title, 
               CASE WHEN category IN ('Civil', 'Criminal', 'Family', 'Administrative', 'Other') THEN category ELSE 'Other' END, 
               description, 
               CASE WHEN priority IN ('Low', 'Medium', 'High') THEN priority ELSE 'Medium' END, 
               CASE WHEN status IN ('Pending', 'In Progress', 'Resolved', 'Rejected', 'Filed', 'Under Review', 'Scheduled', 'Closed') THEN status ELSE 'Filed' END, 
               attachment_path, created_at, updated_at 
        FROM complaints
      `);

      await run('DROP TABLE complaints');
      await run("ALTER TABLE complaints_new RENAME TO complaints");
      await run('PRAGMA foreign_keys = ON');

      console.log('Complaints table migration complete.');
    }
  } catch (err) {
    console.error('Complaints migration check failed:', err);
  }
}

module.exports = {
  db,
  run,
  get,
  all,
  initDatabase
};
