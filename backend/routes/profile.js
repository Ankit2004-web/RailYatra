const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { body } = require('express-validator');
const favoriteRouteRepository = require('../repositories/favoriteRouteRepository');
const userPreferencesRepository = require('../repositories/userPreferencesRepository');
const loyaltyRepository = require('../repositories/loyaltyRepository');
const userRepository = require('../repositories/userRepository');
const { getPool } = require('../../database/connection');

router.get('/favorites', auth, async (req, res) => {
    try {
        res.json(await favoriteRouteRepository.findByUserId(req.user.id));
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

router.post('/favorites', auth, [
    body('sourceCode').trim().notEmpty(),
    body('destinationCode').trim().notEmpty()
], validate, async (req, res) => {
    try {
        const route = await favoriteRouteRepository.create({
            userId: req.user.id,
            sourceCode: req.body.sourceCode,
            destinationCode: req.body.destinationCode,
            label: req.body.label
        });
        res.status(201).json(route);
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

router.delete('/favorites/:id', auth, async (req, res) => {
    try {
        const ok = await favoriteRouteRepository.remove(req.params.id, req.user.id);
        if (!ok) return res.status(404).json({ msg: 'Not found' });
        res.json({ msg: 'Removed' });
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/preferences', auth, async (req, res) => {
    try {
        res.json(await userPreferencesRepository.findByUserId(req.user.id));
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

router.put('/preferences', auth, async (req, res) => {
    try {
        const prefs = await userPreferencesRepository.upsert(req.user.id, req.body);
        res.json(prefs);
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/loyalty', auth, async (req, res) => {
    try {
        res.json(await loyaltyRepository.ensure(req.user.id));
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/payment-methods', auth, async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('userId', 'Int', req.user.id)
            .query('SELECT * FROM SavedPaymentMethods WHERE userId = @userId ORDER BY isDefault DESC, createdAt DESC');
        res.json(result.recordset);
    } catch (err) {
        res.json([]);
    }
});

router.post('/payment-methods', auth, [
    body('type').trim().notEmpty(),
    body('label').trim().notEmpty()
], validate, async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('userId', 'Int', req.user.id)
            .input('type', 'NVarChar', req.body.type)
            .input('label', 'NVarChar', req.body.label)
            .input('last4', 'NVarChar', req.body.last4 || null)
            .input('isDefault', 'Bit', req.body.isDefault ? 1 : 0)
            .query(`INSERT INTO SavedPaymentMethods (userId, type, label, last4, isDefault)
                    OUTPUT INSERTED.* VALUES (@userId, @type, @label, @last4, @isDefault)`);
        res.status(201).json(result.recordset[0]);
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

router.delete('/payment-methods/:id', auth, async (req, res) => {
    try {
        const pool = await getPool();
        await pool.request()
            .input('id', 'Int', req.params.id)
            .input('userId', 'Int', req.user.id)
            .query('DELETE FROM SavedPaymentMethods WHERE id = @id AND userId = @userId');
        res.json({ msg: 'Removed' });
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

router.delete('/devices/:id', auth, async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('id', 'Int', req.params.id)
            .input('userId', 'Int', req.user.id)
            .query('DELETE FROM UserDevices WHERE id = @id AND userId = @userId');
        if (!result.rowsAffected[0]) return res.status(404).json({ msg: 'Device not found' });
        res.json({ msg: 'Device removed' });
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;
