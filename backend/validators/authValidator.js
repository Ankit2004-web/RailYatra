const { body } = require('express-validator');

const registerRules = [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
    body('email').optional({ values: 'falsy' }).trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('phone').optional({ values: 'falsy' }).trim().custom((value) => {
        if (!value) return true;
        const input = String(value).trim();
        if (input.includes('@')) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) {
                throw new Error('Invalid email address');
            }
            return true;
        }
        if (!/^[0-9+\-\s]{10,15}$/.test(input)) {
            throw new Error('Invalid mobile number');
        }
        return true;
    }),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('captchaId').notEmpty().withMessage('Captcha is required'),
    body('captchaAnswer').notEmpty().withMessage('Captcha answer is required'),
    body().custom((_, { req }) => {
        const loginId = String(req.body.phone || req.body.email || '').trim();
        if (!loginId) throw new Error('Mobile number or email is required');
        if (loginId.includes('@')) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginId)) {
                throw new Error('Invalid email address');
            }
        } else if (!/^[0-9+\-\s]{10,15}$/.test(loginId)) {
            throw new Error('Invalid mobile number');
        }
        return true;
    })
];

const loginRules = [
    body('phone').trim().notEmpty().withMessage('Mobile number or email is required').custom((value) => {
        const input = String(value || '').trim();
        if (input.includes('@')) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) {
                throw new Error('Invalid email address');
            }
            return true;
        }
        if (!/^[0-9+\-\s]{10,15}$/.test(input)) {
            throw new Error('Invalid mobile number');
        }
        return true;
    }),
    body('password').notEmpty().withMessage('Password is required')
];

const forgotPasswordRules = [
    body('email').optional({ values: 'falsy' }).trim().custom((value) => {
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            throw new Error('Invalid email address');
        }
        return true;
    }),
    body('phone').optional({ values: 'falsy' }).trim().custom((value) => {
        if (value && !/^[0-9+\-\s]{10,15}$/.test(value)) {
            throw new Error('Invalid mobile number');
        }
        return true;
    }),
    body().custom((_, { req }) => {
        const id = String(req.body.phone || req.body.email || '').trim();
        if (!id) throw new Error('Mobile number or email is required');
        if (id.includes('@')) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id)) throw new Error('Invalid email address');
        } else if (!/^[0-9+\-\s]{10,15}$/.test(id)) {
            throw new Error('Invalid mobile number');
        }
        return true;
    }),
    body('captchaId').notEmpty().withMessage('Captcha is required'),
    body('captchaAnswer').notEmpty().withMessage('Captcha answer is required')
];

const resetPasswordRules = [
    body('token').trim().notEmpty().withMessage('Reset token is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];

const profileRules = [
    body('name').optional({ values: 'falsy' }).trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
    body('phone').optional({ values: 'falsy' }).trim().notEmpty().withMessage('Phone is required').matches(/^[0-9+\-\s]{10,15}$/).withMessage('Invalid phone number'),
    body('theme').optional({ values: 'falsy' }).isIn(['light', 'dark', 'ocean']).withMessage('Invalid theme')
];

const avatarRules = [
    body('avatarData').notEmpty().withMessage('Image data is required')
];

const changePasswordRules = [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
];

module.exports = { registerRules, loginRules, forgotPasswordRules, resetPasswordRules, profileRules, changePasswordRules, avatarRules };
