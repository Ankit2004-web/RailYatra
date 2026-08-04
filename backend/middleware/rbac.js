const { resolveRole, ROLES } = require('../constants/roles');

const requireRole = (...allowedRoles) => (req, res, next) => {
    const role = resolveRole(req.user);
    if (allowedRoles.includes(role) || allowedRoles.includes(ROLES.ADMIN) && role === ROLES.ADMIN) {
        req.userRole = role;
        return next();
    }
    if (role === ROLES.ADMIN) {
        req.userRole = role;
        return next();
    }
    return res.status(403).json({ msg: 'You do not have permission to access this resource' });
};

const requireStaff = requireRole(
    ROLES.ADMIN,
    ROLES.BOOKING_AGENT,
    ROLES.TTE,
    ROLES.STATION_MASTER,
    ROLES.RAILWAY_STAFF,
    ROLES.CUSTOMER_SUPPORT,
    ROLES.FINANCE
);

module.exports = {
    requireRole,
    requireStaff
};
