const db = require('./src/db');
db.initDatabase().then(async () => {
    try {
        const result = await db.run(`INSERT INTO complaints (user_id, title, category, court_name, court_address, description, priority, status) VALUES (1, 'Test', 'Civil', 'Mock Court', 'Mock Address', 'Test', 'Medium', 'Filed')`);
        console.log('Inserted ID:', result.id);
        const row = await db.get('SELECT court_name, court_address FROM complaints WHERE id = ?', [result.id]);
        console.log('Row:', row);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
});
