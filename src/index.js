require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const cookieSession = require('cookie-session');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure directories exist
const uploadDir = path.resolve(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust proxy for session cookies
app.set('trust proxy', 1);

// Session middleware — cookie-session stores data client-side in a signed cookie.
app.use(
    cookieSession({
        name: 'cms_session',
        secret: 'cms-super-secret-key-12938481',
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        secure: false,
        httpOnly: true
    })
);

// Helper: set no-cache headers so the browser never caches protected pages.
// This prevents the back button from showing a stale authenticated page after logout.
function noCache(res) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
}

// Protected HTML pages — registered BEFORE express.static so these explicit routes
// take priority and the no-store Cache-Control headers are always applied.
// This means clicking Back after logout will NOT show a cached authenticated page.
app.get(['/dashboard', '/dashboard.html'], (req, res) => {
    noCache(res);
    res.sendFile(path.resolve(__dirname, '../public/dashboard.html'));
});
app.get(['/chat', '/chat.html'], (req, res) => {
    noCache(res);
    res.sendFile(path.resolve(__dirname, '../public/chat.html'));
});
app.get(['/respondent', '/respondent.html'], (req, res) => {
    noCache(res);
    res.sendFile(path.resolve(__dirname, '../public/respondent.html'));
});

// Serve static files (JS, CSS, images, etc.) — public assets are fine to cache
app.use(express.static(path.resolve(__dirname, '../public')));

// API Routers
const authRouter = require('./routes/auth');
const complaintsRouter = require('./routes/complaints');
const adminRouter = require('./routes/admin');
const judgeRouter = require('./routes/judge');
const clerkRouter = require('./routes/clerk');
const respondentRouter = require('./routes/respondent');
const notificationsRouter = require('./routes/notifications');

app.use('/api/auth', authRouter);
app.use('/api/complaints', complaintsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/judge', judgeRouter);
app.use('/api/clerk', clerkRouter);
app.use('/api/respondent', respondentRouter);
app.use('/api/notifications', notificationsRouter);

// Fallback to serving public/index.html for UI routes
app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../public/index.html'));
});

// Initialize database then start server
db.initDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`===================================================`);
            console.log(`Complaint Management System Server running at:`);
            console.log(`http://localhost:${PORT}`);
            console.log(`Press Ctrl+C to stop.`);
            console.log(`===================================================`);
        });
    })
    .catch((err) => {
        console.error('Failed to initialize database, shutting down server...', err);
        process.exit(1);
    });
