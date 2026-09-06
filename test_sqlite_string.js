const initSqlJs = require('sql.js/dist/sql-asm.js');
async function run() {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run("CREATE TABLE IF NOT EXISTS complaints (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT)");
    // Insert with string ID!
    db.run("INSERT INTO complaints (id, title) VALUES (?, ?)", ["75", "Blob complaint"]);
    try {
        const seq = db.exec("SELECT * FROM sqlite_sequence");
        console.log("sqlite_sequence:", seq.length > 0 ? seq[0].values : "empty");
    } catch (e) {
        console.log("No sqlite_sequence");
    }
}
run();
