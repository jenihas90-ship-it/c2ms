const db = require('./src/db');
(async () => {
    try {
        const cases = await db.all(
            `SELECT id, title, case_number, court_name, status FROM complaints
         WHERE (respondent_email = ? OR respondent_phone = ?)
         AND (is_served = 1 OR EXISTS (SELECT 1 FROM case_orders o WHERE o.complaint_id = complaints.id))
         ORDER BY created_at DESC`,
            ['test@foo.com', 'testuser']
        );
        console.log("Success:", cases);
    } catch (e) {
        console.error("Error running query:", e.message);
    }
})();
