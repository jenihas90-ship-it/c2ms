const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const requireRole = require('../middleware/roleCheck');

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Middleware: only RESPONDENT role allowed
const requireRespondent = requireRole(['RESPONDENT']);

/**
 * Normalise phone for comparison — treat 09XXXXXXXX and +2519XXXXXXXX as equal.
 */
function normalizePhone(phone) {
    if (!phone) return '';
    const p = String(phone).trim().replace(/\s+/g, '');
    if (p.startsWith('+251')) return '0' + p.slice(4);
    if (p.startsWith('251') && p.length > 9) return '0' + p.slice(3);
    return p;
}

/**
 * GET /api/respondent/cases
 * Returns all complaints where the logged-in user's email or phone matches
 * the respondent_email or respondent_phone stored on the complaint.
 */
router.get('/cases', requireRespondent, async (req, res) => {
    try {
        const user = await db.get('SELECT email, username FROM users WHERE id = ?', [req.session.userId]);
        if (!user) return res.status(404).json({ error: 'User not found.' });

        const userPhone = normalizePhone(user.username);

        const cases = await db.all(
            `SELECT c.*, u.username as complainant_username, u.email as complainant_email
             FROM complaints c
             JOIN users u ON c.user_id = u.id
             WHERE (c.respondent_email = ? OR c.respondent_phone = ? OR c.respondent_phone = ?)
             AND c.status != 'Deleted'
             AND (c.is_served = 1 
                  OR c.id IN (SELECT complaint_id FROM case_orders)
                  OR c.id IN (SELECT complaint_id FROM remarks WHERE user_id IN (SELECT id FROM users WHERE role IN ('ADMIN', 'CLERK', 'JUDGE', 'admin', 'clerk', 'judge')))
                  OR c.user_id IN (SELECT id FROM users WHERE role IN ('ADMIN', 'CLERK', 'JUDGE', 'admin', 'clerk', 'judge')))
             ORDER BY c.created_at DESC`,
            [user.email, user.username, userPhone]
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
        const user = await db.get('SELECT email, username FROM users WHERE id = ?', [req.session.userId]);

        const complaint = await db.get(
            `SELECT c.*, u.username as complainant_username, u.email as complainant_email
             FROM complaints c
             LEFT JOIN users u ON c.user_id = u.id
             WHERE c.id = ?`,
            [complaintId]
        );

        if (!complaint) return res.status(404).json({ error: 'Case not found.' });

        // Security: respondent can view the case if:
        // 1. Their email matches, OR
        // 2. Their username (phone) matches respondent_phone (with normalization), OR
        // 3. The case is accessible to them via the same broad logic used in the case list
        const userPhone = normalizePhone(user.username);
        const complaintPhone = normalizePhone(complaint.respondent_phone);

        const isNamed =
            (complaint.respondent_email && complaint.respondent_email === user.email) ||
            (complaint.respondent_phone && (normalizePhone(complaint.respondent_phone) === userPhone || complaint.respondent_phone === user.username));

        // Fallback: check via the same conditions as the cases list (remark from staff, or case_order, or is_served)
        let hasAccess = isNamed;
        if (!hasAccess) {
            const accessCheck = await db.get(
                `SELECT c.id FROM complaints c
                 WHERE c.id = ?
                 AND (c.respondent_email = ? OR c.respondent_phone = ? OR c.respondent_phone = ?)
                 AND (c.is_served = 1
                      OR c.id IN (SELECT complaint_id FROM case_orders)
                      OR c.id IN (SELECT complaint_id FROM remarks WHERE user_id IN (SELECT id FROM users WHERE role IN ('ADMIN','CLERK','JUDGE','admin','clerk','judge')))
                 )`,
                [complaintId, user.email, user.username, userPhone]
            );
            hasAccess = !!accessCheck;
        }

        if (!hasAccess) {
            return res.status(403).json({ error: 'You are not the named respondent on this case.' });
        }

        // Remarks / chat for this case
        const remarks = await db.all(
            `SELECT r.*, u.username, u.role
             FROM remarks r
             LEFT JOIN users u ON r.user_id = u.id
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

const notifications = require('../notifications');

/**
 * POST /api/respondent/case/:id/respond
 * Allow respondent to post a reply/remark to a case they are named in.
 */
router.post('/case/:id/respond', requireRespondent, upload.fields([{ name: 'national_id', maxCount: 1 }, { name: 'court_fee_receipt', maxCount: 1 }]), async (req, res) => {
    const complaintId = req.params.id;
    const { remark } = req.body;

    if (!remark || remark.trim() === '') {
        return res.status(400).json({ error: 'Response cannot be empty.' });
    }

    try {
        const user = await db.get('SELECT email, username FROM users WHERE id = ?', [req.session.userId]);

        const complaint = await db.get('SELECT id, respondent_email, respondent_phone, status FROM complaints WHERE id = ?', [complaintId]);
        if (!complaint) return res.status(404).json({ error: 'Case not found.' });

        if (['Resolved', 'Closed', 'Rejected'].includes(complaint.status)) {
            return res.status(403).json({ error: 'Court rules do not allow responses on inactive cases (Resolved/Closed/Rejected).' });
        }

        const userPhone = normalizePhone(user.username);
        const isNamed =
            (complaint.respondent_email && complaint.respondent_email === user.email) ||
            (complaint.respondent_phone && (normalizePhone(complaint.respondent_phone) === userPhone || complaint.respondent_phone === user.username));

        if (!isNamed) {
            return res.status(403).json({ error: 'You are not the named respondent on this case.' });
        }

        // Automatically prepend [FORMAL RESPONSE] if not already present
        let finalRemark = remark.trim();
        if (!finalRemark.startsWith('[FORMAL RESPONSE]')) {
            finalRemark = `[FORMAL RESPONSE]\n${finalRemark}`;
        }

        const result = await db.run(
            'INSERT INTO remarks (complaint_id, user_id, remark) VALUES (?, ?, ?)',
            [complaintId, req.session.userId, finalRemark]
        );

        let nationalIdPath = null;
        if (req.files && req.files.national_id && req.files.national_id.length > 0) {
            const idFile = req.files.national_id[0];
            if (idFile.buffer) {
                nationalIdPath = `data:${idFile.mimetype};base64,${idFile.buffer.toString('base64')}`;
            }
        }

        let feeReceiptPath = null;
        if (req.files && req.files.court_fee_receipt && req.files.court_fee_receipt.length > 0) {
            const feeFile = req.files.court_fee_receipt[0];
            if (feeFile.buffer) {
                feeReceiptPath = `data:${feeFile.mimetype};base64,${feeFile.buffer.toString('base64')}`;
            }
        }

        const updates = [];
        const params = [];
        if (nationalIdPath) { updates.push('respondent_national_id = ?'); params.push(nationalIdPath); }
        if (feeReceiptPath) { updates.push('respondent_fee_receipt = ?'); params.push(feeReceiptPath); }

        // Save the formal response on the complaint itself to ensure it survives Vercel cold starts
        updates.push('formal_response = ?');
        params.push(finalRemark);
        updates.push('updated_at = CURRENT_TIMESTAMP');

        await db.run(`UPDATE complaints SET ${updates.join(', ')} WHERE id = ?`, [...params, complaintId]);
        const updatedComplaint = await db.get('SELECT * FROM complaints WHERE id = ?', [complaintId]);
        if (updatedComplaint) {
            await db.syncComplaintToBlob(updatedComplaint).catch(err => console.error('Failed to sync complaint to blob:', err));
        }

        const newRemark = await db.get(
            `SELECT r.*, COALESCE(u.username, 'Anonymous') as username, u.role FROM remarks r LEFT JOIN users u ON r.user_id = u.id WHERE r.id = ?`,
            [result.id]
        );

        // Await notification email/SMS for new chat remark so Vercel does not terminate prematurely
        try {
            await notifications.notifyRemarkAdded(complaintId, remark.trim(), req.session.userId);
        } catch (notifErr) {
            console.error('notifyRemarkAdded failed:', notifErr.message || notifErr);
        }

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

/**
 * GET /api/respondent/notifications
 * Returns all SMS logs and served-complaint notices for this respondent,
 * aggregated across all their cases.
 */
router.get('/notifications', requireRespondent, async (req, res) => {
    try {
        const user = await db.get('SELECT email, username FROM users WHERE id = ?', [req.session.userId]);
        if (!user) return res.status(404).json({ error: 'User not found.' });

        const userPhone = normalizePhone(user.username);

        // Get all served cases for this respondent
        const cases = await db.all(
            `SELECT id, title, case_number, court_name, status FROM complaints
             WHERE (respondent_email = ? OR respondent_phone = ? OR respondent_phone = ?)
             AND status != 'Deleted'
             AND (is_served = 1 
                  OR id IN (SELECT complaint_id FROM case_orders)
                  OR id IN (SELECT complaint_id FROM remarks WHERE user_id IN (SELECT id FROM users WHERE role IN ('ADMIN', 'CLERK', 'JUDGE', 'admin', 'clerk', 'judge')))
                  OR user_id IN (SELECT id FROM users WHERE role IN ('ADMIN', 'CLERK', 'JUDGE', 'admin', 'clerk', 'judge')))
             ORDER BY created_at DESC`,
            [user.email, user.username, userPhone]
        );

        if (cases.length === 0) {
            return res.json({ notifications: [] });
        }

        const caseIds = cases.map(c => c.id);

        // Fetch all SMS logs for those cases
        const placeholders = caseIds.map(() => '?').join(',');
        const smsLogs = await db.all(
            `SELECT s.*, c.title as case_title, c.case_number
             FROM sms_logs s
             JOIN complaints c ON s.complaint_id = c.id
             WHERE s.complaint_id IN (${placeholders})
             ORDER BY s.created_at DESC`,
            caseIds
        ).catch(() => []);

        // Build a notification about each newly served case
        const servedNotices = cases.map(c => ({
            type: 'served',
            complaint_id: c.id,
            case_title: c.title,
            case_number: c.case_number,
            court_name: c.court_name,
            message: `You have been named as a respondent in case "${c.title}" (${c.case_number || '#' + c.id}) at ${c.court_name || 'the court'}.`,
            created_at: null
        }));

        res.json({ notifications: smsLogs, servedNotices });
    } catch (err) {
        console.error('Respondent notifications error:', err);
        res.status(500).json({ error: 'Failed to fetch notifications.' });
    }
});

module.exports = router;

