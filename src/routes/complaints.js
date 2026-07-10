const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const notifications = require('../notifications');
const { requireLogin, requireAdmin } = require('../middleware/auth');

// Multer storage configuration (memory storage for serverless)
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|docx|txt/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only JPEG, PNG, GIF, PDF, DOCX, and TXT files are allowed.'));
    }
});

// File Complaint
router.post('/', requireLogin, upload.single('attachment'), async (req, res) => {
    const { title, category, court_name, case_number, parties, hearing_date, description, priority } = req.body;

    if (!title || !category || !court_name || !case_number || !description || !priority) {
        return res.status(400).json({ error: 'Title, category, court name, case number, description, and priority are required fields.' });
    }

    // Validate fields
    const validCategories = ['Civil', 'Criminal', 'Family', 'Administrative', 'Other'];
    const validPriorities = ['Low', 'Medium', 'High'];

    if (!validCategories.includes(category)) {
        return res.status(400).json({ error: 'Invalid category. Allowed: ' + validCategories.join(', ') });
    }
    if (!validPriorities.includes(priority)) {
        return res.status(400).json({ error: 'Invalid priority. Allowed: ' + validPriorities.join(', ') });
    }

    const userId = req.session.userId;
    const attachmentPath = req.file ? `/uploads/${req.file.filename}` : null;

    try {
        const result = await db.run(
            `INSERT INTO complaints (user_id, title, category, court_name, case_number, parties, hearing_date, description, priority, status, attachment_path) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Filed', ?)`,
            [userId, title, category, court_name, case_number, parties || '', hearing_date || '', description, priority, attachmentPath]
        );

        // Fire-and-forget notification (do not block response)
        notifications.notifyNewComplaint(result.id).catch(err => console.error('notifyNewComplaint failed', err));

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

    let query = `
    SELECT c.*, u.username as complainant_name 
    FROM complaints c
    JOIN users u ON c.user_id = u.id
    WHERE 1=1
  `;
    const params = [];

    // Filter by user role (Complainant sees only their own, Admin sees all)
    if (role !== 'admin') {
        query += ' AND c.user_id = ?';
        params.push(userId);
    }

    // Optional status filter
    if (status) {
        query += ' AND c.status = ?';
        params.push(status);
    }

    // Optional category filter
    if (category) {
        query += ' AND c.category = ?';
        params.push(category);
    }

    // Optional search query (matches title or description)
    if (search) {
        query += ' AND (c.title LIKE ? OR c.description LIKE ?)';
        const searchVal = `%${search}%`;
        params.push(searchVal, searchVal);
    }

    // Order by latest active
    query += ' ORDER BY c.created_at DESC';

    try {
        const list = await db.all(query, params);
        res.json(list);
    } catch (err) {
        console.error('Fetch complaints error:', err);
        res.status(500).json({ error: 'Internal Server Error while fetching complaints.' });
    }
});

// Get Complaint Details (with remarks timeline)
router.get('/:id', requireLogin, async (req, res) => {
    const complaintId = req.params.id;
    const userId = req.session.userId;
    const role = req.session.role;

    try {
        // Fetch complaint
        const complaint = await db.get(
            `SELECT c.*, u.username as complainant_name, u.email as complainant_email 
       FROM complaints c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = ?`,
            [complaintId]
        );

        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found.' });
        }

        // Authorization: User must be either admin or creator of the complaint
        if (role !== 'admin' && complaint.user_id !== userId) {
            return res.status(403).json({ error: 'Forbidden. You do not have permission to view this complaint.' });
        }

        // Fetch remarks timeline
        const remarks = await db.all(
            `SELECT r.*, u.username, u.role
       FROM remarks r
       JOIN users u ON r.user_id = u.id
       WHERE r.complaint_id = ?
       ORDER BY r.created_at ASC`,
            [complaintId]
        );

        res.json({
            complaint,
            remarks
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

        if (role !== 'admin' && complaint.user_id !== userId) {
            return res.status(403).json({ error: 'Forbidden. You do not have permission to access this attachment.' });
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

        if (role !== 'admin' && complaint.user_id !== userId) {
            return res.status(403).json({ error: 'Forbidden. You do not have permission to remark on this complaint.' });
        }

        // Insert remark
        const result = await db.run(
            'INSERT INTO remarks (complaint_id, user_id, remark) VALUES (?, ?, ?)',
            [complaintId, userId, remark.trim()]
        );

        // Fetch newly created remark with user details for immediate response
        const newRemark = await db.get(
            `SELECT r.*, u.username, u.role
       FROM remarks r
       JOIN users u ON r.user_id = u.id
       WHERE r.id = ?`,
            [result.id]
        );

        // Send notification email for new chat remark
        notifications.notifyRemarkAdded(complaintId, remark.trim(), userId).catch(err => console.error('notifyRemarkAdded failed', err));

        res.status(201).json({
            message: 'Remark added successfully!',
            remark: newRemark
        });
    } catch (err) {
        console.error('Submit remark error:', err);
        res.status(500).json({ error: 'Internal Server Error while posting remark.' });
    }
});

// Change Status/Priority (Admin Only)
router.patch('/:id/status', requireLogin, async (req, res) => {
    const complaintId = req.params.id;
    const { status, priority } = req.body;
    const role = req.session.role;

    if (role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden. Admin permission required.' });
    }

    try {
        const complaint = await db.get('SELECT id FROM complaints WHERE id = ?', [complaintId]);
        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found.' });
        }

        const updates = [];
        const params = [];

        if (status) {
            const validStatuses = ['Filed', 'Pending', 'In Progress', 'Under Review', 'Scheduled', 'Resolved', 'Rejected', 'Closed'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ error: 'Invalid status. Allowed: ' + validStatuses.join(', ') });
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

        // Notify user of status change if status was updated
        if (status) {
            notifications.notifyStatusChange(complaintId, status).catch(err => console.error('notifyStatusChange failed', err));
        }

        res.json({ message: 'Complaint updated successfully' });
    } catch (err) {
        console.error('Update complaint error:', err);
        res.status(500).json({ error: 'Internal Server Error during complaint updates.' });
    }
});

// Admin: Update core complaint fields (title, category, court fields, description, priority)
router.patch('/:id', requireAdmin, async (req, res) => {
    const complaintId = req.params.id;
    const { title, category, court_name, case_number, parties, hearing_date, description, priority } = req.body;

    try {
        const complaint = await db.get('SELECT id FROM complaints WHERE id = ?', [complaintId]);
        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found.' });
        }

        const updates = [];
        const params = [];

        if (title) {
            updates.push('title = ?');
            params.push(title);
        }
        if (category) {
            const validCategories = ['Civil', 'Criminal', 'Family', 'Administrative', 'Other'];
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

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Provide at least one field to update.' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(complaintId);

        const sql = `UPDATE complaints SET ${updates.join(', ')} WHERE id = ?`;
        await db.run(sql, params);

        res.json({ message: 'Complaint updated successfully' });
    } catch (err) {
        console.error('Admin update complaint error:', err);
        res.status(500).json({ error: 'Internal Server Error during complaint update.' });
    }
});

// Admin: Delete complaint
router.delete('/:id', requireAdmin, async (req, res) => {
    const complaintId = req.params.id;
    try {
        const complaint = await db.get('SELECT id FROM complaints WHERE id = ?', [complaintId]);
        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found.' });
        }

        await db.run('DELETE FROM complaints WHERE id = ?', [complaintId]);
        res.json({ message: 'Complaint deleted successfully' });
    } catch (err) {
        console.error('Delete complaint error:', err);
        res.status(500).json({ error: 'Internal Server Error during deletion.' });
    }
});

module.exports = router;
