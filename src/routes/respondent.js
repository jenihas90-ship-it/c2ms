const express = require('express');
const router = express.Router();
const db = require('../db');
const requireRole = require('../middleware/roleCheck');

// Middleware: only RESPONDENT role allowed
const requireRespondent = requireRole(['RESPONDENT']);

/**
 * GET /api/respondent/cases
 * Returns all complaints where the logged-in user's email or phone matches
 * the respondent_email or respondent_phone stored on the complaint.
 */
router.get('/cases', requireRespondent, async (req, res) => {
    try {
        const user = await db.get('SELECT email, username FROM users WHERE id = ?', [req.session.userId]);
        if (!user) return res.status(404).json({ error: 'User not found.' });

        const cases = await db.all(
            `SELECT c.*, u.username as complainant_username, u.email as complainant_email
             FROM complaints c
             JOIN users u ON c.user_id = u.id
             WHERE (c.respondent_email = ? OR c.respondent_phone = ?) AND c.is_served = 1
             ORDER BY c.created_at DESC`,
            [user.email, req.session.username]
        );

        res.json({ cases, respondentEmail: user.email });
    } catch (err) {
        console.error('Respondent cases error:', err);
        res.status(500).json({ error: 'Failed to fetch respondent cases.' });
    }
});

/**
 * GET /api/respondent/case/:id
 * Returns full details + remarks for a specific case the respondent is named in.
 */
router.get('/case/:id', requireRespondent, async (req, res) => {
    const complaintId = req.params.id;
    try {
        const user = await db.get('SELECT email FROM users WHERE id = ?', [req.session.userId]);

        const complaint = await db.get(
            `SELECT c.*, u.username as complainant_username, u.email as complainant_email
             FROM complaints c
             JOIN users u ON c.user_id = u.id
             WHERE c.id = ? AND c.is_served = 1`,
            [complaintId]
        );

        if (!complaint) return res.status(404).json({ error: 'Case not found.' });

        // Security: respondent can only view cases they are named in
        const isNamed = (complaint.respondent_email && complaint.respondent_email === user.email) ||
            (complaint.respondent_phone && complaint.respondent_phone === req.session.username);

        if (!isNamed) {
            return res.status(403).json({ error: 'You are not the named respondent on this case.' });
        }

        // Remarks / chat for this case
        const remarks = await db.all(
            `SELECT r.*, u.username, u.role
             FROM remarks r
             JOIN users u ON r.user_id = u.id
             WHERE r.complaint_id = ?
             ORDER BY r.created_at ASC`,
            [complaintId]
        );

        // Court sessions / hearings
        const sessions = await db.all(
            `SELECT * FROM court_sessions WHERE complaint_id = ? ORDER BY session_date ASC`,
            [complaintId]
        );

        // Case orders / judgments
        const orders = await db.all(
            `SELECT * FROM case_orders WHERE complaint_id = ? ORDER BY created_at DESC`,
            [complaintId]
        );

        // SMS logs sent to this respondent
        const smsLogs = await db.all(
            `SELECT * FROM sms_logs WHERE complaint_id = ? ORDER BY created_at DESC`,
            [complaintId]
        ).catch(() => []); // Non-fatal if table doesn't exist

        res.json({ complaint, remarks, sessions, orders, smsLogs });
    } catch (err) {
        console.error('Respondent case detail error:', err);
        res.status(500).json({ error: 'Failed to fetch case details.' });
    }
});

/**
 * POST /api/respondent/case/:id/respond
 * Allow respondent to post a reply/remark to a case they are named in.
 */
router.post('/case/:id/respond', requireRespondent, async (req, res) => {
    const complaintId = req.params.id;
    const { remark } = req.body;

    if (!remark || remark.trim() === '') {
        return res.status(400).json({ error: 'Response cannot be empty.' });
    }

    try {
        const user = await db.get('SELECT email FROM users WHERE id = ?', [req.session.userId]);

        const complaint = await db.get('SELECT id, respondent_email, respondent_phone FROM complaints WHERE id = ?', [complaintId]);
        if (!complaint) return res.status(404).json({ error: 'Case not found.' });

        const isNamed = (complaint.respondent_email && complaint.respondent_email === user.email) ||
            (complaint.respondent_phone && complaint.respondent_phone === req.session.username);

        if (!isNamed) {
            return res.status(403).json({ error: 'You are not the named respondent on this case.' });
        }

        const result = await db.run(
            'INSERT INTO remarks (complaint_id, user_id, remark) VALUES (?, ?, ?)',
            [complaintId, req.session.userId, remark.trim()]
        );

        const newRemark = await db.get(
            `SELECT r.*, u.username, u.role FROM remarks r JOIN users u ON r.user_id = u.id WHERE r.id = ?`,
            [result.id]
        );

        res.status(201).json({ message: 'Response submitted.', remark: newRemark });
    } catch (err) {
        console.error('Respondent respond error:', err);
        res.status(500).json({ error: 'Failed to submit response.' });
    }
});

/**
 * GET /api/respondent/profile
 * Get basic respondent profile info.
 */
router.get('/profile', requireRespondent, async (req, res) => {
    try {
        const user = await db.get('SELECT id, username, email, role, created_at FROM users WHERE id = ?', [req.session.userId]);
        if (!user) return res.status(404).json({ error: 'User not found.' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch profile.' });
    }
});

module.exports = router;
