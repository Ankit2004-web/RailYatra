const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { body } = require('express-validator');
const userRepository = require('../repositories/userRepository');
const mfaService = require('../services/mfaService');
const jwt = require('jsonwebtoken');
const { resolveRole } = require('../constants/roles');

const signToken = (user) => jwt.sign({
    user: { id: user.id, isAdmin: !!user.isAdmin, role: resolveRole(user) }
}, process.env.JWT_SECRET, { expiresIn: '24h' });

router.post('/setup', auth, async (req, res) => {
    try {
        const user = await userRepository.findById(req.user.id);
        const secret = mfaService.generateSecret();
        await userRepository.setMfaSecret(user.id, secret);
        res.json({
            secret,
            otpauthUrl: mfaService.getOtpAuthUrl(user.email, secret)
        });
    } catch (err) {
        res.status(500).json({ msg: 'Could not start MFA setup' });
    }
});

router.post('/enable', auth, [
    body('token').notEmpty()
], validate, async (req, res) => {
    try {
        const user = await userRepository.findById(req.user.id);
        if (!user?.mfaSecret) return res.status(400).json({ msg: 'Run MFA setup first' });
        if (!mfaService.verifyToken(user.mfaSecret, req.body.token)) {
            return res.status(400).json({ msg: 'Invalid verification code' });
        }
        await userRepository.setMfaEnabled(user.id, true);
        res.json({ msg: 'Two-factor authentication enabled' });
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

router.post('/disable', auth, [
    body('token').notEmpty()
], validate, async (req, res) => {
    try {
        const user = await userRepository.findById(req.user.id);
        if (!mfaService.verifyToken(user.mfaSecret, req.body.token)) {
            return res.status(400).json({ msg: 'Invalid verification code' });
        }
        await userRepository.setMfaEnabled(user.id, false);
        await userRepository.setMfaSecret(user.id, null);
        res.json({ msg: 'Two-factor authentication disabled' });
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

router.post('/verify', [
    body('mfaToken').notEmpty(),
    body('pendingToken').notEmpty()
], validate, async (req, res) => {
    try {
        const payload = jwt.verify(req.body.pendingToken, process.env.JWT_SECRET);
        if (!payload.mfaPending) return res.status(400).json({ msg: 'Invalid pending session' });
        const user = await userRepository.findById(payload.user.id);
        if (!user || !mfaService.verifyToken(user.mfaSecret, req.body.mfaToken)) {
            return res.status(400).json({ msg: 'Invalid MFA code' });
        }
        res.json({ token: signToken(user) });
    } catch (err) {
        res.status(400).json({ msg: 'MFA verification failed' });
    }
});

module.exports = router;
