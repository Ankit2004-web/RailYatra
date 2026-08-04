const express = require('express');
const router = express.Router();
const liveTrainService = require('../services/liveTrainService');

router.get('/', async (req, res) => {
    try {
        const results = await liveTrainService.searchLiveTrains(req.query.q);
        res.json(results);
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/:trainNumber', async (req, res) => {
    try {
        const status = await liveTrainService.getLiveStatusByTrainNumber(req.params.trainNumber);
        if (!status) return res.status(404).json({ msg: 'Train not found' });
        res.json(status);
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;
