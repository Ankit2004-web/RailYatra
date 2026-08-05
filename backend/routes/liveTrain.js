const express = require('express');
const router = express.Router();
const liveTrainService = require('../services/liveTrainService');

router.get('/', async (req, res) => {
    try {
        const results = await liveTrainService.searchLiveTrains(req.query.q, req.query.date);
        if (Array.isArray(results)) {
            return res.json({ mode: 'live', trains: results });
        }
        return res.json(results);
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ msg: err.message || 'Server error' });
    }
});

router.get('/:trainNumber', async (req, res) => {
    try {
        const status = await liveTrainService.getLiveStatusByTrainNumber(
            req.params.trainNumber,
            req.query.date
        );
        if (!status) return res.status(404).json({ msg: 'Train not found' });
        res.json(status);
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ msg: err.message || 'Server error' });
    }
});

module.exports = router;
