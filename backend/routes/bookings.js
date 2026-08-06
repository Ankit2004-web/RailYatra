const express = require('express');
const router = express.Router();
const { getPool } = require('../../database/connection');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const validate = require('../middleware/validate');
const validateCaptcha = require('../middleware/captcha');
const { bookingLimiter } = require('../middleware/rateLimit');
const idempotencyMiddleware = require('../middleware/idempotency');
const auditLogger = require('../middleware/auditLogger');
const { tatkalGate } = require('../middleware/tatkalGate');
const { bookingRules, updateBookingRules } = require('../validators/bookingValidator');
const bookingRepository = require('../repositories/bookingRepository');
const trainRepository = require('../repositories/trainRepository');
const trainClassRepository = require('../repositories/trainClassRepository');
const trainStopRepository = require('../repositories/trainStopRepository');
const seatRepository = require('../repositories/seatRepository');
const stationRepository = require('../repositories/stationRepository');
const { isTatkalEligible, getTatkalPrice } = require('../utils/tatkal');
const { calculateBookingFare } = require('../utils/fare');
const { calculatePaymentBreakdown } = require('../utils/paymentBreakdown');
const { calculateClassFare } = require('../utils/irctcFareTable2025');
const runningDayService = require('../services/runningDayService');
const { validateAdvanceBookingDate } = require('../utils/bookingPolicy');
const {
    calculateMealTotal,
    normalizePassengerFoodPreferences,
    trainProvidesMeals
} = require('../utils/mealService');
const { persistMissingClassForBooking } = require('../services/trainClassSynthesisService');
const { VALID_QUOTAS } = require('../utils/quota');
const { generateTicketPdf, mapPassengerPnrFields } = require('../services/ticketService');

router.get('/pnr/:pnr', async (req, res) => {
    try {
        let booking = await bookingRepository.findByPnr(req.params.pnr.trim());

        if (!booking) {
            return res.status(404).json({ msg: 'No booking found for this PNR' });
        }

        if (booking.status === 'Confirmed') {
            await bookingRepository.ensureConfirmedBookingHasSeats(booking.id);
            booking = await bookingRepository.findByPnr(req.params.pnr.trim());
        }

        res.json({
            pnrNumber: booking.pnrNumber,
            status: booking.status,
            journeyDate: booking.journeyDate,
            bookingDate: booking.bookingDate,
            classCode: booking.classCode,
            className: booking.className,
            bookingType: booking.bookingType,
            paymentStatus: booking.paymentStatus,
            waitlistPosition: booking.waitlistPosition,
            quota: booking.quota,
            totalPrice: booking.totalPrice,
            grandTotal: booking.grandTotal,
            paymentBreakdown: booking.paymentBreakdown,
            boarding: booking.boarding,
            alighting: booking.alighting,
            seatNumbers: booking.seatNumbers,
            train: booking.train,
            passengers: (booking.passengers || []).map((p, index) => ({
                name: p.name,
                age: p.age,
                gender: p.gender,
                berthPreference: p.berthPreference || null,
                passengerStatus: p.passengerStatus || p.status,
                ...mapPassengerPnrFields(booking, p, index)
            }))
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/', auth, async (req, res) => {
    try {
        const bookings = await bookingRepository.findByUserId(req.user.id);
        res.json(bookings);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/all', auth, admin, async (req, res) => {
    try {
        const bookings = await bookingRepository.findAll();
        res.json(bookings);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/:id/refund-preview', auth, async (req, res) => {
    try {
        const result = await bookingRepository.getRefundPreview(
            req.params.id,
            req.user.id,
            req.user.isAdmin
        );

        if (result.error) {
            return res.status(result.status).json({ msg: result.error });
        }

        res.json(result.refund);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/:id/ticket', auth, async (req, res) => {
    try {
        const booking = await bookingRepository.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ msg: 'Booking not found' });
        }

        if (booking.user.id !== req.user.id && !req.user.isAdmin) {
            return res.status(403).json({ msg: 'Not authorized to download this ticket' });
        }

        if (booking.status !== 'Confirmed') {
            return res.status(400).json({ msg: 'E-ticket is available only for confirmed bookings' });
        }

        await bookingRepository.ensureConfirmedBookingHasSeats(booking.id);
        const ticketBooking = await bookingRepository.findById(booking.id);

        const pdfBuffer = await generateTicketPdf(ticketBooking);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="ticket-${booking.pnrNumber}.pdf"`);
        res.send(pdfBuffer);
    } catch (err) {
        console.error(err.message);
        if (err.message?.includes('seat')) {
            return res.status(400).json({ msg: err.message });
        }
        res.status(500).json({ msg: 'Server error generating ticket' });
    }
});

router.get('/:id/status', auth, async (req, res) => {
    try {
        const booking = await bookingRepository.findById(req.params.id);
        if (!booking) return res.status(404).json({ msg: 'Booking not found' });
        if (booking.user.id !== req.user.id && !req.user.isAdmin) {
            return res.status(403).json({ msg: 'Not authorized' });
        }
        res.json({
            id: booking.id,
            status: booking.status,
            paymentStatus: booking.paymentStatus,
            pnrNumber: booking.pnrNumber,
            paymentHoldExpiresAt: booking.paymentHoldExpiresAt
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/:id', auth, async (req, res) => {
    try {
        const booking = await bookingRepository.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ msg: 'Booking not found' });
        }

        if (booking.user.id !== req.user.id && !req.user.isAdmin) {
            return res.status(403).json({ msg: 'Not authorized to view this booking' });
        }

        res.json(booking);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.post('/', auth, bookingLimiter, idempotencyMiddleware('/api/bookings'), tatkalGate, bookingRules, validate, validateCaptcha, auditLogger('booking.create', 'booking'), async (req, res) => {
    const {
        trainId,
        passengers,
        journeyDate,
        classCode,
        seatNumbers,
        bookingType = 'General',
        joinWaitlist = false,
        joinRac = false,
        quota = 'General',
        fromStopSequence,
        toStopSequence,
        fromStationId,
        toStationId,
        fromStationCode,
        toStationCode
    } = req.body;

    try {
        const train = await trainRepository.findById(trainId);
        if (!train) {
            return res.status(404).json({ msg: 'Train not found' });
        }

        let resolvedFromStationId = fromStationId ? Number(fromStationId) : null;
        let resolvedToStationId = toStationId ? Number(toStationId) : null;

        if (!resolvedFromStationId && fromStationCode) {
            const fromStation = await stationRepository.findByCode(String(fromStationCode).trim().toUpperCase());
            resolvedFromStationId = fromStation?.id || null;
        }

        if (!resolvedToStationId && toStationCode) {
            const toStation = await stationRepository.findByCode(String(toStationCode).trim().toUpperCase());
            resolvedToStationId = toStation?.id || null;
        }

        const trainClassFromTrain = (train.classes || []).find((c) => c.classCode === classCode);
        let trainClass = await trainClassRepository.findByTrainAndCode(trainId, classCode);
        if (!trainClass && trainClassFromTrain) {
            trainClass = await persistMissingClassForBooking(trainId, classCode, train);
        }
        if (!trainClass) {
            return res.status(400).json({ msg: 'Selected class not available for this train' });
        }

        const mealsAvailable = trainProvidesMeals(train.trainName, train.trainTypeCode, classCode);
        const normalizedPassengers = normalizePassengerFoodPreferences(passengers, mealsAvailable);

        if (bookingType === 'Tatkal' && !isTatkalEligible(journeyDate)) {
            return res.status(400).json({ msg: 'Tatkal booking is only available 1-2 days before journey' });
        }

        if (!VALID_QUOTAS.includes(quota)) {
            return res.status(400).json({ msg: 'Invalid quota type' });
        }

        const advanceCheck = validateAdvanceBookingDate(journeyDate);
        if (advanceCheck.error) {
            return res.status(advanceCheck.status).json({ msg: advanceCheck.error });
        }

        const pool = await getPool();
        const runningDaysResult = await pool.request()
            .input('trainId', 'Int', trainId)
            .query('SELECT dayOfWeek FROM TrainRunningDays WHERE trainId = @trainId AND runs = 1 ORDER BY dayOfWeek');
        const runningDayList = runningDayService.resolveRunningDayList(
            train.runningDays,
            runningDaysResult.recordset.map((row) => row.dayOfWeek)
        );

        let segmentDistanceKm = Number(train.distance) || 0;
        let fromDepartureDayOffset = 0;
        if (resolvedFromStationId && resolvedToStationId) {
            const segment = await trainStopRepository.getSegmentMetrics(
                trainId,
                resolvedFromStationId,
                resolvedToStationId
            );
            if (segment) {
                segmentDistanceKm = segment.distanceKm;
                fromDepartureDayOffset = segment.fromDepartureDayOffset;
            }
        }

        if (!runningDayService.trainRunsOnBoardingDate(
            advanceCheck.journeyDate,
            fromDepartureDayOffset,
            runningDayList
        )) {
            return res.status(400).json({
                msg: `Train ${train.trainNumber} does not run on the selected date (${runningDayService.runningDaysLabel(runningDayList)}).`
            });
        }

        const perPassengerBaseFare = calculateClassFare({
            distanceKm: segmentDistanceKm,
            classCode,
            trainTypeCode: train.trainTypeCode,
            trainName: train.trainName,
            journeyDate: advanceCheck.journeyDate
        });

        const fareResult = calculateBookingFare({
            basePrice: perPassengerBaseFare,
            bookingType,
            quota,
            passengers: normalizedPassengers,
            journeyDate: advanceCheck.journeyDate
        });

        if (fareResult.error) {
            return res.status(fareResult.status).json({ msg: fareResult.error });
        }

        const ticketFare = fareResult.totalPrice;
        const mealFare = mealsAvailable ? calculateMealTotal(normalizedPassengers) : 0;
        const paymentBreakdown = calculatePaymentBreakdown({
            ticketFare,
            passengerCount: normalizedPassengers.length,
            mealFare
        });

        const result = await bookingRepository.createBooking({
            userId: req.user.id,
            trainId,
            passengers: normalizedPassengers,
            journeyDate: advanceCheck.journeyDate,
            totalPrice: ticketFare,
            paymentBreakdown: JSON.stringify(paymentBreakdown),
            grandTotal: paymentBreakdown.totalFare,
            seatNumbers: seatNumbers || [],
            classCode,
            bookingType,
            joinWaitlist: Boolean(joinWaitlist),
            joinRac: Boolean(joinRac),
            quota,
            fromStopSequence: fromStopSequence ? Number(fromStopSequence) : undefined,
            toStopSequence: toStopSequence ? Number(toStopSequence) : undefined,
            fromStationId: resolvedFromStationId || undefined,
            toStationId: resolvedToStationId || undefined
        });

        if (result.error) {
            return res.status(result.status).json({ msg: result.error });
        }

        res.status(201).json(result.booking);
    } catch (err) {
        console.error('Booking creation error:', err);
        res.status(500).json({ msg: 'Server error while creating booking' });
    }
});

router.delete('/:id/passengers/:passengerId', auth, auditLogger('booking.partial_cancel', 'booking'), async (req, res) => {
    try {
        const result = await bookingRepository.cancelPassenger(
            req.params.id,
            req.params.passengerId,
            req.user.id,
            req.user.isAdmin
        );
        if (result.error) return res.status(result.status).json({ msg: result.error });
        const booking = await bookingRepository.findById(req.params.id);
        res.json({ msg: 'Passenger removed from booking', booking });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.delete('/:id/pending', auth, async (req, res) => {
    try {
        const result = await bookingRepository.deletePendingBooking(
            req.params.id,
            req.user.id,
            req.user.isAdmin
        );

        if (result.error) {
            return res.status(result.status).json({ msg: result.error });
        }

        res.json({ msg: 'Pending booking removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.put('/:id', auth, auditLogger('booking.update', 'booking'), updateBookingRules, validate, async (req, res) => {
    const { status } = req.body;

    try {
        const result = await bookingRepository.updateStatus(
            req.params.id,
            status,
            req.user.id,
            req.user.isAdmin
        );

        if (result.error) {
            return res.status(result.status).json({ msg: result.error });
        }

        res.json({
            booking: result.booking,
            refund: result.refund || null
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;
