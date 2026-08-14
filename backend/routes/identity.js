const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const validate = require('../middleware/validate');
const { notices, PURPOSES } = require('../utils/identityPrivacy');
const identityConsentRepository = require('../repositories/identityConsentRepository');
const identityVaultRepository = require('../repositories/identityVaultRepository');
const identityBreachService = require('../services/identityBreachService');
const logger = require('../utils/logger');

const PURPOSE_IDS = Object.keys(PURPOSES);

router.get('/notices', (req, res) => {
    res.json(notices());
});

router.get('/consents', auth, async (req, res) => {
    try {
        const rows = await identityConsentRepository.listByUser(req.user.id);
        res.json(rows);
    } catch (err) {
        logger.error('List identity consents failed', { error: err.message });
        res.status(500).json({ msg: 'Server error' });
    }
});

router.post('/consents', auth, [
    body('purpose').isIn(PURPOSE_IDS).withMessage('Unknown identity purpose'),
    body('granted').custom((value) => {
        if (value === true || value === 'true') return true;
        throw new Error('Consent must be an explicit yes — pre-ticked boxes are not allowed');
    }),
    body('documentType').optional({ values: 'falsy' }).isString()
], validate, async (req, res) => {
    try {
        const granted = req.body.granted === true || req.body.granted === 'true';
        if (!granted) {
            return res.status(400).json({ msg: 'Consent must be given with an explicit action.' });
        }
        const row = await identityConsentRepository.grant(req.user.id, {
            purpose: req.body.purpose,
            documentType: req.body.documentType || null
        });
        res.json({ msg: 'Consent recorded', consent: row });
    } catch (err) {
        logger.error('Grant identity consent failed', { error: err.message });
        res.status(500).json({ msg: 'Server error' });
    }
});

router.delete('/consents/:purpose', auth, [
    param('purpose').isIn(PURPOSE_IDS)
], validate, async (req, res) => {
    try {
        await identityConsentRepository.withdraw(req.user.id, req.params.purpose);
        if (req.params.purpose === 'saved_passenger_id') {
            await identityVaultRepository.unlinkAllForUser(req.user.id);
        }
        res.json({ msg: 'Consent withdrawn. Linked identity tokens were removed where required.' });
    } catch (err) {
        logger.error('Withdraw identity consent failed', { error: err.message });
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/vault', auth, async (req, res) => {
    try {
        const items = await identityVaultRepository.listByUser(req.user.id);
        res.json(items);
    } catch (err) {
        logger.error('List identity vault failed', { error: err.message });
        res.status(500).json({ msg: 'Server error' });
    }
});

router.delete('/vault/:token', auth, [
    param('token').isString().isLength({ min: 8, max: 80 })
], validate, async (req, res) => {
    try {
        const removed = await identityVaultRepository.unlink(req.user.id, req.params.token);
        if (!removed) {
            return res.status(404).json({ msg: 'Identity token not found' });
        }
        res.json({ msg: 'Identity unlinked' });
    } catch (err) {
        logger.error('Unlink identity vault failed', { error: err.message });
        res.status(500).json({ msg: 'Server error' });
    }
});

router.post('/breach', auth, admin, [
    body('summary').trim().isLength({ min: 10, max: 2000 }).withMessage('Incident summary is required')
], validate, async (req, res) => {
    try {
        const result = await identityBreachService.recordIncident({
            summary: req.body.summary,
            detectedAt: req.body.detectedAt,
            reportedBy: req.user.id
        });
        res.json(result);
    } catch (err) {
        logger.error('Identity breach notify failed', { error: err.message });
        res.status(500).json({ msg: 'Could not record identity incident' });
    }
});

module.exports = router;
