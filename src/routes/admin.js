const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireLogin } = require('../middleware/auth');
const requireRole = require('../middleware/roleCheck');

// Get global analytics summary (Admin, Clerk, Judge can view)
router.get('/stats', requireRole(['ADMIN', 'CLERK', 'JUDGE']), async (req, res) => {
    try {
        const totalCount = await db.get('SELECT COUNT(*) as val FROM complaints WHERE status != \'Deleted\'');
        const pendingCount = await db.get("SELECT COUNT(*) as val FROM complaints WHERE status IN ('Pending', 'Filed')");
        const progressCount = await db.get("SELECT COUNT(*) as val FROM complaints WHERE status IN ('In Progress', 'Under Review', 'Scheduled')");
        const resolvedCount = await db.get("SELECT COUNT(*) as val FROM complaints WHERE status = 'Resolved'");

        // Use the permanent blob-backed filed count so the metric survives Vercel cold starts.
        // The blob counter (cms_stats.json) is incremented every time a complaint is filed
        // and is never decremented — it shows the total ever filed, even after deletions.
        // Falls back to the SQLite ledger (filed_complaints_log) on first deploy or locally.
        const permanentFiledCount = await db.getFiledCount();

        const categoryBreakdown = await db.all(
            'SELECT category, COUNT(*) as count FROM complaints GROUP BY category'
        );

        const priorityBreakdown = await db.all(
            'SELECT priority, COUNT(*) as count FROM complaints GROUP BY priority'
        );

        const recentComplaints = await db.all(
            `SELECT c.id, c.title, c.status, c.priority, c.created_at, u.username as complainant_name
       FROM complaints c
       LEFT JOIN users u ON c.user_id = u.id
       ORDER BY c.created_at DESC
       LIMIT 5`
        );

        // Format stats response
        res.json({
            summary: {
                total: totalCount.val || 0,
                // totalFiled: permanent ever-filed count from blob — survives cold starts
                totalFiled: permanentFiledCount || totalCount.val || 0,
                pending: pendingCount.val || 0,
                inProgress: progressCount.val || 0,
                resolved: resolvedCount.val || 0
            },
            categoryBreakdown,
            priorityBreakdown,
            recentComplaints
        });
    } catch (err) {
        console.error('Fetch admin stats error:', err);
        res.status(500).json({ error: 'Internal Server Error while aggregating system metrics.' });
    }
});

// Export complaints as CSV (admin only)
router.get('/export', requireRole(['ADMIN']), async (req, res) => {
    try {
        // Accept optional filters: start (YYYY-MM-DD or ISO), end (YYYY-MM-DD or ISO), status, category
        const { start, end, status, category } = req.query;
        let query = `SELECT c.id, u.username as complainant, u.email as complainant_email, c.title, c.category, c.priority, c.status, c.attachment_path, c.created_at, c.updated_at
             FROM complaints c
             LEFT JOIN users u ON c.user_id = u.id
             WHERE 1=1 `;
        const params = [];

        if (status) {
            query += ' AND c.status = ?';
            params.push(status);
        }
        if (category) {
            query += ' AND c.category = ?';
            params.push(category);
        }
        if (start) {
            // allow date-only (YYYY-MM-DD) or full ISO timestamp
            query += ' AND c.created_at >= ?';
            params.push(start);
        }
        if (end) {
            query += ' AND c.created_at <= ?';
            params.push(end);
        }

        query += ' ORDER BY c.created_at DESC';
        const rows = await db.all(query, params);

        // Determine optional includes
        const includeRemarks = req.query.includeRemarks === 'true' || req.query.includeRemarks === '1';
        const includeAttachments = req.query.includeAttachments === 'true' || req.query.includeAttachments === '1';

        // If remarks requested, fetch them per complaint and attach
        if (includeRemarks) {
            for (const r of rows) {
                const remarksRows = await db.all(
                    `SELECT r.remark, r.created_at, u.username
                     FROM remarks r
                     LEFT JOIN users u ON r.user_id = u.id
                     WHERE r.complaint_id = ?
                     ORDER BY r.created_at ASC`,
                    [r.id]
                );
                // Format as: username (date): remark  ||| username2 (date): remark2
                r.remarks = remarksRows.map(x => `${x.username} (${x.created_at}): ${x.remark}`).join(' ||| ');
            }
        }

        // Build CSV headers dynamically
        const headers = ['ID', 'Complainant', 'Complainant Email', 'Title', 'Category', 'Priority', 'Status', 'Created At', 'Updated At'];
        if (includeAttachments) headers.splice(7, 0, 'Attachment'); // insert before dates
        if (includeRemarks) headers.push('Remarks');

        const escape = (v) => '"' + String(v || '').replace(/"/g, '""') + '"';

        const csv = [headers.join(',')].concat(rows.map(r => {
            const base = [r.id, r.complainant, r.complainant_email, r.title, r.category, r.priority, r.status];
            if (includeAttachments) base.push(r.attachment_path);
            base.push(r.created_at, r.updated_at);
            if (includeRemarks) base.push(r.remarks || '');
            return base.map(escape).join(',');
        })).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="complaints_export.csv"');
        res.send(csv);
    } catch (err) {
        console.error('Export CSV error:', err);
        res.status(500).json({ error: 'Internal Server Error while exporting complaints.' });
    }
});

// GET /api/admin/users
router.get('/users', requireRole(['ADMIN']), async (req, res) => {
    try {
        const users = await db.all('SELECT id, username, email, role, created_at FROM users');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users.' });
    }
});

// PATCH /api/admin/users/:id/role
router.patch('/users/:id/role', requireRole(['ADMIN']), async (req, res) => {
    const { role } = req.body;
    const userId = req.params.id;
    if (!role) return res.status(400).json({ error: 'Role is required' });

    try {
        // Simple update role
        await db.run('UPDATE users SET role = ? WHERE id = ?', [role.toUpperCase(), userId]);
        res.json({ message: 'User role updated successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update user role.' });
    }
});

// GET /api/admin/debug-blob  — Admin-only endpoint to diagnose Vercel Blob connectivity.
// Hit this on the live Vercel URL to see the real blob error from inside the serverless runtime.
router.get('/debug-blob', requireRole(['ADMIN']), async (req, res) => {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
        return res.status(500).json({
            status: 'error',
            message: 'BLOB_READ_WRITE_TOKEN is NOT set in this environment.',
            hint: 'Go to Vercel project → Settings → Environment Variables and add a valid BLOB_READ_WRITE_TOKEN from your Blob store.',
            complaints_count: 0
        });
    }

    try {
        const { list: blobList } = require('@vercel/blob');
        const { blobs } = await blobList({ prefix: 'cms_complaints.json', limit: 10 });
        const blobInfo = blobs.find(b => b.pathname === 'cms_complaints.json') || null;

        if (!blobInfo) {
            // Blob doesn't exist yet — create it
            const { put } = require('@vercel/blob');
            await put('cms_complaints.json', JSON.stringify([]), {
                access: 'public',
                addRandomSuffix: false,
                contentType: 'application/json',
                cacheControlMaxAge: 0
            });
            return res.json({
                status: 'initialized',
                message: 'cms_complaints.json did not exist. Created an empty one with public access.',
                complaints_count: 0
            });
        }

        // Fetch and parse the blob
        const fetchRes = await fetch(blobInfo.downloadUrl + '?t=' + Date.now());
        const data = fetchRes.ok ? await fetchRes.json() : null;

        return res.json({
            status: 'ok',
            blob_url: blobInfo.downloadUrl?.substring(0, 60) + '...',
            blob_size_bytes: blobInfo.size,
            fetch_status: fetchRes.status,
            complaints_count: Array.isArray(data) ? data.length : 'parse error',
            sample: Array.isArray(data) ? data.slice(0, 2).map(c => ({ id: c.id, title: c.title, status: c.status })) : null
        });
    } catch (err) {
        return res.status(500).json({
            status: 'error',
            message: err.message,
            type: err.constructor?.name,
            hint: err.message?.includes('BlobStoreNotFound')
                ? 'Your BLOB_READ_WRITE_TOKEN points to a Blob store that no longer exists. Re-link the Blob store in the Vercel dashboard under Storage → Blob, and update the env variable.'
                : 'Check Vercel logs for more details.'
        });
    }
});

module.exports = router;
