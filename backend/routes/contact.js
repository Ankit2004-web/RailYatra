const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const validate = require('../middleware/validate');
const { contactLimiter } = require('../middleware/rateLimit');
const { sendContactEmail } = require('../services/emailService');
const logger = require('../utils/logger');

const contactRules = [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('subject').optional({ values: 'falsy' }).trim().isLength({ max: 200 }),
    body('message').trim().notEmpty().withMessage('Message is required').isLength({ max: 5000 })
];

router.post('/', contactLimiter, contactRules, validate, async (req, res) => {
    const { name, email, subject, message } = req.body;

    try {
        const result = await sendContactEmail({ name, email, subject, message });

        if (!result.sent) {
            return res.status(503).json({
                msg: 'Email is not configured yet. Please try again later or use the phone number on this page.'
            });
        }

        res.json({ msg: 'Your message has been sent. We will get back to you soon.' });
    } catch (err) {
        logger.error('Contact form failed', { error: err.message });
        res.status(500).json({ msg: 'Could not send your message. Please try again later.' });
    }
});

module.exports = router;
