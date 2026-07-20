const express = require('express');
const router = express.Router();
const db = require('../db');
const requireRole = require('../middleware/roleCheck');
const notifications = require('../notifications');

// POST /api/clerk/serve
// Clerk officially serves the complaint to the respondent
router.post('/serve', requireRole(['CLERK', 'ADMIN']), async (req, res) => {
    const { complaint_id } = req.body;
    if (!complaint_id) return res.status(400).json({ error: 'Complaint ID required.' });

    try {
        await db.run('UPDATE complaints SET is_served = 1, status = \'In Progress\' WHERE id = ?', [complaint_id]);

        // Dispatch notifications now
        notifications.notifyRespondentOfComplaint(complaint_id).catch(err => console.error('notifyRespondent failed', err));

        res.json({ message: 'Complaint has been served to the respondent.' });
    } catch (err) {
        console.error('Serve complaint error:', err);
        res.status(500).json({ error: 'Failed to serve complaint.' });
    }
});

// POST /api/clerk/verify
// Clerk verifies filings and can update status or assignments
router.post('/verify', requireRole(['CLERK']), async (req, res) => {
    const { complaint_id, status, assigned_judge, priority } = req.body;
    if (!complaint_id) {
        return res.status(400).json({ error: 'Complaint ID is required' });
    }
    try {
        const updates = [];
        const params = [];
        if (status) { updates.push('status = ?'); params.push(status); }
        if (assigned_judge !== undefined) {
            updates.push('assigned_judge = ?');
            params.push(assigned_judge);
            updates.push('assignment_status = ?');
            params.push(assigned_judge ? 'Assigned to Judge' : 'Unassigned');
        }
        if (priority) { updates.push('priority = ?'); params.push(priority); }

        if (updates.length > 0) {
            params.push(complaint_id);
            await db.run(
                `UPDATE complaints SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                params
            );
        }
        res.json({ message: 'Complaint updated successfully.' });
    } catch (err) {
        console.error('Verify error:', err);
        res.status(500).json({ error: 'Failed to verify filing.' });
    }
});

// POST /api/clerk/schedule
router.post('/schedule', requireRole(['CLERK', 'JUDGE']), async (req, res) => {
    const { complaint_id, session_number, judge_name, session_date, session_time, courtroom, hearing_type } = req.body;
    if (!complaint_id || !session_date || !hearing_type) {
        return res.status(400).json({ error: 'Missing required scheduling fields.' });
    }
    try {
        const result = await db.run(
            `INSERT INTO court_sessions (complaint_id, session_number, judge_name, session_date, session_time, courtroom, hearing_type) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [complaint_id, session_number || 1, judge_name || '', session_date, session_time || '', courtroom || '', hearing_type]
        );
        res.status(201).json({ message: 'Hearing scheduled successfully.', id: result.id });
    } catch (err) {
        console.error('Schedule error:', err);
        res.status(500).json({ error: 'Failed to schedule hearing.' });
    }
});

module.exports = router;
