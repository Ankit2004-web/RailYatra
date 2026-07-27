const express = require('express');
const trainRepository = require('../repositories/trainRepository');
const coachCompositionService = require('../services/coachCompositionService');

const router = express.Router();

router.get('/:trainNo/coaches', async (req, res) => {
    try {
        const trainNo = String(req.params.trainNo).trim();
        const train = await trainRepository.findByNumber(trainNo);
        const data = await coachCompositionService.getTrainCoaches(trainNo);
        res.json({
            trainNumber: trainNo,
            trainName: train?.trainName || null,
            ...data
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/:trainNo/capacity', async (req, res) => {
    try {
        const trainNo = String(req.params.trainNo).trim();
        const train = await trainRepository.findByNumber(trainNo);
        const data = await coachCompositionService.getTrainCapacitySummary(trainNo);
        res.json({
            trainNumber: trainNo,
            trainName: train?.trainName || null,
            ...data
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/:trainNo/layout', async (req, res) => {
    try {
        const trainNo = String(req.params.trainNo).trim();
        const data = await coachCompositionService.getTrainLayout(trainNo);
        res.json(data);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;
