const { withTransaction, getPool } = require('../../database/connection');
const seatRepository = require('./seatRepository');
const refundRepository = require('./refundRepository');
const bookingSeatAllocationRepository = require('./bookingSeatAllocationRepository');
const { calculateRefund } = require('../utils/refund');
const { parsePaymentBreakdown } = require('../utils/paymentBreakdown');
const { sendBookingConfirmationEmail } = require('../services/emailService');
const runningDayService = require('../services/runningDayService');
const notificationRepository = require('./notificationRepository');
const outboxRepository = require('./outboxRepository');

async function notifyUser(userId, type, title, message, meta) {
    if (!userId) return;
    try {
        await notificationRepository.create({ userId, type, title, message, meta });
    } catch (_) { /* notifications table may not exist in older DBs */ }
}

const parseSeatNumbers = (value) => {
    if (Array.isArray(value)) return value;
    if (value == null || value === '') return [];
    if (typeof value === 'number') return [value];
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
        return parsed != null && parsed !== '' ? [parsed] : [];
    } catch {
        return [];
    }
};

const toDateOnly = (value) => {
    if (!value) return null;
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return null;
        return value.toISOString().split('T')[0];
    }
    const str = String(value).trim();
    if (!str) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const parsed = new Date(str);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().split('T')[0];
};

const formatTrainSummary = (train) => ({
    id: train.id,
    trainNumber: train.trainNumber,
    trainName: train.trainName,
    source: train.source,
    destination: train.destination,
    departureTime: train.departureTime,
    arrivalTime: train.arrivalTime,
    journeyDate: train.journeyDate,
    date: train.journeyDate
});

const formatBooking = (booking, train, user, passengers) => {
    const paymentBreakdown = parsePaymentBreakdown(
        booking.paymentBreakdown,
        booking.totalPrice,
        passengers?.length || 1
    );

    const boardingDeparture = booking.from_stop_departure_time || train?.departureTime || null;
    const alightingArrival = booking.to_stop_arrival_time || train?.arrivalTime || null;
    const durationMinutes = boardingDeparture && alightingArrival
        ? runningDayService.calculateDurationMinutes(
            {
                departureTime: boardingDeparture,
                departureDayOffset: booking.from_stop_departure_day_offset || 0
            },
            {
                arrivalTime: alightingArrival,
                arrivalDayOffset: booking.to_stop_arrival_day_offset || 0
            }
        )
        : null;

    const trainSummary = train ? {
        ...formatTrainSummary(train),
        departureTime: boardingDeparture,
        arrivalTime: alightingArrival
    } : null;

    return {
    id: booking.id,
    _id: booking.id,
    user: user ? { id: user.id, name: user.name, email: user.email, phone: user.phone } : booking.userId,
    train: trainSummary,
    boarding: booking.from_station_code ? {
        code: booking.from_station_code,
        name: booking.from_station_name,
        departureTime: boardingDeparture,
        arrivalTime: booking.from_stop_arrival_time || null
    } : null,
    alighting: booking.to_station_code ? {
        code: booking.to_station_code,
        name: booking.to_station_name,
        arrivalTime: alightingArrival,
        departureTime: booking.to_stop_departure_time || null
    } : null,
    distanceKm: booking.segment_distance_km != null ? Number(booking.segment_distance_km) : null,
    duration: durationMinutes != null ? runningDayService.formatDuration(durationMinutes) : null,
    passengers: passengers || [],
    totalPrice: Number(booking.totalPrice),
    grandTotal: Number(booking.grandTotal || paymentBreakdown.totalFare),
    paymentBreakdown,
    seatNumbers: parseSeatNumbers(booking.seatNumbers),
    status: booking.status,
    bookingDate: booking.bookingDate,
    journeyDate: toDateOnly(booking.journeyDate),
    pnrNumber: booking.pnrNumber,
    classCode: booking.classCode || null,
    className: booking.className || null,
    bookingType: booking.bookingType || 'General',
    paymentStatus: booking.paymentStatus || 'Pending',
    waitlistPosition: booking.waitlistPosition || null,
    quota: booking.quota || 'General',
    refund: booking.refundAmount !== undefined ? {
        refundAmount: Number(booking.refundAmount),
        refundPercent: Number(booking.refundPercent),
        cancellationCharge: Number(booking.cancellationCharge || 0),
        rule: booking.refundReason || null
    } : null
};
};

const getPassengersByBookingIds = async (bookingIds) => {
    if (!bookingIds.length) return {};

    const pool = await getPool();
    const request = pool.request();
    const placeholders = bookingIds.map((id, index) => {
        request.input(`id${index}`, 'Int', id);
        return `@id${index}`;
    }).join(',');

    const result = await request.query(`SELECT * FROM Passengers WHERE bookingId IN (${placeholders})`);
    return result.recordset.reduce((acc, passenger) => {
        if (!acc[passenger.bookingId]) acc[passenger.bookingId] = [];
        acc[passenger.bookingId].push(passenger);
        return acc;
    }, {});
};

const mapBookingRow = (row, user, passengers) => formatBooking(
    row,
    {
        id: row.train_id,
        trainNumber: row.trainNumber,
        trainName: row.trainName,
        source: row.source,
        destination: row.destination,
        departureTime: row.departureTime,
        arrivalTime: row.arrivalTime,
        journeyDate: row.journeyDate
    },
    user,
    passengers
);

const BOOKING_DETAIL_SELECT = `
                fs.code AS from_station_code, fs.name AS from_station_name,
                ts.code AS to_station_code, ts.name AS to_station_name,
                fstop.departureTime AS from_stop_departure_time,
                fstop.arrivalTime AS from_stop_arrival_time,
                fstop.departureDayOffset AS from_stop_departure_day_offset,
                tstop.arrivalTime AS to_stop_arrival_time,
                tstop.departureTime AS to_stop_departure_time,
                tstop.arrivalDayOffset AS to_stop_arrival_day_offset,
                CASE
                    WHEN fstop.distanceKm IS NOT NULL AND tstop.distanceKm IS NOT NULL
                    THEN tstop.distanceKm - fstop.distanceKm
                    ELSE NULL
                END AS segment_distance_km`;

const BOOKING_DETAIL_JOINS = `
            LEFT JOIN Stations fs ON b.fromStationId = fs.id
            LEFT JOIN Stations ts ON b.toStationId = ts.id
            LEFT JOIN TrainStops fstop ON fstop.trainId = t.id AND fstop.stationId = b.fromStationId
            LEFT JOIN TrainStops tstop ON tstop.trainId = t.id AND tstop.stationId = b.toStationId`;

const findByUserId = async (userId) => {
    const pool = await getPool();
    const bookings = await pool.request()
        .input('userId', 'Int', userId)
        .query(`SELECT b.*, t.id AS train_id, t.trainNumber, t.trainName, t.source, t.destination, t.departureTime, t.arrivalTime,
                tc.className,
                ${BOOKING_DETAIL_SELECT},
                r.refundAmount, r.refundPercent, r.cancellationCharge, r.reason AS refundReason
                FROM Bookings b
                INNER JOIN Trains t ON b.trainId = t.id
                LEFT JOIN TrainClasses tc ON b.trainId = tc.trainId AND b.classCode = tc.classCode
                ${BOOKING_DETAIL_JOINS}
                LEFT JOIN Refunds r ON b.id = r.bookingId
                WHERE b.userId = @userId
                ORDER BY b.bookingDate DESC`);

    const passengersMap = await getPassengersByBookingIds(bookings.recordset.map((b) => b.id));
    return bookings.recordset.map((row) => mapBookingRow(row, null, passengersMap[row.id] || []));
};

const findAll = async () => {
    const pool = await getPool();
    const bookings = await pool.request().query(`SELECT b.*, 
            t.id AS train_id, t.trainNumber, t.trainName, t.source, t.destination, t.departureTime, t.arrivalTime,
            u.id AS user_id, u.name AS user_name, u.email AS user_email, u.phone AS user_phone,
            tc.className,
            ${BOOKING_DETAIL_SELECT},
            r.refundAmount, r.refundPercent, r.cancellationCharge, r.reason AS refundReason
        FROM Bookings b
        INNER JOIN Trains t ON b.trainId = t.id
        INNER JOIN Users u ON b.userId = u.id
        LEFT JOIN TrainClasses tc ON b.trainId = tc.trainId AND b.classCode = tc.classCode
        ${BOOKING_DETAIL_JOINS}
        LEFT JOIN Refunds r ON b.id = r.bookingId
        ORDER BY b.bookingDate DESC`);

    const passengersMap = await getPassengersByBookingIds(bookings.recordset.map((b) => b.id));
    return bookings.recordset.map((row) => mapBookingRow(
        row,
        { id: row.user_id, name: row.user_name, email: row.user_email, phone: row.user_phone },
        passengersMap[row.id] || []
    ));
};

const findById = async (id) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('id', 'Int', id)
        .query(`SELECT b.*, 
                t.id AS train_id, t.trainNumber, t.trainName, t.source, t.destination, t.departureTime, t.arrivalTime,
                u.id AS user_id, u.name AS user_name, u.email AS user_email, u.phone AS user_phone,
                tc.className,
                ${BOOKING_DETAIL_SELECT},
                r.refundAmount, r.refundPercent, r.cancellationCharge, r.reason AS refundReason
            FROM Bookings b
            INNER JOIN Trains t ON b.trainId = t.id
            INNER JOIN Users u ON b.userId = u.id
            LEFT JOIN TrainClasses tc ON b.trainId = tc.trainId AND b.classCode = tc.classCode
            ${BOOKING_DETAIL_JOINS}
            LEFT JOIN Refunds r ON b.id = r.bookingId
            WHERE b.id = @id`);

    const row = result.recordset[0];
    if (!row) return null;

    const passengersMap = await getPassengersByBookingIds([row.id]);
    return mapBookingRow(
        row,
        { id: row.user_id, name: row.user_name, email: row.user_email, phone: row.user_phone },
        passengersMap[row.id] || []
    );
};

const findByPnrDirect = async (pnrNumber) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('pnrNumber', 'NVarChar', pnrNumber)
        .query('SELECT id FROM Bookings WHERE pnrNumber = @pnrNumber');
    if (!result.recordset[0]) return null;
    return findById(result.recordset[0].id);
};

const generatePnr = () => Math.floor(1000000000 + Math.random() * 9000000000).toString();

const getNextWaitlistPosition = async (query, trainId, classCode, journeyDate, status = 'Waitlisted') => {
    const rows = await query(
        `SELECT ISNULL(MAX(waitlistPosition), 0) AS maxPos FROM Bookings
         WHERE trainId = ? AND classCode = ? AND journeyDate = ? AND status = ?`,
        [trainId, classCode, journeyDate, status]
    );
    return rows[0].maxPos + 1;
};

const decrementAvailability = async (query, train, classRow, count) => {
    if (classRow) {
        await query(
            'UPDATE TrainClasses SET availableSeats = ?, updatedAt = SYSUTCDATETIME() WHERE id = ?',
            [classRow.availableSeats - count, classRow.id]
        );
    }
    await query(
        'UPDATE Trains SET availableSeats = ?, updatedAt = SYSUTCDATETIME() WHERE id = ?',
        [train.availableSeats - count, train.id]
    );
};

const restoreAvailability = async (query, trainId, classCode, count) => {
    await query(
        'UPDATE Trains SET availableSeats = availableSeats + ?, updatedAt = SYSUTCDATETIME() WHERE id = ?',
        [count, trainId]
    );
    if (classCode) {
        await query(
            'UPDATE TrainClasses SET availableSeats = availableSeats + ?, updatedAt = SYSUTCDATETIME() WHERE trainId = ? AND classCode = ?',
            [count, trainId, classCode]
        );
    }
};

const createBooking = async ({
    userId,
    trainId,
    passengers,
    journeyDate,
    totalPrice,
    seatNumbers,
    classCode,
    bookingType = 'General',
    joinWaitlist = false,
    joinRac = false,
    quota = 'General',
    fromStopSequence,
    toStopSequence,
    fromStationId,
    toStationId,
    paymentBreakdown,
    grandTotal
}) => {
    const txResult = await withTransaction(async ({ query }) => {
        const trains = await query('SELECT * FROM Trains WITH (UPDLOCK, ROWLOCK) WHERE id = ?', [trainId]);
        const train = trains[0];
        if (!train) return { error: 'Train not found', status: 404 };

        const classRows = await query(
            'SELECT * FROM TrainClasses WITH (UPDLOCK, ROWLOCK) WHERE trainId = ? AND classCode = ?',
            [trainId, classCode]
        );
        const classRow = classRows[0];
        if (!classRow) return { error: 'Selected class not available for this train', status: 400 };

        const availableCount = await seatRepository.countAvailableSeats(trainId, classCode, journeyDate);
        const needsWaitlist = availableCount < passengers.length;

        if (fromStopSequence && toStopSequence && !needsWaitlist) {
            const existingAllocations = await bookingSeatAllocationRepository.getAllocationsForSeatCheck(
                trainId,
                journeyDate,
                classCode
            );
            const hasCapacity = bookingSeatAllocationRepository.segmentHasCapacity(
                existingAllocations,
                fromStopSequence,
                toStopSequence,
                classRow.totalSeats,
                passengers.length
            );
            if (!hasCapacity && !joinWaitlist && !joinRac) {
                return { error: 'Not enough seats available for this route segment. Join waitlist/RAC or pick different seats.', status: 400 };
            }
        }

        if (needsWaitlist && !joinWaitlist && !joinRac) {
            return { error: 'Not enough seats available. Join waitlist/RAC or pick different seats.', status: 400 };
        }

        if (joinWaitlist && joinRac) {
            return { error: 'Choose either waitlist or RAC, not both.', status: 400 };
        }

        let booking = null;
        for (let attempt = 0; attempt < 5; attempt += 1) {
            const pnrNumber = generatePnr();
            try {
                if (needsWaitlist && (joinWaitlist || joinRac)) {
                    const listStatus = joinRac ? 'RAC' : 'Waitlisted';
                    const waitlistPosition = await getNextWaitlistPosition(query, trainId, classCode, journeyDate, listStatus);
                    const inserted = await query(
                        `INSERT INTO Bookings (userId, trainId, totalPrice, grandTotal, paymentBreakdown, seatNumbers, journeyDate, pnrNumber, status, classCode, bookingType, paymentStatus, waitlistPosition, quota, fromStationId, toStationId)
                         OUTPUT INSERTED.*
                         VALUES (?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?)`,
                        [userId, trainId, totalPrice, grandTotal, paymentBreakdown, journeyDate, pnrNumber, listStatus, classCode, bookingType, waitlistPosition, quota, fromStationId || null, toStationId || null]
                    );
                    booking = inserted[0];
                } else {
                    await seatRepository.ensureSeatsForClass(
                        query,
                        trainId,
                        classCode,
                        seatRepository.resolveClassSeatCapacity(classRow),
                        journeyDate
                    );

                    if (!seatNumbers || seatNumbers.length !== passengers.length) {
                        const pickedSeats = await seatRepository.pickAvailableSeats(
                            query,
                            trainId,
                            classCode,
                            journeyDate,
                            passengers.length
                        );
                        if (pickedSeats.length === passengers.length) {
                            seatNumbers = pickedSeats;
                        } else {
                            return { error: 'Not enough seats available. Join waitlist/RAC or pick different seats.', status: 400 };
                        }
                    }

                    const inserted = await query(
                        `INSERT INTO Bookings (userId, trainId, totalPrice, grandTotal, paymentBreakdown, seatNumbers, journeyDate, pnrNumber, status, classCode, bookingType, paymentStatus, quota, fromStationId, toStationId, paymentHoldExpiresAt)
                         OUTPUT INSERTED.*
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, 'Pending', ?, ?, ?, DATEADD(MINUTE, 10, SYSUTCDATETIME()))`,
                        [userId, trainId, totalPrice, grandTotal, paymentBreakdown, JSON.stringify(seatNumbers), journeyDate, pnrNumber, classCode, bookingType, quota, fromStationId || null, toStationId || null]
                    );
                    booking = inserted[0];

                    const seatResult = await seatRepository.validateAndLockSeats(query, {
                        trainId,
                        classCode,
                        journeyDate,
                        seatNumbers,
                        bookingId: booking.id
                    });
                    if (seatResult.error) return seatResult;
                    await decrementAvailability(query, train, classRow, passengers.length);
                }
                break;
            } catch (err) {
                if (err.message?.includes('UNIQUE') || err.message?.includes('duplicate')) continue;
                throw err;
            }
        }

        if (!booking) {
            return { error: 'Could not generate unique PNR. Please try again.', status: 400 };
        }

        for (const passenger of passengers) {
            const passengerStatus = booking.status === 'RAC' ? 'RAC' : booking.status === 'Waitlisted' ? 'Waitlisted' : 'Confirmed';
            await query(
                `INSERT INTO Passengers (bookingId, name, age, gender, berthPreference, passengerStatus,
                 nationality, mobile, email, idType, idNumber, foodPreference, insuranceOptIn, isSeniorCitizen, isDivyang)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    booking.id,
                    passenger.name,
                    passenger.age,
                    passenger.gender,
                    passenger.berthPreference || null,
                    passengerStatus,
                    passenger.nationality || 'Indian',
                    passenger.mobile || null,
                    passenger.email || null,
                    passenger.idType || null,
                    passenger.idNumber || null,
                    passenger.foodPreference || null,
                    passenger.insuranceOptIn ? 1 : 0,
                    passenger.isSeniorCitizen || Number(passenger.age) >= 60 ? 1 : 0,
                    passenger.isDivyang ? 1 : 0
                ]
            );
        }

        if (fromStopSequence && toStopSequence) {
            const passengerRows = await query(
                'SELECT id FROM Passengers WHERE bookingId = ? ORDER BY id ASC',
                [booking.id]
            );
            const allocationStatus = booking.status === 'RAC' ? 'RAC' : booking.status === 'Waitlisted' ? 'Waitlisted' : 'Confirmed';
            await bookingSeatAllocationRepository.createForPassengers(query, {
                passengerIds: passengerRows.map((row) => row.id),
                fromStopSequence,
                toStopSequence,
                bookingStatus: allocationStatus
            });
        }

        if (!['Waitlisted', 'RAC'].includes(booking.status)) {
            const assignedSeats = parseSeatNumbers(booking.seatNumbers);
            if (assignedSeats.length !== passengers.length) {
                return { error: 'Seat assignment failed. Please try again.', status: 500 };
            }
        }

        return { bookingId: booking.id };
    });

    if (txResult.error) return txResult;
    return { booking: await findById(txResult.bookingId) };
};

const assignSeatsIfMissing = async (bookingId, { strict = false } = {}) => {
    const result = await withTransaction(async ({ query }) => {
        const rows = await query(
            'SELECT * FROM Bookings WITH (UPDLOCK, ROWLOCK) WHERE id = ?',
            [bookingId]
        );
        const booking = rows[0];
        if (!booking || ['Waitlisted', 'RAC', 'Cancelled'].includes(booking.status)) {
            return { ok: true, skipped: true };
        }

        const currentSeats = parseSeatNumbers(booking.seatNumbers);
        const passengerRows = await query(
            'SELECT COUNT(*) AS count FROM Passengers WHERE bookingId = ?',
            [bookingId]
        );
        const needed = passengerRows[0]?.count || 0;
        if (!needed) {
            return { ok: false, error: 'No passengers found for booking' };
        }
        if (currentSeats.length >= needed && currentSeats.every(Boolean)) {
            return { ok: true, seatNumbers: currentSeats };
        }

        const classRows = await query(
            'SELECT * FROM TrainClasses WHERE trainId = ? AND classCode = ?',
            [booking.trainId, booking.classCode]
        );
        const classRow = classRows[0];
        const capacity = seatRepository.resolveClassSeatCapacity(classRow);
        if (!classRow || !capacity) {
            return { ok: false, error: 'Seat capacity not configured for this train class' };
        }

        await seatRepository.ensureSeatsForClass(
            query,
            booking.trainId,
            booking.classCode,
            capacity,
            booking.journeyDate
        );

        const pickedSeats = await seatRepository.pickAvailableSeats(
            query,
            booking.trainId,
            booking.classCode,
            booking.journeyDate,
            needed
        );
        if (pickedSeats.length < needed) {
            return { ok: false, error: 'Not enough seats available to assign' };
        }

        const seatResult = await seatRepository.validateAndLockSeats(query, {
            trainId: booking.trainId,
            classCode: booking.classCode,
            journeyDate: booking.journeyDate,
            seatNumbers: pickedSeats,
            bookingId: booking.id
        });
        if (seatResult.error) {
            return { ok: false, error: seatResult.error };
        }

        await query(
            'UPDATE Bookings SET seatNumbers = ?, updatedAt = SYSUTCDATETIME() WHERE id = ?',
            [JSON.stringify(pickedSeats), bookingId]
        );

        return { ok: true, seatNumbers: pickedSeats };
    });

    if (strict && !result.ok) {
        throw new Error(result.error || 'Could not assign seats for confirmed booking');
    }

    return result;
};

const ensureConfirmedBookingHasSeats = async (bookingId) => {
    return assignSeatsIfMissing(bookingId, { strict: true });
};

const confirmBooking = async (bookingId) => {
    const existing = await findById(bookingId);
    if (!existing) {
        throw new Error('Booking not found');
    }

    const pool = await getPool();

    if (existing.status === 'Pending') {
        await ensureConfirmedBookingHasSeats(bookingId);
        await pool.request()
            .input('id', 'Int', bookingId)
            .query(`UPDATE Bookings SET status = 'Confirmed', paymentStatus = 'Paid', updatedAt = SYSUTCDATETIME() WHERE id = @id`);

        const booking = await findById(bookingId);
        if (booking?.status === 'Confirmed') {
            const seats = parseSeatNumbers(booking.seatNumbers);
            const needed = booking.passengers?.length || 0;
            if (seats.length < needed || seats.some((seat) => !seat)) {
                throw new Error('Confirmed booking is missing seat numbers');
            }
        }
        if (booking?.user?.email) {
            sendBookingConfirmationEmail({
                to: booking.user.email,
                booking,
                ticketUrl: `${process.env.APP_URL || 'http://localhost:5000'}/api/bookings/${bookingId}/ticket`
            }).catch(() => {});
        }
        if (booking?.userId) {
            await outboxRepository.enqueue({
                aggregateType: 'booking',
                aggregateId: bookingId,
                eventType: 'booking.confirmed',
                payload: {
                    userId: booking.userId,
                    pnr: booking.pnrNumber || booking.pnr,
                    bookingId,
                    points: Math.max(10, Math.floor(Number(booking.grandTotal || booking.totalPrice) / 100))
                }
            }).catch(() => {});
        }
        return booking;
    }

    if (['Waitlisted', 'RAC'].includes(existing.status)) {
        await pool.request()
            .input('id', 'Int', bookingId)
            .query(`UPDATE Bookings SET paymentStatus = 'Paid', updatedAt = SYSUTCDATETIME() WHERE id = @id`);

        const booking = await findById(bookingId);
        if (booking?.user?.email) {
            sendBookingConfirmationEmail({
                to: booking.user.email,
                booking,
                ticketUrl: `${process.env.APP_URL || 'http://localhost:5000'}/api/bookings/${bookingId}/ticket`
            }).catch(() => {});
        }
        if (booking?.userId) {
            await notifyUser(
                booking.userId,
                'payment_received',
                'Payment received',
                `Payment for PNR ${booking.pnr || bookingId} (${booking.status}) is recorded.`,
                { bookingId, pnr: booking.pnr, status: booking.status }
            );
        }
        return booking;
    }

    throw new Error('Booking is not awaiting payment confirmation');
};

const getRefundPreview = async (id, userId, isAdmin) => {
    const booking = await findById(id);
    if (!booking) return { error: 'Booking not found', status: 404 };
    if (booking.user.id !== userId && !isAdmin) {
        return { error: 'Not authorized', status: 403 };
    }

    const refund = calculateRefund({
        totalPrice: booking.grandTotal || booking.totalPrice,
        journeyDate: booking.journeyDate,
        paymentStatus: booking.paymentStatus,
        bookingStatus: booking.status,
        passengerCount: booking.passengers.length
    });

    return { refund };
};

const failBooking = async (bookingId) => {
    const txResult = await withTransaction(async ({ query }) => {
        const rows = await query('SELECT * FROM Bookings WHERE id = ?', [bookingId]);
        const booking = rows[0];
        if (!booking) return null;

        if (booking.status === 'Pending' && booking.paymentStatus === 'Pending') {
            await seatRepository.releaseSeatsForBooking(query, bookingId);
            const passengerRows = await query('SELECT COUNT(*) AS count FROM Passengers WHERE bookingId = ?', [bookingId]);
            await restoreAvailability(query, booking.trainId, booking.classCode, passengerRows[0].count);
        }

        await query(
            `UPDATE Bookings SET status = 'Cancelled', paymentStatus = 'Failed', updatedAt = SYSUTCDATETIME() WHERE id = ?`,
            [bookingId]
        );
        return { bookingId };
    });

    if (!txResult?.bookingId) return null;
    return findById(txResult.bookingId);
};

const deletePendingBooking = async (bookingId, userId, isAdmin) => {
    const txResult = await withTransaction(async ({ query }) => {
        const rows = await query(
            'SELECT * FROM Bookings WITH (UPDLOCK, ROWLOCK) WHERE id = ?',
            [bookingId]
        );
        const booking = rows[0];
        if (!booking) return { error: 'Booking not found', status: 404 };
        if (booking.userId !== userId && !isAdmin) {
            return { error: 'Not authorized to remove this booking', status: 403 };
        }
        if (booking.status !== 'Pending' || booking.paymentStatus !== 'Pending') {
            return { error: 'Only unpaid pending bookings can be removed', status: 400 };
        }

        await seatRepository.releaseSeatsForBooking(query, bookingId);
        const passengerRows = await query('SELECT COUNT(*) AS count FROM Passengers WHERE bookingId = ?', [bookingId]);
        await restoreAvailability(query, booking.trainId, booking.classCode, passengerRows[0].count);
        await query('DELETE FROM Passengers WHERE bookingId = ?', [bookingId]);
        await query('DELETE FROM Bookings WHERE id = ?', [bookingId]);
        return { ok: true };
    });

    if (txResult.error) return txResult;
    return { ok: true };
};

const promoteWaitlist = async (query, trainId, classCode, journeyDate) => {
    const waitlisted = await query(
        `SELECT TOP 1 * FROM Bookings WITH (UPDLOCK, ROWLOCK)
         WHERE trainId = ? AND classCode = ? AND journeyDate = ? AND status = 'Waitlisted'
         ORDER BY waitlistPosition ASC`,
        [trainId, classCode, journeyDate]
    );

    const booking = waitlisted[0];
    if (!booking) return null;

    const passengerRows = await query('SELECT COUNT(*) AS count FROM Passengers WHERE bookingId = ?', [booking.id]);
    const needed = passengerRows[0].count;

    const classRows = await query('SELECT * FROM TrainClasses WHERE trainId = ? AND classCode = ?', [trainId, classCode]);
    await seatRepository.ensureSeatsForClass(
        query,
        trainId,
        classCode,
        seatRepository.resolveClassSeatCapacity(classRows[0]),
        journeyDate
    );

    const availableSeats = await query(
        `SELECT TOP (${needed}) seatNumber FROM Seats
         WHERE trainId = ? AND classCode = ? AND journeyDate = ? AND status = 'Available'
         ORDER BY seatNumber ASC`,
        [trainId, classCode, journeyDate]
    );

    if (availableSeats.length < needed) return null;

    const seatNumbers = availableSeats.map((s) => s.seatNumber);
    await seatRepository.validateAndLockSeats(query, {
        trainId,
        classCode,
        journeyDate,
        seatNumbers,
        bookingId: booking.id
    });

    const trains = await query('SELECT * FROM Trains WHERE id = ?', [trainId]);
    await decrementAvailability(query, trains[0], classRows[0], needed);

    const newStatus = booking.paymentStatus === 'Paid' ? 'Confirmed' : 'Pending';
    await query(
        `UPDATE Bookings SET status = ?, waitlistPosition = NULL, seatNumbers = ?, updatedAt = SYSUTCDATETIME() WHERE id = ?`,
        [newStatus, JSON.stringify(seatNumbers), booking.id]
    );

    if (newStatus === 'Confirmed') {
        await query(
            `UPDATE Passengers SET passengerStatus = 'Confirmed' WHERE bookingId = ?`,
            [booking.id]
        );
    }

    return booking.id;
};

const promoteRac = async (query, trainId, classCode, journeyDate) => {
    const racBookings = await query(
        `SELECT TOP 1 * FROM Bookings WITH (UPDLOCK, ROWLOCK)
         WHERE trainId = ? AND classCode = ? AND journeyDate = ? AND status = 'RAC' AND paymentStatus = 'Paid'
         ORDER BY waitlistPosition ASC, bookingDate ASC`,
        [trainId, classCode, journeyDate]
    );

    const booking = racBookings[0];
    if (!booking) return null;

    const passengerRows = await query('SELECT COUNT(*) AS count FROM Passengers WHERE bookingId = ?', [booking.id]);
    const needed = passengerRows[0].count;

    const classRows = await query('SELECT * FROM TrainClasses WHERE trainId = ? AND classCode = ?', [trainId, classCode]);
    await seatRepository.ensureSeatsForClass(
        query,
        trainId,
        classCode,
        seatRepository.resolveClassSeatCapacity(classRows[0]),
        journeyDate
    );

    const availableSeats = await query(
        `SELECT TOP (${needed}) seatNumber FROM Seats
         WHERE trainId = ? AND classCode = ? AND journeyDate = ? AND status = 'Available'
         ORDER BY seatNumber ASC`,
        [trainId, classCode, journeyDate]
    );

    if (availableSeats.length < needed) return null;

    const seatNumbers = availableSeats.map((s) => s.seatNumber);
    await seatRepository.validateAndLockSeats(query, {
        trainId,
        classCode,
        journeyDate,
        seatNumbers,
        bookingId: booking.id
    });

    const trains = await query('SELECT * FROM Trains WHERE id = ?', [trainId]);
    await decrementAvailability(query, trains[0], classRows[0], needed);

    await query(
        `UPDATE Bookings SET status = 'Confirmed', waitlistPosition = NULL, seatNumbers = ?, updatedAt = SYSUTCDATETIME() WHERE id = ?`,
        [JSON.stringify(seatNumbers), booking.id]
    );
    await query(
        `UPDATE Passengers SET passengerStatus = 'Confirmed' WHERE bookingId = ?`,
        [booking.id]
    );

    return booking.id;
};

const updateStatus = async (id, status, userId, isAdmin) => {
    if (status === 'Confirmed') {
        await ensureConfirmedBookingHasSeats(id);
    }

    const txResult = await withTransaction(async ({ query }) => {
        const rows = await query(
            `SELECT b.*, t.id AS train_id
             FROM Bookings b WITH (UPDLOCK, ROWLOCK)
             INNER JOIN Trains t ON b.trainId = t.id
             WHERE b.id = ?`,
            [id]
        );

        const booking = rows[0];
        if (!booking) return { error: 'Booking not found', status: 404 };
        if (booking.userId !== userId && !isAdmin) {
            return { error: 'Not authorized to update this booking', status: 403 };
        }

        if (status === 'Cancelled') {
            const passengerRows = await query('SELECT COUNT(*) AS count FROM Passengers WHERE bookingId = ?', [booking.id]);
            const passengerCount = passengerRows[0].count;
            const payableAmount = booking.grandTotal || booking.totalPrice;

            if (['Confirmed', 'Pending'].includes(booking.status)) {
                await seatRepository.releaseSeatsForBooking(query, booking.id);
                await restoreAvailability(query, booking.trainId, booking.classCode, passengerCount);
            }

            const refundCalc = calculateRefund({
                totalPrice: payableAmount,
                journeyDate: booking.journeyDate,
                paymentStatus: booking.paymentStatus,
                bookingStatus: booking.status,
                passengerCount
            });

            if (refundCalc.refundAmount > 0 && booking.paymentStatus === 'Paid') {
                await refundRepository.create(query, {
                    bookingId: booking.id,
                    originalAmount: refundCalc.originalAmount,
                    refundAmount: refundCalc.refundAmount,
                    refundPercent: refundCalc.refundPercent,
                    cancellationCharge: refundCalc.cancellationCharge,
                    reason: refundCalc.rule
                });
            }

            await query(
                'UPDATE Bookings SET status = ?, updatedAt = SYSUTCDATETIME() WHERE id = ?',
                ['Cancelled', id]
            );

            if (booking.status === 'Confirmed') {
                await promoteWaitlist(query, booking.trainId, booking.classCode, booking.journeyDate);
                await promoteRac(query, booking.trainId, booking.classCode, booking.journeyDate);
            }

            return { bookingId: id, refund: refundCalc, paymentStatus: booking.paymentStatus };
        }

        await query('UPDATE Bookings SET status = ?, updatedAt = SYSUTCDATETIME() WHERE id = ?', [status, id]);
        return { bookingId: id };
    });

    if (txResult.error) return txResult;

    if (status === 'Cancelled' && txResult.refund?.refundAmount > 0 && txResult.paymentStatus === 'Paid') {
        const paymentRepository = require('./paymentRepository');
        const razorpayService = require('../services/razorpayService');
        const payment = await paymentRepository.findByBookingId(txResult.bookingId);
        if (payment?.razorpayPaymentId) {
            await razorpayService.processRefund({
                paymentId: payment.razorpayPaymentId,
                amount: txResult.refund.refundAmount
            }).catch(() => {});
        }
        await paymentRepository.markRefunded(txResult.bookingId);
    }

    if (status === 'Cancelled') {
        const cancelled = await findById(txResult.bookingId);
        if (cancelled?.userId) {
            const refundMsg = txResult.refund?.refundAmount > 0
                ? ` Refund of ₹${txResult.refund.refundAmount} initiated.`
                : '';
            await notifyUser(
                cancelled.userId,
                'booking_cancelled',
                'Booking cancelled',
                `PNR ${cancelled.pnr || cancelled.id} has been cancelled.${refundMsg}`,
                { bookingId: cancelled.id, refund: txResult.refund }
            );
        }
    }

    return {
        booking: await findById(txResult.bookingId),
        refund: txResult.refund || null
    };
};

const findAllFiltered = async ({ pnr, trainId, status, fromDate, toDate }) => {
    const pool = await getPool();
    const request = pool.request();
    let query = `SELECT b.*, 
            t.id AS train_id, t.trainNumber, t.trainName, t.source, t.destination, t.departureTime, t.arrivalTime, t.journeyDate,
            u.id AS user_id, u.name AS user_name, u.email AS user_email, u.phone AS user_phone,
            tc.className
        FROM Bookings b
        INNER JOIN Trains t ON b.trainId = t.id
        INNER JOIN Users u ON b.userId = u.id
        LEFT JOIN TrainClasses tc ON b.trainId = tc.trainId AND b.classCode = tc.classCode
        WHERE 1=1`;

    if (pnr) {
        query += ' AND b.pnrNumber LIKE @pnr';
        request.input('pnr', 'NVarChar', `%${pnr}%`);
    }
    if (trainId) {
        query += ' AND b.trainId = @trainId';
        request.input('trainId', 'Int', trainId);
    }
    if (status) {
        query += ' AND b.status = @status';
        request.input('status', 'NVarChar', status);
    }
    if (fromDate) {
        query += ' AND b.journeyDate >= @fromDate';
        request.input('fromDate', 'Date', fromDate);
    }
    if (toDate) {
        query += ' AND b.journeyDate <= @toDate';
        request.input('toDate', 'Date', toDate);
    }

    query += ' ORDER BY b.bookingDate DESC';
    const bookings = await request.query(query);

    const passengersMap = await getPassengersByBookingIds(bookings.recordset.map((b) => b.id));
    return bookings.recordset.map((row) => mapBookingRow(
        row,
        { id: row.user_id, name: row.user_name, email: row.user_email, phone: row.user_phone },
        passengersMap[row.id] || []
    ));
};

const promoteWaitlistManually = async (trainId, classCode, journeyDate) => withTransaction(async ({ query }) => {
    const bookingId = await promoteWaitlist(query, trainId, classCode, journeyDate);
    return bookingId ? findById(bookingId) : null;
});

const promoteRacManually = async (trainId, classCode, journeyDate) => withTransaction(async ({ query }) => {
    const bookingId = await promoteRac(query, trainId, classCode, journeyDate);
    return bookingId ? findById(bookingId) : null;
});

const releaseExpiredPaymentHolds = async () => withTransaction(async ({ query }) => {
    const expired = await query(
        `SELECT id FROM Bookings WITH (UPDLOCK, ROWLOCK)
         WHERE status = 'Pending' AND paymentStatus = 'Pending'
           AND paymentHoldExpiresAt IS NOT NULL AND paymentHoldExpiresAt < SYSUTCDATETIME()`
    );
    for (const row of expired) {
        await seatRepository.releaseSeatsForBooking(query, row.id);
        const passengerRows = await query('SELECT COUNT(*) AS count FROM Passengers WHERE bookingId = ?', [row.id]);
        const bookingRows = await query('SELECT trainId, classCode FROM Bookings WHERE id = ?', [row.id]);
        if (bookingRows[0]) {
            await restoreAvailability(query, bookingRows[0].trainId, bookingRows[0].classCode, passengerRows[0].count);
        }
        await query(
            `UPDATE Bookings SET status = 'Cancelled', paymentStatus = 'Failed', updatedAt = SYSUTCDATETIME() WHERE id = ?`,
            [row.id]
        );
    }
    return expired.length;
});

const cancelPassenger = async (bookingId, passengerId, userId, isAdmin) => withTransaction(async ({ query }) => {
    const bookingRows = await query('SELECT * FROM Bookings WHERE id = ?', [bookingId]);
    const booking = bookingRows[0];
    if (!booking) return { error: 'Booking not found', status: 404 };
    if (booking.userId !== userId && !isAdmin) return { error: 'Not authorized', status: 403 };
    if (!['Confirmed', 'Pending', 'RAC', 'Waitlisted'].includes(booking.status)) {
        return { error: 'Booking cannot be partially cancelled', status: 400 };
    }

    const passengerRows = await query('SELECT * FROM Passengers WHERE id = ? AND bookingId = ?', [passengerId, bookingId]);
    if (!passengerRows[0]) return { error: 'Passenger not found', status: 404 };

    const allPassengers = await query('SELECT COUNT(*) AS count FROM Passengers WHERE bookingId = ?', [bookingId]);
    if (allPassengers[0].count <= 1) {
        return { error: 'Use full cancellation when only one passenger remains', status: 400 };
    }

    const originalCount = allPassengers[0].count;
    await query('DELETE FROM Passengers WHERE id = ?', [passengerId]);
    const remaining = await query('SELECT COUNT(*) AS count FROM Passengers WHERE bookingId = ?', [bookingId]);
    const ratio = remaining[0].count / originalCount;
    const newTotal = Math.round(Number(booking.totalPrice) * ratio);
    const newGrand = booking.grandTotal ? Math.round(Number(booking.grandTotal) * ratio) : null;

    await query(
        'UPDATE Bookings SET totalPrice = ?, grandTotal = ?, updatedAt = SYSUTCDATETIME() WHERE id = ?',
        [newTotal, newGrand, bookingId]
    );

    return { bookingId, remainingPassengers: remaining[0].count };
});

module.exports = {
    findByUserId,
    findAll,
    findAllFiltered,
    findById,
    findByPnr: findByPnrDirect,
    createBooking,
    confirmBooking,
    assignSeatsIfMissing,
    ensureConfirmedBookingHasSeats,
    failBooking,
    deletePendingBooking,
    updateStatus,
    promoteWaitlistManually,
    promoteRacManually,
    releaseExpiredPaymentHolds,
    cancelPassenger,
    getRefundPreview
};
