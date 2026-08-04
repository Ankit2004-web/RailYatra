const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const validate = require('../middleware/validate');
const { updateUserRules } = require('../validators/userValidator');
const adminRepository = require('../repositories/adminRepository');
const userRepository = require('../repositories/userRepository');
const bookingRepository = require('../repositories/bookingRepository');

const refundRepository = require('../repositories/refundRepository');
const trainRepository = require('../repositories/trainRepository');
const trainStopRepository = require('../repositories/trainStopRepository');
const trainClassRepository = require('../repositories/trainClassRepository');
const stationRepository = require('../repositories/stationRepository');
const { trainStopsRules, trainClassUpdateRules, stationImportRules } = require('../validators/adminValidator');

router.use(auth, admin);

router.get('/trains', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 25));
        const result = await trainRepository.findPaginated({
            page,
            pageSize,
            search: req.query.search || '',
            trainType: req.query.trainType,
            source: req.query.source,
            destination: req.query.destination,
            status: req.query.status
        });
        res.json(result);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/trains/:id', async (req, res) => {
    try {
        const train = await trainRepository.findById(req.params.id);
        if (!train) return res.status(404).json({ msg: 'Train not found' });
        res.json(train);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/stations', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 50));
        const search = req.query.search || '';
        const result = await stationRepository.findPaginated({ page, pageSize, search });
        res.json(result);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/data-import/status', async (req, res) => {
    try {
        const { getPool } = require('../../database/connection');
        const pool = await getPool();
        const [sources, counts, segmentAllocations] = await Promise.all([
            pool.request().query(`SELECT TOP 10 * FROM DataImportSources ORDER BY importedAt DESC`),
            pool.request().query(`
                SELECT
                    (SELECT COUNT(*) FROM Stations WHERE isActive = 1) AS stations,
                    (SELECT COUNT(*) FROM Trains WHERE isActive = 1) AS trains,
                    (SELECT COUNT(*) FROM TrainStops) AS trainStops,
                    (SELECT COUNT(*) FROM TrainRunningDays WHERE runs = 1) AS runningDayRecords,
                    (SELECT COUNT(*) FROM TrainClasses WHERE isAvailable = 1) AS trainClasses,
                    (SELECT COUNT(*) FROM BookingSeatAllocations) AS segmentAllocations
            `),
            pool.request().query(`SELECT COUNT(*) AS cnt FROM BookingSeatAllocations`)
        ]);

        const reportPath = path.join(__dirname, '../../database/data/railway/RailwayDataImportReport.json');
        let lastImportReport = null;
        if (fs.existsSync(reportPath)) {
            try {
                lastImportReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
            } catch {
                lastImportReport = { error: 'Could not parse import report file' };
            }
        }

        res.json({
            latestImports: sources.recordset,
            masterDataCounts: counts.recordset[0],
            segmentBookingRecords: segmentAllocations.recordset[0]?.cnt || 0,
            lastImportReport,
            dataClassification: {
                masterData: 'Imported/static timetable data (Category A)',
                reservationSimulation: 'Seats, availability, RAC/WL (Category B — development simulation)',
                realtime: 'Not integrated (Category C — future authorized APIs)'
            },
            limitations: [
                'Running days not in DataMeet source — day filter skipped when empty',
                'Platform numbers and per-stop distance not in source',
                'Fares and live availability are simulated, not IRCTC',
                'Dataset is partial and potentially outdated (~2016 community compilation)'
            ]
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/dashboard', async (req, res) => {
    try {
        const [stats, recentBookings] = await Promise.all([
            adminRepository.getDashboardStats(),
            adminRepository.getRecentBookings(8)
        ]);

        res.json({
            stats: {
                ...stats,
                totalRevenue: Number(stats.totalRevenue || 0)
            },
            recentBookings
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/reports/revenue', async (req, res) => {
    try {
        const report = await adminRepository.getRevenueReport(req.query.from, req.query.to);
        const totalRevenue = report.reduce((sum, row) => sum + row.revenue, 0);
        res.json({ report, totalRevenue });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/reports/occupancy', async (req, res) => {
    try {
        const report = await adminRepository.getOccupancyReport();
        res.json(report);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/reports/cancellations', async (req, res) => {
    try {
        const report = await adminRepository.getCancellationReport(req.query.from, req.query.to);
        const totalCancellations = report.reduce((sum, row) => sum + row.cancellationCount, 0);
        res.json({ report, totalCancellations });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/bookings', async (req, res) => {
    try {
        const bookings = await bookingRepository.findAllFiltered({
            pnr: req.query.pnr,
            trainId: req.query.trainId,
            status: req.query.status,
            fromDate: req.query.from,
            toDate: req.query.to
        });
        res.json(bookings);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/users', async (req, res) => {
    try {
        const users = await userRepository.findAll();
        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.put('/users/:id', updateUserRules, validate, async (req, res) => {
    try {
        const userId = Number(req.params.id);
        if (userId === req.user.id && req.body.isAdmin === false) {
            return res.status(400).json({ msg: 'You cannot remove your own admin access' });
        }
        if (userId === req.user.id && req.body.isBlocked === true) {
            return res.status(400).json({ msg: 'You cannot block your own account' });
        }

        const user = await userRepository.updateUser(userId, req.body);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/reports/refunds', async (req, res) => {
    try {
        const [refunds, summary] = await Promise.all([
            refundRepository.findAll(),
            refundRepository.getSummary()
        ]);
        res.json({
            summary: {
                totalRefunds: summary.totalRefunds,
                totalRefunded: Number(summary.totalRefunded),
                totalCharges: Number(summary.totalCharges)
            },
            refunds
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/users/:id/stats', async (req, res) => {
    try {
        const userId = Number(req.params.id);
        const user = await userRepository.findById(userId);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        const stats = await userRepository.getBookingStats(userId);
        res.json({ user: userRepository.toSafeUser(user), stats });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.put('/trains/:id/stops', trainStopsRules, validate, async (req, res) => {
    try {
        const trainId = Number(req.params.id);
        const train = await trainRepository.findById(trainId);
        if (!train) {
            return res.status(404).json({ msg: 'Train not found' });
        }

        const stops = req.body.stops.map((stop, index) => ({
            stationCode: stop.stationCode || null,
            stationName: stop.stationName,
            stopOrder: stop.stopOrder || index + 1,
            arrivalTime: stop.arrivalTime || null,
            departureTime: stop.departureTime || null,
            haltMinutes: stop.haltMinutes ?? 0,
            distanceKm: stop.distanceKm ?? null
        }));

        await trainStopRepository.replaceForTrain(trainId, stops);
        const updated = await trainStopRepository.findByTrainId(trainId);
        res.json({ msg: 'Route updated', stops: updated });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.put('/train-classes/:id', trainClassUpdateRules, validate, async (req, res) => {
    try {
        const classId = Number(req.params.id);
        const existing = await trainClassRepository.findById(classId);
        if (!existing) {
            return res.status(404).json({ msg: 'Train class not found' });
        }

        const { className, price, totalSeats, availableSeats } = req.body;
        if (availableSeats > totalSeats) {
            return res.status(400).json({ msg: 'Available seats cannot exceed total seats' });
        }

        const updated = await trainClassRepository.update(classId, {
            className,
            price,
            totalSeats,
            availableSeats
        });
        res.json(updated);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.post('/stations/import', stationImportRules, validate, async (req, res) => {
    try {
        const summary = await stationRepository.createMany(req.body.stations);
        res.json({ msg: 'Import completed', ...summary });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.post('/waitlist/promote', async (req, res) => {
    const { trainId, classCode, journeyDate } = req.body;

    if (!trainId || !classCode || !journeyDate) {
        return res.status(400).json({ msg: 'trainId, classCode, and journeyDate are required' });
    }

    try {
        const booking = await bookingRepository.promoteWaitlistManually(trainId, classCode, journeyDate);
        if (!booking) {
            return res.status(404).json({ msg: 'No waitlisted booking could be promoted (no seats or waitlist empty)' });
        }
        res.json({ msg: 'Waitlisted booking promoted', booking });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.post('/rac/promote', async (req, res) => {
    const { trainId, classCode, journeyDate } = req.body;

    if (!trainId || !classCode || !journeyDate) {
        return res.status(400).json({ msg: 'trainId, classCode, and journeyDate are required' });
    }

    try {
        const booking = await bookingRepository.promoteRacManually(trainId, classCode, journeyDate);
        if (!booking) {
            return res.status(404).json({ msg: 'No RAC booking could be promoted (no seats or RAC queue empty)' });
        }
        res.json({ msg: 'RAC booking promoted to confirmed', booking });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;
