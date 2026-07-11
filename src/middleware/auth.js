function requireLogin(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Authentication required. Please login.' });
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Authentication required. Please login.' });
    }
    const isStaff = ['admin', 'ADMIN', 'CLERK', 'JUDGE'].includes(req.session.role);
    if (!isStaff) {
        return res.status(403).json({ error: 'Forbidden. Staff access required.' });
    }
    next();
}

module.exports = {
    requireLogin,
    requireAdmin
};
