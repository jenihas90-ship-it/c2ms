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

        // Sync served state to Vercel Blob so it persists across cold starts
        const updatedComplaint = await db.get('SELECT * FROM complaints WHERE id = ?', [complaint_id]);
        if (updatedComplaint) {
            await db.syncComplaintToBlob(updatedComplaint).catch(err =>
                console.error('[Serve] Failed to sync served complaint to blob:', err.message)
            );
        }

        // Send SMS/Telegram to respondent — this fires at the exact moment
        // the complaint becomes visible on the respondent's page (is_served = 1)
        try {
            await notifications.notifyRespondentOfComplaint(complaint_id);
        } catch (notifErr) {
            console.error('notifyRespondent failed:', notifErr.message || notifErr);
        }

        res.json({ message: 'Complaint has been served to the respondent.' });
    } catch (err) {
        console.error('Serve complaint error:', err);
        res.status(500).json({ error: 'Failed to serve complaint.' });
    }
});

// POST /api/clerk/verify
// Clerk verifies filings and can update status or assignments
router.post('/verify', requireRole(['CLERK']), async (req, res) => {
    const { complaint_id, status, assigned_judge, priority, court_fee_required, court_fee_amount, court_fee_paid, court_fee_receipt } = req.body;
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
        if (court_fee_required !== undefined) { updates.push('court_fee_required = ?'); params.push(court_fee_required ? 1 : 0); }
        if (court_fee_amount !== undefined) { updates.push('court_fee_amount = ?'); params.push(parseFloat(court_fee_amount) || 0); }
        if (court_fee_paid !== undefined) { updates.push('court_fee_paid = ?'); params.push(court_fee_paid ? 1 : 0); }
        if (court_fee_receipt !== undefined) { updates.push('court_fee_receipt = ?'); params.push(court_fee_receipt); }

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

        // Notify respondent of the newly scheduled hearing via Gmail/Telegram/in-app
        try {
            await notifications.notifySessionScheduled(complaint_id, { judge_name, session_date, session_time, courtroom, hearing_type });
        } catch (notifErr) {
            console.error('[Schedule] notifySessionScheduled failed:', notifErr.message || notifErr);
        }

        res.status(201).json({ message: 'Hearing scheduled successfully.', id: result.id });
    } catch (err) {
        console.error('Schedule error:', err);
        res.status(500).json({ error: 'Failed to schedule hearing.' });
    }
});

module.exports = router;
