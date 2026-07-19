const express = require('express');
const router = express.Router();
const db = require('../db');
const requireRole = require('../middleware/roleCheck');

// GET /api/judge/calendar
router.get('/calendar', requireRole(['JUDGE']), async (req, res) => {
    try {
        const sessions = await db.all(`
            SELECT cs.*, c.title, c.case_number 
            FROM court_sessions cs
            JOIN complaints c ON cs.complaint_id = c.id
            ORDER BY cs.session_date ASC, cs.session_time ASC
        `);
        res.json(sessions);
    } catch (err) {
        console.error('Judge calendar error:', err);
        res.status(500).json({ error: 'Failed to fetch calendar.' });
    }
});

// POST /api/judge/adjudicate
router.post('/adjudicate', requireRole(['JUDGE']), async (req, res) => {
    const { complaint_id, order_type, order_details, compensation_amount, status } = req.body;
    if (!complaint_id || !order_type || !order_details) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
        const judgeName = req.session.username;
        const orderDate = new Date().toISOString().split('T')[0];

        await db.run(
            `INSERT INTO case_orders (complaint_id, order_date, order_type, judge_name, order_details, compensation_amount) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [complaint_id, orderDate, order_type, judgeName, order_details, compensation_amount || 0]
        );

        if (status) {
            await db.run(`UPDATE complaints SET status = ? WHERE id = ?`, [status, complaint_id]);
        }

        res.json({ message: 'Judgment/Order saved successfully.' });
    } catch (err) {
        console.error('Adjudicate error:', err);
        res.status(500).json({ error: 'Failed to save order.' });
    }
});

// GET /api/judge/notes
router.get('/notes/:complaint_id', requireRole(['JUDGE']), async (req, res) => {
    try {
        const notes = await db.all(
            `SELECT * FROM case_notes WHERE complaint_id = ? ORDER BY created_at DESC`,
            [req.params.complaint_id]
        );
        res.json(notes);
    } catch (err) {
        console.error('Get notes error:', err);
        res.status(500).json({ error: 'Failed to fetch notes.' });
    }
});

// POST /api/judge/notes
router.post('/notes', requireRole(['JUDGE']), async (req, res) => {
    const { complaint_id, note_text } = req.body;
    if (!complaint_id || !note_text) {
        return res.status(400).json({ error: 'Missing fields' });
    }
    try {
        const result = await db.run(
            `INSERT INTO case_notes (complaint_id, author_id, note_text) VALUES (?, ?, ?)`,
            [complaint_id, req.session.userId, note_text]
        );
        res.status(201).json({ message: 'Note added', id: result.id });
    } catch (err) {
        console.error('Post notes error:', err);
        res.status(500).json({ error: 'Failed to save note.' });
    }
});

module.exports = router;
