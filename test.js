const db = require('./src/db.js');
(async () => {
    await db.initDatabase();
    console.log('Filing complaint as user1...');
    const res = await db.run("INSERT INTO complaints (user_id, title, category, description, priority, status) VALUES (2, 'Test Ticket', 'Property', 'Test desc', 'Medium', 'Filed')");
    console.log("inserted ID", res.id);
    const comp = await db.get('SELECT * FROM complaints WHERE id = ?', [res.id]);
    await db.syncComplaintToBlob(comp);

    console.log('Fetching as Clerk...');
    const list = await db.getAllComplaintsFromBlob({ role: 'CLERK' });
    console.log('Clerk can see:', list.length, 'complaints');
    console.log(list.slice(0, 1));
})().catch(console.error);
