const express = require('express');
const cookieSession = require('cookie-session');
const path = require('path');
const db = require('../src/db');

const app = express();

// Trust Vercel's proxy so secure cookies work
app.set('trust proxy', 1);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware — cookie-session stores data client-side in a signed cookie.
// This survives Vercel serverless cold starts with no server-side store required.
app.use(
    cookieSession({
        name: 'cms_session',
        secret: process.env.SESSION_SECRET || 'cms-super-secret-key-12938481',
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax'
    })
);

// Serve static frontend files
app.use(express.static(path.resolve(__dirname, '../public')));

// API Routers
const authRouter = require('../src/routes/auth');
const complaintsRouter = require('../src/routes/complaints');
const adminRouter = require('../src/routes/admin');
const judgeRouter = require('../src/routes/judge');
const clerkRouter = require('../src/routes/clerk');
const respondentRouter = require('../src/routes/respondent');
const notificationsRouter = require('../src/routes/notifications');

app.use('/api/auth', authRouter);
app.use('/api/complaints', complaintsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/judge', judgeRouter);
app.use('/api/clerk', clerkRouter);
app.use('/api/respondent', respondentRouter);
app.use('/api/notifications', notificationsRouter);

// Explicit page routes
app.get('/chat', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../public/chat.html'));
});
app.get('/chat.html', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../public/chat.html'));
});
app.get('/respondent', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../public/respondent.html'));
});
app.get('/respondent.html', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../public/respondent.html'));
});

// Fallback to serving public/index.html for UI routes
app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../public/index.html'));
});

// Initialize database before handling requests
let dbInitialized = false;
const originalHandler = app;

module.exports = async (req, res) => {
    if (!dbInitialized) {
        try {
            await db.initDatabase();
            dbInitialized = true;
        } catch (err) {
            console.error('Failed to initialize database:', err);
            return res.status(500).json({ error: 'Database initialization failed' });
        }
    }
    return originalHandler(req, res);
};
