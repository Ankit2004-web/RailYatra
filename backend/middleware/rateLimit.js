const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_API || 300),
    standardHeaders: true,
    legacyHeaders: false,
    message: { msg: 'Too many requests. Please try again later.' }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_AUTH || 20),
    standardHeaders: true,
    legacyHeaders: false,
    message: { msg: 'Too many auth attempts. Please try again later.' }
});

const bookingLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_BOOKING || 30),
    standardHeaders: true,
    legacyHeaders: false,
    message: { msg: 'Booking limit reached. Please try again later.' }
});

const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_CONTACT || 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: { msg: 'Too many contact requests. Please try again later.' }
});

module.exports = { apiLimiter, authLimiter, bookingLimiter, contactLimiter };
