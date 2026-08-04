const rateLimit = require('express-rate-limit');

const tatkalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.RATE_LIMIT_TATKAL_PER_MIN || 10),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id || req.ip,
    message: {
        type: 'about:blank',
        title: 'Tatkal queue',
        status: 429,
        detail: 'High demand. Please wait and retry.',
        retryAfterSec: 60
    }
});

function tatkalGate(req, res, next) {
    const bookingType = req.body?.bookingType;
    if (bookingType === 'Tatkal') {
        return tatkalLimiter(req, res, next);
    }
    next();
}

module.exports = { tatkalGate, tatkalLimiter };
