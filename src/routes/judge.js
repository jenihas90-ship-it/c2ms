const express = require('express');
const router = express.Router();
const db = require('../db');
const requireRole = require('../middleware/roleCheck');
const notifications = require('../notifications');
const sms = require('../sms');

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

// GET /api/judge/sms-preview
// Returns an AI-generated SMS preview for the judge to review before issuing judgment.
// Query params: complaint_id, order_type, order_details
router.get('/sms-preview', requireRole(['JUDGE']), async (req, res) => {
    const { complaint_id, order_type, order_details } = req.query;

    if (!complaint_id || !order_type || !order_details) {
        return res.status(400).json({ error: 'complaint_id, order_type, and order_details are required.' });
    }

    try {
        const complaint = await db.get('SELECT * FROM complaints WHERE id = ?', [complaint_id]);
        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found.' });
        }

        if (!complaint.respondent_phone) {
            return res.json({
                sms: null,
                phone: null,
                note: 'No respondent phone number is on file for this complaint. SMS will be skipped.'
            });
        }

        // Generate AI SMS content (Gemini or fallback template)
        const messageText = await sms.generateSmsContent(complaint, order_details, order_type);

        res.json({
            sms: messageText,
            phone: complaint.respondent_phone,
            respondent: complaint.defendant_name || 'Respondent',
            aiGenerated: !!process.env.GEMINI_API_KEY
        });
    } catch (err) {
        console.error('SMS preview error:', err);
        res.status(500).json({ error: 'Failed to generate SMS preview.' });
    }
});

// POST /api/judge/adjudicate
router.post('/adjudicate', requireRole(['JUDGE']), async (req, res) => {
    const { complaint_id, order_type, order_details, compensation_amount, status, custom_sms_text } = req.body;
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

        // Add a system remark for the timeline
        await db.run(
            `INSERT INTO remarks (complaint_id, user_id, remark) VALUES (?, ?, ?)`,
            [complaint_id, req.session.userId, `[System Notice] Judgment / Order Issued (${order_type}):\n${order_details}`]
        );

        // Fire-and-forget: AI-generated SMS to respondent
        notifications.notifyRespondentJudgmentSms(complaint_id, order_details, order_type, custom_sms_text)
            .then(result => {
                if (result.success) {
                    console.log(`[AI SMS] Judgment SMS dispatched to ${result.phone}`);
                } else {
                    console.log('[AI SMS] SMS skipped:', result.error);
                }
            })
            .catch(err => console.error('[AI SMS] Dispatch failed:', err.message || err));

        res.json({ message: 'Judgment/Order saved successfully. SMS notification dispatched to respondent.' });
    } catch (err) {
        console.error('Adjudicate error:', err);
        res.status(500).json({ error: 'Failed to save order.' });
    }
});

// GET /api/judge/notes/:complaint_id
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
