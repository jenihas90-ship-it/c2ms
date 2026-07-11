const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');

// Register endpoint
router.post('/register', async (req, res) => {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Username, email, and password are required.' });
    }

    // Validate role
    const validRoles = ['CITIZEN', 'CLERK', 'JUDGE', 'ADMIN'];
    const userRole = validRoles.includes(role?.toUpperCase()) ? role.toUpperCase() : 'CITIZEN';

    try {
        // Check if user exists
        const existingUser = await db.get(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existingUser) {
            return res.status(400).json({ error: 'Username or email already exists.' });
        }

        // Hashpassword
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Insert user
        const result = await db.run(
            'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
            [username, email, hashedPassword, userRole]
        );

        res.status(201).json({
            message: 'Account created successfully!',
            userId: result.id
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Internal Server Error during registration.' });
    }
});

// Login endpoint
router.post('/login', async (req, res) => {
    const { loginIdentifier, password } = req.body; // username or email

    if (!loginIdentifier || !password) {
        return res.status(400).json({ error: 'Username/email and password are required.' });
    }

    try {
        // Look up user
        const user = await db.get(
            'SELECT * FROM users WHERE username = ? OR email = ?',
            [loginIdentifier, loginIdentifier]
        );

        if (!user) {
            return res.status(401).json({ error: 'Invalid username/email or password.' });
        }

        // Validate password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid username/email or password.' });
        }

        // Save session details
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;

        res.json({
            message: 'Login successful!',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal Server Error during login.' });
    }
});

// Logout endpoint
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Failed to destroy session.' });
        }
        res.clearCookie('connect.sid');
        res.json({ message: 'Logout successful.' });
    });
});

// Get current user session
router.get('/me', (req, res) => {
    if (req.session && req.session.userId) {
        res.json({
            loggedIn: true,
            user: {
                id: req.session.userId,
                username: req.session.username,
                role: req.session.role
            }
        });
    } else {
        res.json({ loggedIn: false });
    }
});

module.exports = router;
