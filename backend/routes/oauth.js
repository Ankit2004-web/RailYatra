const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const oauthService = require('../services/oauthService');

router.post('/google', [
    body('idToken').notEmpty()
], validate, async (req, res) => {
    try {
        const result = await oauthService.verifyGoogleToken(req.body.idToken);
        res.json(result);
    } catch (err) {
        res.status(400).json({ msg: err.message || 'Google login failed' });
    }
});

router.post('/facebook', [
    body('accessToken').notEmpty()
], validate, async (req, res) => {
    try {
        const result = await oauthService.verifyFacebookToken(req.body.accessToken);
        res.json(result);
    } catch (err) {
        res.status(400).json({ msg: err.message || 'Facebook login failed' });
    }
});

router.post('/dev', [
    body('provider').isIn(['google', 'facebook']),
    body('email').optional().isEmail()
], validate, async (req, res) => {
    try {
        const result = req.body.provider === 'google'
            ? await oauthService.verifyGoogleToken(req.body.email || 'dev@gmail.com')
            : await oauthService.verifyFacebookToken('dev-token');
        res.json(result);
    } catch (err) {
        res.status(400).json({ msg: err.message || 'Social login failed' });
    }
});

module.exports = router;
