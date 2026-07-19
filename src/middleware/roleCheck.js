module.exports = function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Unauthorized. Please log in.' });
        }

        const userRole = req.session.role;

        // If allowedRoles is a string, convert to array
        const rolesToCheck = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

        if (rolesToCheck.includes(userRole) || userRole === 'ADMIN') { // ADMIN usually overrides or has access
            next();
        } else {
            res.status(403).json({ error: 'Forbidden. You do not have permission to perform this action.' });
        }
    };
};
