const db = require('./src/db');
const notifications = require('./src/notifications');
const sms = require('./src/sms');

(async () => {
    try {
        await db.initDatabase();

        // 1. Create a dummy complaint
        const res1 = await db.run(`INSERT INTO complaints (user_id, title, category, description, priority, respondent_phone) VALUES (1, 'Test Complaint', 'Civil', 'Test', 'Low', '0912345678')`);
        const complaintId = res1.id;

        // 2. Create a dummy judge user
        let judgeId;
        const existingJudge = await db.get("SELECT id FROM users WHERE role = 'JUDGE'");
        if (existingJudge) {
            judgeId = existingJudge.id;
        } else {
            const res2 = await db.run("INSERT INTO users (username, email, password, role) VALUES ('judge2', 'judge2@cms.com', 'pass', 'JUDGE')");
            judgeId = res2.id;
        }

        // 3. Call notifyRemarkAdded
        console.log('Calling notifyRemarkAdded with complaintId:', complaintId, 'judgeId:', judgeId);
        await notifications.notifyRemarkAdded(complaintId, 'This is a test remark from judge.', judgeId);
        console.log('Done.');

    } catch (e) {
        console.error(e);
    }
})();
