const express = require('express');
const router = express.Router();
const fareSimulationService = require('../services/fareSimulationService');
const trainSearchService = require('../services/trainSearchService');
const trainStopRepository = require('../repositories/trainStopRepository');

/**
 * GET /api/fares/estimate
 * Fare estimate based on IRCA table + MoR Commercial Circular No. 11 of 2025.
 */
router.get('/estimate', async (req, res) => {
    const {
        trainId,
        from,
        to,
        class: classCode,
        quota,
        passengers,
        date
    } = req.query;

    if (!trainId || !from || !to || !classCode) {
        return res.status(400).json({ msg: 'trainId, from, to, and class are required' });
    }

    try {
        const fromStation = await trainSearchService.resolveStation(from);
        const toStation = await trainSearchService.resolveStation(to);
        if (!fromStation || !toStation) {
            return res.status(404).json({ msg: 'Station not found' });
        }

        const stops = await trainStopRepository.findByTrainId(trainId);
        const fromStop = stops.find((s) => s.stationId === fromStation.id || s.stationCode === fromStation.code);
        const toStop = stops.find((s) => s.stationId === toStation.id || s.stationCode === toStation.code);
        if (!fromStop || !toStop || fromStop.stopOrder >= toStop.stopOrder) {
            return res.status(400).json({ msg: 'Invalid route segment for this train' });
        }

        const distanceKm = Math.max(0, (toStop.distanceKm || 0) - (fromStop.distanceKm || 0));
        const { getPool } = require('../../database/connection');
        const pool = await getPool();
        const trainRow = await pool.request()
            .input('id', 'Int', trainId)
            .query(`SELECT t.*, tt.code AS trainTypeCode FROM Trains t
                    LEFT JOIN TrainTypes tt ON tt.id = t.trainTypeId WHERE t.id = @id`);

        const train = trainRow.recordset[0];
        if (!train) {
            return res.status(404).json({ msg: 'Train not found' });
        }

        const fare = await fareSimulationService.calculateEstimatedFare({
            trainId: Number(trainId),
            trainTypeCode: train.trainTypeCode,
            trainName: train.trainName,
            distanceKm,
            travelClassCode: classCode,
            quotaCode: quota || 'GN',
            passengerCount: Math.max(1, parseInt(passengers, 10) || 1),
            fromStationId: fromStation.id,
            toStationId: toStation.id,
            journeyDate: date || null
        });

        res.json({
            trainId: Number(trainId),
            from: fromStation.code,
            to: toStation.code,
            journeyDate: date || null,
            ...fare,
            disclaimer: 'Simulated from IRCA fare table with CC 11/2025 revision. GST, dynamic charges, and exact PRS/UTS rounding may differ.'
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;
