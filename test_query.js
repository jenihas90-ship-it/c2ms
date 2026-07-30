const db = require('./src/db');
(async () => {
    try {
        console.log("Testing GET /api/complaints query...");
        let query1 = `
    SELECT 
        c.id, c.user_id, c.title, c.category, c.court_name, c.court_address, c.court_jurisdiction,
        c.case_number, c.plaintiff_name, c.defendant_name, c.parties, c.hearing_date, 
        c.description, c.priority, c.status, c.assignment_status, c.assigned_judge,
        c.complainant_phone, c.complainant_country, c.complainant_region, c.complainant_woreda, c.complainant_kebele, c.complainant_language,
        c.respondent_phone, c.respondent_email, c.respondent_country, c.respondent_region, c.respondent_woreda, c.respondent_kebele, c.respondent_language,
        c.clerk_language, c.judge_language, c.is_served, c.created_at, c.updated_at,
        u.username as complainant_name 
    FROM complaints c
    JOIN users u ON c.user_id = u.id
    WHERE 1=1
  `;
        await db.all(query1, []);
        console.log("Query 1 success!");

        console.log("Testing GET /api/complaints/:id queries...");
        await db.get(`SELECT c.*, u.username as complainant_name, u.email as complainant_email FROM complaints c JOIN users u ON c.user_id = u.id WHERE c.id = 1`);
        await db.all(`SELECT r.*, u.username, u.role FROM remarks r JOIN users u ON r.user_id = u.id WHERE r.complaint_id = 1 ORDER BY r.created_at ASC`);
        await db.all(`SELECT * FROM case_orders WHERE complaint_id = 1 ORDER BY created_at DESC`);
        console.log("Query 2 success!");

        console.log("Testing GET /api/admin/stats queries...");
        const stats = await db.all(`SELECT category, COUNT(*) as count FROM complaints GROUP BY category`);
        console.log("Stats success!");

        process.exit(0);
    } catch (e) {
        console.error("DB Error:", e);
        process.exit(1);
    }
})();
