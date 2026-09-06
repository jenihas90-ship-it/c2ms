const initSqlJs = require('sql.js/dist/sql-asm.js');

async function run() {
    const SQL = await initSqlJs();
    const db = new SQL.Database();

    // Create table with AUTOINCREMENT
    db.run("CREATE TABLE IF NOT EXISTS complaints (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT)");

    // Explicit insert like ensureComplaintsRehydrated does
    db.run("INSERT INTO complaints (id, title) VALUES (?, ?)", [75, "Blob complaint"]);

    // Query sqlite_sequence
    try {
        const seq = db.exec("SELECT * FROM sqlite_sequence");
        console.log("sqlite_sequence:", seq.length > 0 ? seq[0].values : "empty");
    } catch (e) {
        console.log("No sqlite_sequence table yet.");
    }

    // Perform user insert like db.run does
    db.run("INSERT INTO complaints (title) VALUES (?)", ["User complaint"]);

    // Get last insert row id
    const res = db.exec("SELECT last_insert_rowid() as id");
    console.log("last_insert_rowid:", res[0].values[0][0]);

    const all = db.exec("SELECT * FROM complaints");
    console.log("Complaints table:", all[0].values);
}

run();
