const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const validate = require('../middleware/validate');
const { stationRules } = require('../validators/stationValidator');
const stationRepository = require('../repositories/stationRepository');

router.get('/search', async (req, res) => {
    const query = (req.query.q || '').trim();

    if (!query) {
        return res.json([]);
    }

    try {
        const stations = await stationRepository.search(query, req.query.limit);
        res.json(stations);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/', async (req, res) => {
    try {
        const stations = await stationRepository.findAll();
        res.json(stations);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.post('/', auth, admin, stationRules, validate, async (req, res) => {
    const { code, name, city, state } = req.body;

    try {
        const existing = await stationRepository.findByCode(code);
        if (existing) {
            return res.status(400).json({ msg: 'Station code already exists' });
        }

        const station = await stationRepository.create({ code, name, city, state });
        res.status(201).json(station);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.put('/:id', auth, admin, stationRules, validate, async (req, res) => {
    const { code, name, city, state } = req.body;

    try {
        const existing = await stationRepository.findByCode(code);
        if (existing && existing.id !== Number(req.params.id)) {
            return res.status(400).json({ msg: 'Station code already exists' });
        }

        const station = await stationRepository.update(req.params.id, { code, name, city, state });
        if (!station) {
            return res.status(404).json({ msg: 'Station not found' });
        }
        res.json(station);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/nearby/:code', async (req, res) => {
    try {
        const nearby = await stationRepository.findNearby(req.params.code);
        res.json(nearby);
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/detail/:code', async (req, res) => {
    try {
        const station = await stationRepository.findDetailByCode(req.params.code);
        if (!station) return res.status(404).json({ msg: 'Station not found' });
        res.json(station);
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/:code', async (req, res) => {
    try {
        const station = await stationRepository.findDetailByCode(req.params.code);
        if (!station) return res.status(404).json({ msg: 'Station not found' });
        res.json(station);
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

router.delete('/:id', auth, admin, async (req, res) => {
    try {
        const deleted = await stationRepository.remove(req.params.id);
        if (!deleted) {
            return res.status(404).json({ msg: 'Station not found' });
        }
        res.json({ msg: 'Station removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;
