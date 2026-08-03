const { body } = require('express-validator');

const registerRules = [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('phone').trim().notEmpty().withMessage('Phone is required').matches(/^[0-9+\-\s]{10,15}$/).withMessage('Invalid phone number'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('captchaId').notEmpty().withMessage('Captcha is required'),
    body('captchaAnswer').notEmpty().withMessage('Captcha answer is required')
];

const loginRules = [
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
    body('captchaId').notEmpty().withMessage('Captcha is required'),
    body('captchaAnswer').notEmpty().withMessage('Captcha answer is required')
];

const forgotPasswordRules = [
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
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
