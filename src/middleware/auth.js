function requireLogin(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Authentication required. Please login.' });
    }
    next();
}

module.exports = {
    requireLogin
};
