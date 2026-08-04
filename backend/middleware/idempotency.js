const idempotencyRepository = require('../repositories/idempotencyRepository');

function idempotencyMiddleware(routeKey) {
    return async (req, res, next) => {
        const key = req.headers['idempotency-key'];
        if (!key || !['POST', 'PUT', 'PATCH'].includes(req.method)) {
            return next();
        }

        const route = routeKey || req.baseUrl + req.path;
        try {
            const existing = await idempotencyRepository.find(key, route);
            if (existing) {
                const body = JSON.parse(existing.responseBody || '{}');
                return res.status(existing.statusCode).json(body);
            }
        } catch (_) {
            /* table may not exist yet */
        }

        const originalJson = res.json.bind(res);
        res.json = (body) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                idempotencyRepository.save({
                    key,
                    userId: req.user?.id,
                    route,
                    statusCode: res.statusCode,
                    responseBody: body
                }).catch(() => {});
            }
            return originalJson(body);
        };
        next();
    };
}

module.exports = idempotencyMiddleware;
