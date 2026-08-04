const express = require('express');
const { validationResult } = require('express-validator');
const router = express.Router();
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const validateCaptcha = require('../middleware/captcha');
const { authLimiter } = require('../middleware/rateLimit');
const { registerRules, loginRules, forgotPasswordRules, resetPasswordRules, profileRules, changePasswordRules, avatarRules } = require('../validators/authValidator');
const userRepository = require('../repositories/userRepository');
const passwordResetRepository = require('../repositories/passwordResetRepository');
const { sendPasswordResetEmail } = require('../services/emailService');
const { saveAvatar, removeAvatarFiles } = require('../services/avatarService');
const logger = require('../utils/logger');

const signToken = (user, rememberMe = false) => {
    const payload = {
        user: {
            id: user.id,
            isAdmin: !!user.isAdmin
        }
    };
    const expiresIn = rememberMe ? '30d' : '24h';
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

router.post('/register', authLimiter, registerRules, validate, validateCaptcha, async (req, res) => {
    const { name, email, password, phone } = req.body;

    try {
        const existingUser = await userRepository.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({ msg: 'User already exists' });
        }

        const user = await userRepository.create({ name, email, password, phone });
        logger.info('User registered', { userId: user.id, email });
        res.json({ token: signToken(user) });
    } catch (err) {
        logger.error('Register failed', { error: err.message });
        res.status(500).json({ msg: 'Server error' });
    }
});

router.post('/login', authLimiter, loginRules, validate, validateCaptcha, async (req, res) => {
    const { email, password, rememberMe } = req.body;

    try {
        const user = await userRepository.findByEmail(email);
        if (!user) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        const isMatch = await userRepository.comparePassword(user, password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        if (user.isBlocked) {
            return res.status(403).json({ msg: 'Your account has been blocked. Contact admin.' });
        }

        logger.info('User logged in', { userId: user.id });
        res.json({ token: signToken(user, Boolean(rememberMe)) });
    } catch (err) {
        logger.error('Login failed', { error: err.message });
        res.status(500).json({ msg: 'Server error' });
    }
});

router.post('/forgot-password', authLimiter, forgotPasswordRules, validate, validateCaptcha, async (req, res) => {
    const { email } = req.body;

    try {
        const user = await userRepository.findByEmail(email);
        if (!user) {
            return res.json({ msg: 'If that email exists, a reset link has been sent.' });
        }

        const resetRecord = await passwordResetRepository.createToken(user.id);
        const baseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`;
        const resetUrl = `${baseUrl}/reset-password?token=${resetRecord.token}`;

        const emailResult = await sendPasswordResetEmail({ to: user.email, resetUrl });

        const response = { msg: 'If that email exists, a reset link has been sent.' };
        if (!emailResult.sent && process.env.NODE_ENV !== 'production') {
            response.devResetUrl = resetUrl;
        }

        res.json(response);
    } catch (err) {
        logger.error('Forgot password failed', { error: err.message });
        res.status(500).json({ msg: 'Server error' });
    }
});

router.post('/reset-password', authLimiter, resetPasswordRules, validate, async (req, res) => {
    const { token, password } = req.body;

    try {
        const resetRecord = await passwordResetRepository.findValidToken(token);
        if (!resetRecord) {
            return res.status(400).json({ msg: 'Invalid or expired reset link' });
        }

        await userRepository.updatePassword(resetRecord.userId, password);
        await passwordResetRepository.markUsed(token);
        logger.info('Password reset completed', { userId: resetRecord.userId });
        res.json({ msg: 'Password updated successfully. You can now login.' });
    } catch (err) {
        logger.error('Reset password failed', { error: err.message });
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/me', auth, async (req, res) => {
    try {
        const user = await userRepository.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        if (user.isBlocked) {
            return res.status(403).json({ msg: 'Your account has been blocked.' });
        }
        res.json(userRepository.toSafeUser(user));
    } catch (err) {
        logger.error('Fetch profile failed', { error: err.message });
        res.status(500).json({ msg: 'Server error' });
    }
});

const runRules = async (req, rules) => {
    await Promise.all(rules.map((rule) => rule.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const err = new Error(errors.array()[0]?.msg || 'Validation failed');
        err.status = 400;
        throw err;
    }
};

router.post('/profile-photo', auth, async (req, res) => {
    try {
        const { avatarData } = req.body;
        if (typeof avatarData !== 'string' || !avatarData.startsWith('data:image/')) {
            return res.status(400).json({ msg: 'Image data is required' });
        }
        const avatarUrl = saveAvatar(req.user.id, avatarData);
        const user = await userRepository.updateAvatar(req.user.id, avatarUrl);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        logger.info('Avatar updated', { userId: req.user.id });
        res.json(user);
    } catch (err) {
        if (err.message?.includes('Invalid image')) {
            return res.status(400).json({ msg: err.message });
        }
        logger.error('Avatar update failed', { error: err.message });
        res.status(500).json({ msg: 'Server error' });
    }
});

router.delete('/profile-photo', auth, async (req, res) => {
    try {
        removeAvatarFiles(req.user.id);
        const user = await userRepository.clearAvatar(req.user.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        logger.info('Avatar removed', { userId: req.user.id });
        res.json(user);
    } catch (err) {
        logger.error('Avatar remove failed', { error: err.message });
        res.status(500).json({ msg: 'Server error' });
    }
});

router.put('/profile', auth, async (req, res) => {
    try {
        if (req.body.removeAvatar) {
            removeAvatarFiles(req.user.id);
            const user = await userRepository.clearAvatar(req.user.id);
            if (!user) {
                return res.status(404).json({ msg: 'User not found' });
            }
            logger.info('Avatar removed', { userId: req.user.id });
            return res.json(user);
        }

        if (req.body.avatarData !== undefined) {
            const { avatarData } = req.body;
            if (typeof avatarData !== 'string' || !avatarData.startsWith('data:image/')) {
                return res.status(400).json({ msg: 'Image data is required' });
            }
            const avatarUrl = saveAvatar(req.user.id, avatarData);
            const user = await userRepository.updateAvatar(req.user.id, avatarUrl);
            if (!user) {
                return res.status(404).json({ msg: 'User not found' });
            }
            logger.info('Avatar updated', { userId: req.user.id });
            return res.json(user);
        }

        await runRules(req, profileRules);

        const payload = {};
        if (req.body.name !== undefined) payload.name = req.body.name;
        if (req.body.phone !== undefined) payload.phone = req.body.phone;
        if (req.body.theme !== undefined) payload.theme = req.body.theme;

        const user = await userRepository.updateProfile(req.user.id, payload);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        logger.info('Profile updated', { userId: req.user.id });
        res.json(user);
    } catch (err) {
        if (err.status === 400) {
            return res.status(400).json({ msg: err.message });
        }
        if (err.message?.includes('Invalid image')) {
            return res.status(400).json({ msg: err.message });
        }
        logger.error('Profile update failed', { error: err.message });
        res.status(500).json({ msg: 'Server error' });
    }
});

router.put('/avatar', auth, avatarRules, validate, async (req, res) => {
    try {
        const avatarUrl = saveAvatar(req.user.id, req.body.avatarData);
        const user = await userRepository.updateAvatar(req.user.id, avatarUrl);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        logger.info('Avatar updated', { userId: req.user.id });
        res.json(user);
    } catch (err) {
        if (err.message?.includes('Invalid image')) {
            return res.status(400).json({ msg: err.message });
        }
        logger.error('Avatar update failed', { error: err.message });
        res.status(500).json({ msg: 'Server error' });
    }
});

router.delete('/avatar', auth, async (req, res) => {
    try {
        removeAvatarFiles(req.user.id);
        const user = await userRepository.clearAvatar(req.user.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        logger.info('Avatar removed', { userId: req.user.id });
        res.json(user);
    } catch (err) {
        logger.error('Avatar remove failed', { error: err.message });
        res.status(500).json({ msg: 'Server error' });
    }
});

router.put('/change-password', auth, changePasswordRules, validate, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
        const user = await userRepository.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        const isMatch = await userRepository.comparePassword(user, currentPassword);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Current password is incorrect' });
        }

        await userRepository.updatePassword(req.user.id, newPassword);
        logger.info('Password changed', { userId: req.user.id });
        res.json({ msg: 'Password updated successfully' });
    } catch (err) {
        logger.error('Change password failed', { error: err.message });
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;
