const express = require('express');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const router = express.Router();
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const validateCaptcha = require('../middleware/captcha');
const normalizeLoginBody = require('../middleware/normalizeLoginBody');
const { authLimiter } = require('../middleware/rateLimit');
const { registerRules, loginRules, forgotPasswordRules, resetPasswordRules, profileRules, changePasswordRules, avatarRules } = require('../validators/authValidator');
const userRepository = require('../repositories/userRepository');
const passwordResetRepository = require('../repositories/passwordResetRepository');
const { sendPasswordResetEmail } = require('../services/emailService');
const { saveAvatar, removeAvatarFiles } = require('../services/avatarService');
const logger = require('../utils/logger');
const auditRepository = require('../repositories/auditRepository');
const { resolveRole } = require('../constants/roles');
const { normalizeEmail } = require('../utils/email');

function syntheticPhoneForEmail(email, attempt = 0) {
    const hash = crypto.createHash('sha256').update(`${String(email).toLowerCase()}:${attempt}`).digest('hex');
    const digits = hash.replace(/[^0-9]/g, '').slice(0, 9);
    return `8${digits.padStart(9, '0')}`;
}

async function allocateSyntheticPhone(email) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const candidate = syntheticPhoneForEmail(email, attempt);
        const existing = await userRepository.findByPhone(candidate);
        if (!existing) return candidate;
    }
    throw new Error('Could not allocate unique phone for email registration');
}

const isLocalAccountEmail = (email) => String(email || '').toLowerCase().endsWith('@railyatra.local');

const signToken = (user, rememberMe = false) => {
    const payload = {
        user: {
            id: user.id,
            isAdmin: resolveRole(user) === 'admin' || !!user.isAdmin,
            role: resolveRole(user)
        }
    };
    const expiresIn = rememberMe ? '30d' : '24h';
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

router.post('/register', authLimiter, normalizeLoginBody, registerRules, validate, validateCaptcha, async (req, res) => {
    const { name, email, password, phone } = req.body;
    const loginId = String(phone || email || '').trim();

    let resolvedEmail;
    let normalizedPhone;

    try {
        if (loginId.includes('@')) {
            resolvedEmail = normalizeEmail(loginId);
            normalizedPhone = await allocateSyntheticPhone(resolvedEmail);
        } else {
            normalizedPhone = String(loginId).replace(/\D/g, '').slice(-10);
            if (normalizedPhone.length !== 10) {
                return res.status(400).json({ msg: 'Enter a valid 10-digit mobile number' });
            }
            const existingPhone = await userRepository.findByPhone(normalizedPhone);
            if (existingPhone) {
                return res.status(400).json({ msg: 'Mobile number already registered' });
            }
            resolvedEmail = `${normalizedPhone}@railyatra.local`;
        }

        const existingUser = await userRepository.findByEmail(resolvedEmail);
        if (existingUser) {
            return res.status(400).json({ msg: loginId.includes('@') ? 'Email already registered' : 'User already exists' });
        }

        const user = await userRepository.create({ name, email: resolvedEmail, password, phone: normalizedPhone });
        logger.info('User registered', { userId: user.id, email: resolvedEmail });
        auditRepository.log({
            userId: user.id,
            action: 'auth.register',
            resource: `user:${user.id}`,
            details: { email: resolvedEmail, usedEmail: loginId.includes('@') },
            ipAddress: req.ip
        }).catch(() => {});
        res.json({ token: signToken(user) });
    } catch (err) {
        logger.error('Register failed', { error: err.message });
        res.status(500).json({ msg: 'Server error' });
    }
});

router.post('/login', authLimiter, normalizeLoginBody, loginRules, validate, validateCaptcha, async (req, res) => {
    const { phone, password, rememberMe } = req.body;
    const loginId = String(phone || '').trim();

    try {
        const user = loginId.includes('@')
            ? await userRepository.findByEmail(loginId)
            : await userRepository.findByPhone(loginId);
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

        if (user.mfaEnabled && user.mfaSecret) {
            const pendingToken = jwt.sign(
                { mfaPending: true, user: { id: user.id } },
                process.env.JWT_SECRET,
                { expiresIn: '5m' }
            );
            return res.json({ mfaRequired: true, pendingToken });
        }

        try {
            await userRepository.registerDevice(user.id, {
                deviceLabel: req.body.deviceLabel || 'Web browser',
                userAgent: req.headers['user-agent'] || null
            });
        } catch (_) { /* devices table may not exist */ }

        logger.info('User logged in', { userId: user.id });
        auditRepository.log({
            userId: user.id,
            action: 'auth.login',
            resource: `user:${user.id}`,
            details: { rememberMe: Boolean(rememberMe) },
            ipAddress: req.ip
        }).catch(() => {});
        res.json({ token: signToken(user, Boolean(rememberMe)) });
    } catch (err) {
        logger.error('Login failed', { error: err.message });
        res.status(500).json({ msg: 'Server error' });
    }
});

router.post('/forgot-password', authLimiter, normalizeLoginBody, forgotPasswordRules, validate, validateCaptcha, async (req, res) => {
    const loginId = String(req.body.phone || req.body.email || '').trim();

    try {
        const user = loginId.includes('@')
            ? await userRepository.findByEmail(loginId)
            : await userRepository.findByPhone(loginId);
        if (!user) {
            return res.json({ msg: 'If an account exists, a reset link has been sent.' });
        }

        const resetRecord = await passwordResetRepository.createToken(user.id);
        const baseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`;
        const resetUrl = `${baseUrl}/reset-password?token=${resetRecord.token}`;

        let emailResult = { sent: false, devMode: true };
        if (!isLocalAccountEmail(user.email)) {
            emailResult = await sendPasswordResetEmail({ to: user.email, resetUrl });
        }

        const response = { msg: 'If an account exists, a reset link has been sent.' };
        if ((!emailResult.sent || isLocalAccountEmail(user.email)) && process.env.NODE_ENV !== 'production') {
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
