const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const notifications = require('../notifications');
const { requireLogin } = require('../middleware/auth');
const requireRole = require('../middleware/roleCheck');

// Multer storage configuration (memory storage for serverless)
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: function (req, file, cb) {
        const allowedExts = /\.(jpeg|jpg|png|gif|pdf|docx|txt)$/i;
        const allowedMimes = /jpeg|jpg|png|gif|pdf|officedocument|msword|plain|octet-stream/;
        const extOk = allowedExts.test(file.originalname);
        const mimeOk = allowedMimes.test(file.mimetype);
        // Accept if extension is valid (browsers sometimes send generic mime types)
        if (extOk || mimeOk) {
            return cb(null, true);
        }
        cb(new Error('Only JPEG, PNG, GIF, PDF, DOCX, and TXT files are allowed.'));
    }
});

// File Complaint
router.post('/', requireLogin, upload.fields([{ name: 'attachment', maxCount: 1 }, { name: 'low_income_cert', maxCount: 1 }]), async (req, res) => {
    const {
        title, category, court_name, court_address, case_number, hearing_date, complainant_name, respondent_name, complainant_address, description,
        complainant_phone, complainant_country, complainant_region, complainant_woreda, complainant_kebele, complainant_language,
        respondent_phone, respondent_email, respondent_country, respondent_region, respondent_woreda, respondent_kebele, respondent_language
    } = req.body;

    if (!title || !category || !court_name || !court_address || !description) {
        return res.status(400).json({ error: 'Title, category, court name, court address, and description are required fields.' });
    }

    // Validate fields
    const validCategories = ['Civil', 'Criminal', 'Family', 'Property', 'Labor', 'Administrative', 'Other'];
    const priority = 'Medium'; // Default priority for citizen-filed complaints

    if (!validCategories.includes(category)) {
        return res.status(400).json({ error: 'Invalid category. Allowed: ' + validCategories.join(', ') });
    }

    const userId = req.session.userId;
    // Convert file to base64 data URI to store in memory SQLite for serverless logic
    let attachmentPath = null;
    let certPath = null;

    if (req.files) {
        if (req.files.attachment && req.files.attachment.length > 0) {
            const file = req.files.attachment[0];
            if (file.buffer) {
                attachmentPath = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
            }
        }
        if (req.files.low_income_cert && req.files.low_income_cert.length > 0) {
            const certFile = req.files.low_income_cert[0];
            if (certFile.buffer) {
                certPath = `data:${certFile.mimetype};base64,${certFile.buffer.toString('base64')}`;
            }
        }
    }
    const parties = `Complainant: ${complainant_name || 'N/A'}, Respondent: ${respondent_name || 'N/A'}`;

    try {
        const result = await db.run(
            `INSERT INTO complaints (
                user_id, title, category, court_name, court_address, case_number, hearing_date, plaintiff_name, defendant_name, parties, description, priority, status, attachment_path,
                complainant_phone, complainant_country, complainant_region, complainant_woreda, complainant_kebele, complainant_language,
                respondent_phone, respondent_email, respondent_country, respondent_region, respondent_woreda, respondent_kebele, respondent_language, court_fee_receipt
            ) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Filed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId, title, category, court_name, court_address, case_number || 'Pending Assignment', hearing_date || null, complainant_name || null, respondent_name || null, parties || null, description, priority, attachmentPath || null,
                complainant_phone || null, complainant_country || null, complainant_region || null, complainant_woreda || null, complainant_kebele || null, complainant_language || null,
                respondent_phone || null, respondent_email || null, respondent_country || null, respondent_region || null, respondent_woreda || null, respondent_kebele || null, respondent_language || null, certPath || null
            ]
        );

        // Write to the permanent ledger (append-only — never deleted, survives admin deletion)
        await db.run(
            `INSERT INTO filed_complaints_log (complaint_id, user_id, title) VALUES (?, ?, ?)`,
            [result.id, userId, title]
        ).catch(err => console.error('[Ledger] Failed to write to filed_complaints_log:', err.message));

        // Increment permanent JSON blob counter (survives Vercel cold starts)
        await db.incrementFiledCount().catch(err => console.error('[Stats] Failed to increment filed count:', err.message));

        // Sync complaint object to cms_complaints.json in Vercel Blob
        const newComplaint = await db.get('SELECT * FROM complaints WHERE id = ?', [result.id]);
        if (newComplaint) {
            await db.syncComplaintToBlob(newComplaint).catch(err => console.error('[Blob] Failed to sync new complaint:', err.message));
        }

        // Await notification so Vercel doesn't kill the background task
        await notifications.notifyNewComplaint(result.id).catch(err => console.error('notifyNewComplaint failed', err));

        // Create persistent in-app notifications for ALL staff (Clerk, Judge, Admin)
        // so they see the new complaint in their notification panel immediately
        await notifications.notifyStaffNewComplaint(result.id).catch(err => console.error('notifyStaffNewComplaint failed', err));

        res.status(201).json({
            message: 'Complaint submitted successfully!',
            complaintId: result.id
        });
    } catch (err) {
        console.error('Create complaint error:', err);
        res.status(500).json({ error: 'Internal Server Error while submitting complaint.' });
    }
});

// Get Complaints List
router.get('/', requireLogin, async (req, res) => {
    const userId = req.session.userId;
    const role = req.session.role;
    const { status, category, search } = req.query;
    const region = req.query.region || '';

    try {
        const list = await db.getAllComplaintsFromBlob({
            userId,
            role,
            status,
            category,
            region,
            search
        });
        res.json(list);
    } catch (err) {
        console.error('Fetch complaints error (blob path):', err.message || err);
        // Emergency SQLite fallback — never return a 500 to the user
        try {
            const isStaff = ['admin', 'ADMIN', 'CLERK', 'JUDGE'].includes(role);
            let query = `
                SELECT c.*, COALESCE(u.username, 'Anonymous') as complainant_name
                FROM complaints c
                LEFT JOIN users u ON c.user_id = u.id
                WHERE c.status != 'Deleted'
            `;
            const params = [];
            if (!isStaff && userId) { query += ' AND c.user_id = ?'; params.push(userId); }
            if (status) { query += ' AND c.status = ?'; params.push(status); }
            if (category) { query += ' AND c.category = ?'; params.push(category); }
            if (region) { query += ' AND c.complainant_region = ?'; params.push(region); }
            if (search) {
                query += ' AND (c.title LIKE ? OR c.description LIKE ?)';
                params.push(`%${search}%`, `%${search}%`);
            }
            query += ' ORDER BY c.created_at DESC';
            const fallbackList = await db.all(query, params);
            console.log(`[Complaints] Served ${fallbackList.length} complaints via SQLite fallback.`);
            res.json(fallbackList);
        } catch (sqlErr) {
            console.error('Fetch complaints SQLite fallback also failed:', sqlErr.message || sqlErr);
            res.status(500).json({ error: 'Internal Server Error while fetching complaints.' });
        }
    }
});

// Get Complaint Details (with remarks timeline)
router.get('/:id', requireLogin, async (req, res) => {
    const complaintId = req.params.id;
    const userId = req.session.userId;
    const role = req.session.role;

    try {
        // Fetch complaint — primary path via SQLite
        let complaint = await db.get(
            `SELECT c.*, COALESCE(u.username, 'Anonymous') as complainant_name, u.email as complainant_email 
       FROM complaints c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.id = ?`,
            [complaintId]
        );

        // Cold-start fallback: if SQLite returned null, look up from the shared blob.
        // This prevents complaints from appearing "not found" on fresh Vercel workers
        // whose in-memory SQLite hasn't been rehydrated yet.
        if (!complaint) {
            const blobComplaint = await db.getComplaintFromBlob(complaintId);
            if (blobComplaint && blobComplaint.status !== 'Deleted') {
                complaint = {
                    ...blobComplaint,
                    complainant_name: blobComplaint.complainant_name || 'Anonymous',
                    complainant_email: blobComplaint.complainant_email || ''
                };
                console.log(`[Detail] Served complaint #${complaintId} from blob (cold-start fallback).`);
            }
        }

        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found.' });
        }

        // Authorization: User must be either staff or creator of the complaint
        const isStaff = ['admin', 'ADMIN', 'CLERK', 'JUDGE'].includes(role);
        if (!isStaff && complaint.user_id !== userId) {
            return res.status(403).json({ error: 'Forbidden. You do not have permission to view this complaint.' });
        }

        // Fetch remarks timeline
        const remarks = await db.all(
            `SELECT r.*, COALESCE(u.username, 'Anonymous') as username, u.role
       FROM remarks r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.complaint_id = ?
       ORDER BY r.created_at ASC`,
            [complaintId]
        );

        // Fetch case orders
        const orders = await db.all(
            `SELECT * FROM case_orders WHERE complaint_id = ? ORDER BY created_at DESC`,
            [complaintId]
        );

        res.json({
            complaint,
            remarks,
            orders
        });
    } catch (err) {
        console.error('Fetch complaint details error:', err);
        res.status(500).json({ error: 'Internal Server Error while fetching details.' });
    }
});

// Serve uploaded attachment file for authorized users
router.get('/:id/attachment', requireLogin, async (req, res) => {
    const complaintId = req.params.id;
    const userId = req.session.userId;
    const role = req.session.role;

    try {
        const complaint = await db.get('SELECT attachment_path, user_id FROM complaints WHERE id = ?', [complaintId]);
        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found.' });
        }

        if (!complaint.attachment_path) {
            return res.status(404).json({ error: 'No attachment available for this complaint.' });
        }

        const isStaff = ['admin', 'ADMIN', 'CLERK', 'JUDGE'].includes(role);
        if (!isStaff && complaint.user_id !== userId) {
            return res.status(403).json({ error: 'Forbidden. You do not have permission to access this attachment.' });
        }

        // Check if attachment is a data URI (base64)
        if (complaint.attachment_path && complaint.attachment_path.startsWith('data:')) {
            const arr = complaint.attachment_path.split(',');
            const mimeMatch = arr[0].match(/:(.*?);/);
            if (mimeMatch && arr[1]) {
                const mime = mimeMatch[1];
                const b64 = arr[1];
                res.setHeader('Content-Type', mime);
                return res.send(Buffer.from(b64, 'base64'));
            }
        }

        const filePath = path.resolve(__dirname, '../../public', complaint.attachment_path.replace(/^\//, ''));
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Attachment file not found.' });
        }

        res.sendFile(filePath);
    } catch (err) {
        console.error('Attachment access error:', err);
        res.status(500).json({ error: 'Internal Server Error while retrieving attachment.' });
    }
});

// Post Remark (Comment) inside complaint
router.post('/:id/remarks', requireLogin, async (req, res) => {
    const complaintId = req.params.id;
    const { remark } = req.body;
    const userId = req.session.userId;
    const role = req.session.role;

    if (!remark || remark.trim() === '') {
        return res.status(400).json({ error: 'Remark content cannot be empty.' });
    }

    try {
        // Check if complaint exists and user is authorized to comment
        const complaint = await db.get('SELECT user_id FROM complaints WHERE id = ?', [complaintId]);
        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found.' });
        }

        const isStaff = ['admin', 'ADMIN', 'CLERK', 'JUDGE'].includes(role);
        if (!isStaff && complaint.user_id !== userId) {
            return res.status(403).json({ error: 'Forbidden. You do not have permission to remark on this complaint.' });
        }

        // Insert remark
        const result = await db.run(
            'INSERT INTO remarks (complaint_id, user_id, remark) VALUES (?, ?, ?)',
            [complaintId, userId, remark.trim()]
        );

        // Fetch newly created remark with user details for immediate response
        const newRemark = await db.get(
            `SELECT r.*, COALESCE(u.username, 'Anonymous') as username, u.role
       FROM remarks r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.id = ?`,
            [result.id]
        );

        // Send notification email for new chat remark (await for Vercel)
        await notifications.notifyRemarkAdded(complaintId, remark.trim(), userId).catch(err => console.error('notifyRemarkAdded failed', err));

        res.status(201).json({
            message: 'Remark added successfully!',
            remark: newRemark
        });
    } catch (err) {
        console.error('Submit remark error:', err);
        res.status(500).json({ error: 'Internal Server Error while posting remark.' });
    }
});

// Change Status/Priority (Admin and Clerk)
router.patch('/:id/status', requireRole(['ADMIN', 'CLERK']), async (req, res) => {
    const complaintId = req.params.id;
    const { status, priority } = req.body;
    const role = req.session.role;

    try {
        const complaint = await db.get('SELECT id FROM complaints WHERE id = ?', [complaintId]);
        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found.' });
        }

        const updates = [];
        const params = [];

        if (status) {
            let validStatuses = ['Filed', 'Pending', 'In Progress', 'Under Review', 'Scheduled', 'Resolved', 'Rejected', 'Closed'];
            if (role === 'CLERK') {
                validStatuses = ['Pending', 'Under Review', 'Scheduled', 'Rejected'];
            }
            if (!validStatuses.includes(status)) {
                return res.status(403).json({ error: 'Invalid status or you do not have permission to set this status.' });
            }

            // Prevent resolving/closing if respondent hasn't replied yet
            if (status === 'Resolved' || status === 'Closed') {
                const respondentReply = await db.get(`
                    SELECT r.id 
                    FROM remarks r
                    LEFT JOIN users u ON r.user_id = u.id
                    WHERE r.complaint_id = ? AND u.role = 'RESPONDENT'
                    LIMIT 1
                `, [complaintId]);

                if (!respondentReply) {
                    return res.status(400).json({
                        error: 'Cannot resolve case: The respondent has not provided a formal response or remark yet.'
                    });
                }
            }
            updates.push('status = ?');
            params.push(status);
        }

        if (priority) {
            const validPriorities = ['Low', 'Medium', 'High'];
            if (!validPriorities.includes(priority)) {
                return res.status(400).json({ error: 'Invalid priority. Allowed: ' + validPriorities.join(', ') });
            }
            updates.push('priority = ?');
            params.push(priority);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Provide at least status or priority to update.' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(complaintId); // for WHERE clause

        const sql = `UPDATE complaints SET ${updates.join(', ')} WHERE id = ?`;
        await db.run(sql, params);

        // Notify user of status change if status was updated (await for Vercel)
        if (status) {
            await notifications.notifyStatusChange(complaintId, status).catch(err => console.error('notifyStatusChange failed', err));
        }

        res.json({ message: 'Complaint updated successfully' });
    } catch (err) {
        console.error('Update complaint error:', err);
        res.status(500).json({ error: 'Internal Server Error during complaint updates.' });
    }
});

// Edit core complaint fields (Admin, Clerk, or Citizen if pending)
router.patch('/:id', requireLogin, async (req, res) => {
    const complaintId = req.params.id;
    const { title, category, court_name, court_address, case_number, parties, hearing_date, description, priority, clerk_language, judge_language } = req.body;
    const role = req.session.role;
    const userId = req.session.userId;

    try {
        const complaint = await db.get('SELECT id, user_id, status FROM complaints WHERE id = ?', [complaintId]);
        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found.' });
        }

        // RBAC logic to determine if the user can edit this complaint
        if (role === 'CITIZEN' || role === 'complainant') {
            if (complaint.user_id !== userId) {
                return res.status(403).json({ error: 'Forbidden. You can only edit your own complaints.' });
            }
            if (complaint.status !== 'Filed' && complaint.status !== 'Pending') {
                return res.status(403).json({ error: 'Forbidden. You cannot edit a complaint after it is officially accepted.' });
            }
        } else if (role === 'CLERK') {
            if (complaint.status !== 'Filed' && complaint.status !== 'Pending') {
                return res.status(403).json({ error: 'Forbidden. Clerks can only edit before judicial review.' });
            }
        } else if (role !== 'ADMIN' && role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden. You do not have permission to edit complaints.' });
        }

        const updates = [];
        const params = [];

        if (title) {
            updates.push('title = ?');
            params.push(title);
        }
        if (category) {
            const validCategories = ['Civil', 'Criminal', 'Family', 'Property', 'Labor', 'Administrative', 'Other'];
            if (!validCategories.includes(category)) {
                return res.status(400).json({ error: 'Invalid category. Allowed: ' + validCategories.join(', ') });
            }
            updates.push('category = ?');
            params.push(category);
        }
        if (court_name) {
            updates.push('court_name = ?');
            params.push(court_name);
        }
        if (court_address) {
            updates.push('court_address = ?');
            params.push(court_address);
        }
        if (case_number) {
            updates.push('case_number = ?');
            params.push(case_number);
        }
        if (parties) {
            updates.push('parties = ?');
            params.push(parties);
        }
        if (hearing_date) {
            updates.push('hearing_date = ?');
            params.push(hearing_date);
        }
        if (description) {
            updates.push('description = ?');
            params.push(description);
        }
        if (priority) {
            const validPriorities = ['Low', 'Medium', 'High'];
            if (!validPriorities.includes(priority)) {
                return res.status(400).json({ error: 'Invalid priority. Allowed: ' + validPriorities.join(', ') });
            }
            updates.push('priority = ?');
            params.push(priority);
        }
        if (clerk_language) {
            updates.push('clerk_language = ?');
            params.push(clerk_language);
        }
        if (judge_language) {
            updates.push('judge_language = ?');
            params.push(judge_language);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Provide at least one field to update.' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(complaintId);

        const sql = `UPDATE complaints SET ${updates.join(', ')} WHERE id = ?`;
        await db.run(sql, params);

        const updatedComplaint = await db.get('SELECT * FROM complaints WHERE id = ?', [complaintId]);
        if (updatedComplaint) {
            await db.syncComplaintToBlob(updatedComplaint).catch(err => console.error('[Blob] Failed to sync updated complaint:', err.message));
        }

        res.json({ message: 'Complaint updated successfully' });
    } catch (err) {
        console.error('Admin update complaint error:', err);
        res.status(500).json({ error: 'Internal Server Error during complaint update.' });
    }
});

// Admin: Delete complaint
router.delete('/:id', requireRole(['ADMIN']), async (req, res) => {
    const complaintId = req.params.id;
    try {
        const complaint = await db.get('SELECT id, created_at FROM complaints WHERE id = ?', [complaintId]);
        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found.' });
        }

        // 1-year retention check: do not allow deletion if complaint is less than 1 year old
        if (complaint.created_at) {
            const createdDate = new Date(complaint.created_at);
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            if (createdDate > oneYearAgo) {
                return res.status(403).json({ error: 'Complaints must be displayed permanently and cannot be deleted until one year has passed.' });
            }
        }

        // Soft Delete in SQLite memory
        await db.run('UPDATE complaints SET status = \'Deleted\', updated_at = CURRENT_TIMESTAMP WHERE id = ?', [complaintId]);

        // Sync the soft-deleted state to Vercel Blob explicitly
        const updatedComplaint = await db.get('SELECT * FROM complaints WHERE id = ?', [complaintId]);
        if (updatedComplaint) {
            await db.syncComplaintToBlob(updatedComplaint).catch(err => console.error('[Blob] Failed to sync soft-deleted complaint to blob:', err.message));
        }

        res.json({ success: true, message: 'Complaint legally soft-deleted' });
    } catch (err) {
        console.error('Delete complaint error:', err);
        res.status(500).json({ error: 'Internal Server Error during deletion.' });
    }
});

module.exports = router;
