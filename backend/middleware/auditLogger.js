const auditRepository = require('../repositories/auditRepository');

const auditLogger = (action, resource) => async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        if (res.statusCode < 400) {
            auditRepository.log({
                userId: req.user?.id || null,
                action,
                resource,
                details: { method: req.method, path: req.originalUrl, params: req.params, bodyKeys: Object.keys(req.body || {}) },
                ipAddress: req.ip
            }).catch(() => {});
        }
        return originalJson(body);
    };
    next();
};

module.exports = auditLogger;
