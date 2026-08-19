const db = require('./src/db');
const notifications = require('./src/notifications');
const telegram = require('./src/telegram');

// Override telegram.sendMessage to capture output instead of calling real API
telegram.sendMessage = async (chatId, text) => {
    console.log(`[STUB] telegram.sendMessage called!`);
    console.log(`   -> Chat ID: ${chatId}`);
    console.log(`   -> Text: ${text.substring(0, 50)}...`);
    return { ok: true };
};

(async () => {
    try {
        console.log('Initializing DB...');
        await db.initDatabase();

        // 1. Link a phone number to telegram
        console.log('Linking phone 0912345678 to chat_id 11223344...');
        await db.syncTelegramLinkToBlob('+251912345678', '11223344');

        // Ensure local memory knows about it for the fast-path lookup
        const database = await db.getDb();
        await database.run('INSERT OR REPLACE INTO telegram_links (phone_number, chat_id) VALUES (?, ?)', ['+251912345678', '11223344']);

        // 2. We use the real /api/complaints logic indirectly by calling what complaints.js would call
        console.log('Creating mock complaint in DB...');
        const res = await db.run(`INSERT INTO complaints 
            (user_id, title, category, description, priority, respondent_phone, court_name, court_address) 
            VALUES (1, 'Test Immediate Telegram', 'Civil', 'Testing telegram', 'Medium', '0912345678', 'Test Court', 'Test Addr')`);

        console.log('Complaint created with ID:', res.id);

        // 3. THIS IS WHAT WE ADDED IN complaints.js (Line 108ish)
        console.log('\\n--- SIMULATING FILING (notifyRespondentOfComplaint) ---');
        await notifications.notifyRespondentOfComplaint(res.id);

        console.log('\\n--- SIMULATING FILING (notifyStaffNewComplaint) ---');
        await notifications.notifyStaffNewComplaint(res.id);
        console.log('--- DONE ---');

        // 4. Verify in-app notifications
        const inApp = await db.all('SELECT * FROM in_app_notifications WHERE complaint_id = ?', [res.id]);
        console.log('\\nIn-app notifications created for staff:', inApp.length);

        console.log('\\nTest Finished.');
    } catch (e) {
        console.error('Test error:', e);
    }
})();
