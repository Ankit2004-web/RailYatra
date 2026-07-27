const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const validate = require('../middleware/validate');
const { trainRules } = require('../validators/trainValidator');
const trainRepository = require('../repositories/trainRepository');
const trainSearchService = require('../services/trainSearchService');
const trainClassRepository = require('../repositories/trainClassRepository');
const trainStopRepository = require('../repositories/trainStopRepository');
const seatRepository = require('../repositories/seatRepository');
const { getClassesForTrain } = require('../../database/seedData');
const { isTatkalEligible } = require('../utils/tatkal');

router.get('/', async (req, res) => {
    try {
        const trains = await trainRepository.findAll();
        res.json(trains);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/autocomplete', async (req, res) => {
    try {
        const trains = await trainSearchService.autocompleteTrains(req.query.q, req.query.limit);
        res.json(trains);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/search', async (req, res) => {
    const { source, destination, from, to, date, class: classCode, quota } = req.query;

    try {
        const trains = await trainSearchService.search({
            source: source || from,
            destination: destination || to,
            from,
            to,
            date,
            classCode,
            quota
        });
        res.json(trains);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/:id/route', async (req, res) => {
    try {
        const train = await trainRepository.findById(req.params.id);
        if (!train) {
            return res.status(404).json({ msg: 'Train not found' });
        }

        const stops = await trainStopRepository.findByTrainId(req.params.id);
        res.json({
            trainId: Number(req.params.id),
            trainNumber: train.trainNumber,
            trainName: train.trainName,
            source: train.source,
            destination: train.destination,
            stops: stops.map((s) => ({
                sequence: s.stopOrder,
                stationCode: s.stationCode,
                stationName: s.stationName,
                arrival: s.arrivalTime,
                departure: s.departureTime,
                arrivalDayOffset: s.arrivalDayOffset || 0,
                departureDayOffset: s.departureDayOffset || 0,
                haltMinutes: s.haltMinutes,
                distanceKm: s.distanceKm,
                isSource: s.stopOrder === 1,
                isDestination: s.stopOrder === stops.length
            }))
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/:id/seats', async (req, res) => {
    const { classCode, journeyDate } = req.query;

    if (!classCode || !journeyDate) {
        return res.status(400).json({ msg: 'classCode and journeyDate are required' });
    }

    try {
        const train = await trainRepository.findById(req.params.id);
        if (!train) {
            return res.status(404).json({ msg: 'Train not found' });
        }

        const seatMap = await seatRepository.getSeatMap(req.params.id, classCode, journeyDate);

        res.json({
            trainId: Number(req.params.id),
            classCode,
            journeyDate,
            tatkalEligible: isTatkalEligible(journeyDate),
            coachCount: seatMap.coaches?.length || 0,
            coaches: seatMap.coaches || [],
            seats: seatMap.seats || seatMap
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const train = await trainRepository.findById(req.params.id);
        if (!train) {
            return res.status(404).json({ msg: 'Train not found' });
        }
        res.json(train);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.post('/', auth, admin, trainRules, validate, async (req, res) => {
    const {
        trainNumber,
        trainName,
        source,
        destination,
        departureTime,
        arrivalTime,
        duration,
        distance,
        availableSeats,
        price,
        date,
        runningDays,
        runningStatus
    } = req.body;

    try {
        const existingTrain = await trainRepository.findByNumber(trainNumber);
        if (existingTrain) {
            return res.status(400).json({ msg: 'Train with this number already exists' });
        }

        const train = await trainRepository.create({
            trainNumber,
            trainName,
            source,
            destination,
            departureTime,
            arrivalTime,
            duration,
            distance,
            availableSeats,
            price,
            date,
            runningDays,
            runningStatus
        });

        const classes = getClassesForTrain(trainName, Number(price), availableSeats);
        await trainClassRepository.createMany(train.id, classes);

        res.status(201).json(await trainRepository.findById(train.id));
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.put('/:id', auth, admin, trainRules, validate, async (req, res) => {
    const {
        trainNumber,
        trainName,
        source,
        destination,
        departureTime,
        arrivalTime,
        duration,
        distance,
        availableSeats,
        price,
        date,
        runningDays,
        runningStatus
    } = req.body;

    try {
        const train = await trainRepository.update(req.params.id, {
            trainNumber,
            trainName,
            source,
            destination,
            departureTime,
            arrivalTime,
            duration,
            distance,
            availableSeats,
            price,
            date,
            runningDays,
            runningStatus
        });

        if (!train) {
            return res.status(404).json({ msg: 'Train not found' });
        }

        res.json(train);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.delete('/:id', auth, admin, async (req, res) => {
    try {
        const deleted = await trainRepository.remove(req.params.id);
        if (!deleted) {
            return res.status(404).json({ msg: 'Train not found' });
        }
        res.json({ msg: 'Train removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;
