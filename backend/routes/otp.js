const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const userRepository = require('../repositories/userRepository');
const { createOtp, verifyOtp } = require('../services/otpService');
const { resolveRole } = require('../constants/roles');
const jwt = require('jsonwebtoken');

const signToken = (user) => jwt.sign({
    user: {
        id: user.id,
        isAdmin: !!user.isAdmin,
        role: resolveRole(user)
    }
}, process.env.JWT_SECRET, { expiresIn: '24h' });

router.post('/send', [
    body('phone').trim().notEmpty().withMessage('Phone is required')
], validate, async (req, res) => {
    try {
        const result = await createOtp(req.body.phone);
        if (result.error) return res.status(400).json({ msg: result.error });
        res.json(result);
    } catch (err) {
        res.status(500).json({ msg: 'Could not send OTP' });
    }
});

router.post('/verify-login', [
    body('phone').trim().notEmpty(),
    body('otpId').notEmpty(),
    body('otp').notEmpty()
], validate, async (req, res) => {
    try {
        const { phone, otpId, otp } = req.body;
        if (!verifyOtp(otpId, otp, phone)) {
            return res.status(400).json({ msg: 'Invalid or expired OTP' });
        }

        const user = await userRepository.findByPhone(phone);
        if (!user) {
            return res.status(404).json({ msg: 'No account found for this mobile number. Please register first.' });
        }
        if (user.isBlocked) {
            return res.status(403).json({ msg: 'Your account has been blocked.' });
        }

        res.json({ token: signToken(user) });
    } catch (err) {
        res.status(500).json({ msg: 'OTP login failed' });
    }
});

router.get('/devices', auth, async (req, res) => {
    try {
        const devices = await userRepository.listDevices(req.user.id);
        res.json(devices);
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

router.post('/devices/register', auth, [
    body('deviceLabel').trim().notEmpty()
], validate, async (req, res) => {
    try {
        const device = await userRepository.registerDevice(req.user.id, {
            deviceLabel: req.body.deviceLabel,
            userAgent: req.headers['user-agent'] || null
        });
        res.json(device);
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;
