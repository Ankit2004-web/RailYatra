const { withTransaction, getPool } = require('../../database/connection');
const seatRepository = require('./seatRepository');
const refundRepository = require('./refundRepository');
const bookingSeatAllocationRepository = require('./bookingSeatAllocationRepository');
const { calculateRefund } = require('../utils/refund');
const { sendBookingConfirmationEmail } = require('../services/emailService');

const parseSeatNumbers = (value) => {
    try {
        return JSON.parse(value || '[]');
    } catch {
        return [];
    }
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

const formatBooking = (booking, train, user, passengers) => ({
    id: booking.id,
    _id: booking.id,
    user: user ? { id: user.id, name: user.name, email: user.email, phone: user.phone } : booking.userId,
    train: train ? formatTrainSummary(train) : null,
    passengers: passengers || [],
    totalPrice: Number(booking.totalPrice),
    seatNumbers: parseSeatNumbers(booking.seatNumbers),
    status: booking.status,
    bookingDate: booking.bookingDate,
    journeyDate: booking.journeyDate,
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
});

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

const findByUserId = async (userId) => {
    const pool = await getPool();
    const bookings = await pool.request()
        .input('userId', 'Int', userId)
        .query(`SELECT b.*, t.id AS train_id, t.trainNumber, t.trainName, t.source, t.destination, t.departureTime, t.arrivalTime, t.journeyDate,
                tc.className,
                r.refundAmount, r.refundPercent, r.cancellationCharge, r.reason AS refundReason
                FROM Bookings b
                INNER JOIN Trains t ON b.trainId = t.id
                LEFT JOIN TrainClasses tc ON b.trainId = tc.trainId AND b.classCode = tc.classCode
                LEFT JOIN Refunds r ON b.id = r.bookingId
                WHERE b.userId = @userId
                ORDER BY b.bookingDate DESC`);

    const passengersMap = await getPassengersByBookingIds(bookings.recordset.map((b) => b.id));
    return bookings.recordset.map((row) => mapBookingRow(row, null, passengersMap[row.id] || []));
};

const findAll = async () => {
    const pool = await getPool();
    const bookings = await pool.request().query(`SELECT b.*, 
            t.id AS train_id, t.trainNumber, t.trainName, t.source, t.destination, t.departureTime, t.arrivalTime, t.journeyDate,
            u.id AS user_id, u.name AS user_name, u.email AS user_email, u.phone AS user_phone,
            tc.className,
            r.refundAmount, r.refundPercent, r.cancellationCharge, r.reason AS refundReason
        FROM Bookings b
        INNER JOIN Trains t ON b.trainId = t.id
        INNER JOIN Users u ON b.userId = u.id
        LEFT JOIN TrainClasses tc ON b.trainId = tc.trainId AND b.classCode = tc.classCode
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
                t.id AS train_id, t.trainNumber, t.trainName, t.source, t.destination, t.departureTime, t.arrivalTime, t.journeyDate,
                u.id AS user_id, u.name AS user_name, u.email AS user_email, u.phone AS user_phone,
                tc.className,
                r.refundAmount, r.refundPercent, r.cancellationCharge, r.reason AS refundReason
            FROM Bookings b
            INNER JOIN Trains t ON b.trainId = t.id
            INNER JOIN Users u ON b.userId = u.id
            LEFT JOIN TrainClasses tc ON b.trainId = tc.trainId AND b.classCode = tc.classCode
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
    toStationId
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
                        `INSERT INTO Bookings (userId, trainId, totalPrice, seatNumbers, journeyDate, pnrNumber, status, classCode, bookingType, paymentStatus, waitlistPosition, quota, fromStationId, toStationId)
                         OUTPUT INSERTED.*
                         VALUES (?, ?, ?, '[]', ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?)`,
                        [userId, trainId, totalPrice, journeyDate, pnrNumber, listStatus, classCode, bookingType, waitlistPosition, quota, fromStationId || null, toStationId || null]
                    );
                    booking = inserted[0];
                } else {
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
                        } else if (pickedSeats.length === 0) {
                            seatNumbers = [];
                        } else {
                            return { error: 'Not enough seats available. Join waitlist/RAC or pick different seats.', status: 400 };
                        }
                    }

                    const inserted = await query(
                        `INSERT INTO Bookings (userId, trainId, totalPrice, seatNumbers, journeyDate, pnrNumber, status, classCode, bookingType, paymentStatus, quota, fromStationId, toStationId)
                         OUTPUT INSERTED.*
                         VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?, ?, 'Pending', ?, ?, ?)`,
                        [userId, trainId, totalPrice, JSON.stringify(seatNumbers), journeyDate, pnrNumber, classCode, bookingType, quota, fromStationId || null, toStationId || null]
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
                'INSERT INTO Passengers (bookingId, name, age, gender, berthPreference, passengerStatus) VALUES (?, ?, ?, ?, ?, ?)',
                [
                    booking.id,
                    passenger.name,
                    passenger.age,
                    passenger.gender,
                    passenger.berthPreference || null,
                    passengerStatus
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

        return { bookingId: booking.id };
    });

    if (txResult.error) return txResult;
    return { booking: await findById(txResult.bookingId) };
};

const confirmBooking = async (bookingId) => {
    const pool = await getPool();
    await pool.request()
        .input('id', 'Int', bookingId)
        .query(`UPDATE Bookings SET status = 'Confirmed', paymentStatus = 'Paid', updatedAt = SYSUTCDATETIME() WHERE id = @id`);

    const booking = await findById(bookingId);
    if (booking?.user?.email) {
        sendBookingConfirmationEmail({
            to: booking.user.email,
            booking,
            ticketUrl: `${process.env.APP_URL || 'http://localhost:5000'}/api/bookings/${bookingId}/ticket`
        }).catch(() => {});
    }

    return booking;
};

const getRefundPreview = async (id, userId, isAdmin) => {
    const booking = await findById(id);
    if (!booking) return { error: 'Booking not found', status: 404 };
    if (booking.user.id !== userId && !isAdmin) {
        return { error: 'Not authorized', status: 403 };
    }

    const refund = calculateRefund({
        totalPrice: booking.totalPrice,
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

        await seatRepository.releaseSeatsForBooking(query, bookingId);
        const passengerRows = await query('SELECT COUNT(*) AS count FROM Passengers WHERE bookingId = ?', [bookingId]);
        await restoreAvailability(query, booking.trainId, booking.classCode, passengerRows[0].count);

        await query(
            `UPDATE Bookings SET status = 'Cancelled', paymentStatus = 'Failed', updatedAt = SYSUTCDATETIME() WHERE id = ?`,
            [bookingId]
        );
        return { bookingId };
    });

    if (!txResult?.bookingId) return null;
    return findById(txResult.bookingId);
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
    const classRows = await query('SELECT * FROM TrainClasses WHERE trainId = ? AND classCode = ?', [trainId, classCode]);
    await decrementAvailability(query, trains[0], classRows[0], needed);

    await query(
        `UPDATE Bookings SET status = 'Pending', waitlistPosition = NULL, seatNumbers = ?, updatedAt = SYSUTCDATETIME() WHERE id = ?`,
        [JSON.stringify(seatNumbers), booking.id]
    );

    return booking.id;
};

const updateStatus = async (id, status, userId, isAdmin) => {
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

            if (['Confirmed', 'Pending'].includes(booking.status)) {
                await seatRepository.releaseSeatsForBooking(query, booking.id);
                if (booking.status === 'Confirmed' || booking.status === 'Pending') {
                    await restoreAvailability(query, booking.trainId, booking.classCode, passengerCount);
                }
            }

            const refundCalc = calculateRefund({
                totalPrice: booking.totalPrice,
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
            }

            return { bookingId: id, refund: refundCalc };
        }

        await query('UPDATE Bookings SET status = ?, updatedAt = SYSUTCDATETIME() WHERE id = ?', [status, id]);
        return { bookingId: id };
    });

    if (txResult.error) return txResult;
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

module.exports = {
    findByUserId,
    findAll,
    findAllFiltered,
    findById,
    findByPnr: findByPnrDirect,
    createBooking,
    confirmBooking,
    failBooking,
    updateStatus,
    promoteWaitlistManually,
    getRefundPreview
};
