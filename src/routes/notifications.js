const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireLogin } = require('../middleware/auth');

// Get unread notifications for logged in user
router.get('/', requireLogin, async (req, res) => {
    const userId = req.session.userId;

    try {
        const notifications = await db.all(
            `SELECT * FROM in_app_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
            [userId]
        );
        res.json(notifications);
    } catch (err) {
        console.error('Fetch notifications error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Mark notification as read
router.patch('/:id/read', requireLogin, async (req, res) => {
    const notifId = req.params.id;
    const userId = req.session.userId;

    try {
        const notif = await db.get('SELECT id FROM in_app_notifications WHERE id = ? AND user_id = ?', [notifId, userId]);
        if (!notif) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        await db.run('UPDATE in_app_notifications SET is_read = 1 WHERE id = ?', [notifId]);
        res.json({ message: 'Marked as read' });
    } catch (err) {
        console.error('Update notification error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
