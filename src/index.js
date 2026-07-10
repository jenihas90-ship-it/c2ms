const express = require('express');
const session = require('express-session');
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

// Session middleware configuration
app.use(
    session({
        secret: 'cms-super-secret-key-12938481', // Change in production app
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 1000 * 60 * 60 * 24, // 24 hours
            secure: false, // Set to true if running over HTTPS
            httpOnly: true
        }
    })
);

// Serve static frontend files
app.use(express.static(path.resolve(__dirname, '../public')));

// API Routers
const authRouter = require('./routes/auth');
const complaintsRouter = require('./routes/complaints');
const adminRouter = require('./routes/admin');

app.use('/api/auth', authRouter);
app.use('/api/complaints', complaintsRouter);
app.use('/api/admin', adminRouter);

// Explicit chat page route support
app.get('/chat', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../public/chat.html'));
});
app.get('/chat.html', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../public/chat.html'));
});

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
