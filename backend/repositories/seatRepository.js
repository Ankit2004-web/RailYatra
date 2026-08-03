const { getPool } = require('../../database/connection');
const trainClassRepository = require('./trainClassRepository');
const { getAllSeatsForClass, buildRakeFromTrainClasses } = require('../services/rakeCompositionService');

const BERTH_TYPES = ['LB', 'MB', 'UB', 'SL', 'SU', 'WS'];

const getBerthType = (seatNumber, classCode) => {
    if (['CC', 'EC', '2S'].includes(classCode)) return 'WS';
    const cycle = (seatNumber - 1) % 8;
    if (cycle < 2) return 'LB';
    if (cycle < 4) return 'MB';
    if (cycle < 6) return 'UB';
    if (cycle === 6) return 'SL';
    return 'SU';
};

const formatSeat = (row) => ({
    id: row.id,
    coachNumber: row.coachNumber || null,
    seatNumber: row.seatNumber,
    displayLabel: row.displayLabel || (row.coachNumber ? `${row.coachNumber}-${row.seatNumber}` : String(row.seatNumber)),
    berthType: row.berthType,
    status: row.status,
    classCode: row.classCode
});

async function buildRakeSeatMap(trainId, classCode) {
    const pool = await getPool();
    const trainResult = await pool.request()
        .input('id', 'Int', trainId)
        .query(`
            SELECT t.trainName, tt.code AS trainTypeCode
            FROM Trains t
            LEFT JOIN TrainTypes tt ON tt.id = t.trainTypeId
            WHERE t.id = @id
        `);
    const trainRow = trainResult.recordset[0];
    if (!trainRow) return { coaches: [], seats: [] };

    const classes = await trainClassRepository.findByTrainId(trainId);
    const rake = buildRakeFromTrainClasses(
        { trainName: trainRow.trainName, trainTypeCode: trainRow.trainTypeCode },
        classes
    );

    const classCoaches = rake.coaches.filter((c) => c.classCode === classCode);
    const rakeSeats = getAllSeatsForClass(rake.coaches, classCode).map((s) => ({
        id: null,
        coachNumber: s.coachNumber,
        seatNumber: s.seatNumber,
        displayLabel: s.displayLabel,
        berthType: s.berthType,
        status: s.status || 'Available',
        classCode
    }));

    const coaches = classCoaches.map((c) => ({
        coachNumber: c.coachNumber,
        coachType: c.coachType,
        coachModel: c.coachModel,
        seatingCapacity: c.seatingCapacity,
        sleepingBerths: c.sleepingBerths,
        seatCount: (c.seats || []).length,
        seats: (c.seats || []).map((s) => ({
            id: null,
            coachNumber: s.coachNumber,
            seatNumber: s.seatNumber,
            displayLabel: s.displayLabel,
            berthType: s.berthType,
            status: s.status || 'Available',
            classCode
        }))
    }));

    return { coaches, seats: rakeSeats };
}

const getSeatMap = async (trainId, classCode, journeyDate) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('trainId', 'Int', trainId)
        .input('classCode', 'NVarChar', classCode)
        .input('journeyDate', 'Date', journeyDate)
        .query(`SELECT * FROM Seats
                WHERE trainId = @trainId AND classCode = @classCode AND journeyDate = @journeyDate
                ORDER BY seatNumber ASC`);

    if (result.recordset.length) {
        return {
            coaches: [],
            seats: result.recordset.map(formatSeat)
        };
    }

    return buildRakeSeatMap(trainId, classCode);
};

const seedSeatsForClass = async (trainId, classCode, totalSeats, journeyDate) => {
    const pool = await getPool();

    for (let seatNumber = 1; seatNumber <= totalSeats; seatNumber += 1) {
        const berthType = getBerthType(seatNumber, classCode);
        await pool.request()
            .input('trainId', 'Int', trainId)
            .input('classCode', 'NVarChar', classCode)
            .input('seatNumber', 'Int', seatNumber)
            .input('berthType', 'NVarChar', berthType)
            .input('journeyDate', 'Date', journeyDate)
            .query(`INSERT INTO Seats (trainId, classCode, seatNumber, berthType, journeyDate, status)
                    VALUES (@trainId, @classCode, @seatNumber, @berthType, @journeyDate, 'Available')`);
    }
};

const pickAvailableSeats = async (query, trainId, classCode, journeyDate, count) => {
    const rows = await query(
        `SELECT TOP (${Number(count)}) seatNumber FROM Seats
         WHERE trainId = ? AND classCode = ? AND journeyDate = ? AND status = 'Available'
         ORDER BY seatNumber ASC`,
        [trainId, classCode, journeyDate]
    );
    return rows.map((row) => row.seatNumber);
};

const validateAndLockSeats = async (query, { trainId, classCode, journeyDate, seatNumbers, bookingId }) => {
    const totalRows = await query(
        'SELECT COUNT(*) AS count FROM Seats WHERE trainId = ? AND classCode = ? AND journeyDate = ?',
        [trainId, classCode, journeyDate]
    );

    if (!totalRows[0]?.count) {
        return { ok: true, legacyMode: true };
    }

    for (const seatNumber of seatNumbers) {
        const rows = await query(
            `SELECT * FROM Seats WITH (UPDLOCK, ROWLOCK)
             WHERE trainId = ? AND classCode = ? AND journeyDate = ? AND seatNumber = ?`,
            [trainId, classCode, journeyDate, seatNumber]
        );

        const seat = rows[0];
        if (!seat) {
            return { error: `Seat ${seatNumber} does not exist`, status: 400 };
        }
        if (seat.status !== 'Available') {
            return { error: `Seat ${seatNumber} is not available`, status: 400 };
        }

        await query(
            `UPDATE Seats SET status = 'Booked', bookingId = ?, updatedAt = SYSUTCDATETIME()
             WHERE id = ?`,
            [bookingId, seat.id]
        );
    }

    return { ok: true };
};

const releaseSeatsForBooking = async (query, bookingId) => {
    await query(
        `UPDATE Seats SET status = 'Available', bookingId = NULL, updatedAt = SYSUTCDATETIME()
         WHERE bookingId = ?`,
        [bookingId]
    );
};

const countAvailableSeats = async (trainId, classCode, journeyDate) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('trainId', 'Int', trainId)
        .input('classCode', 'NVarChar', classCode)
        .input('journeyDate', 'Date', journeyDate)
        .query(`SELECT COUNT(*) AS seatCount FROM Seats
                WHERE trainId = @trainId AND classCode = @classCode AND journeyDate = @journeyDate AND status = 'Available'`);

    const seatCount = result.recordset[0].seatCount;
    if (seatCount > 0) return seatCount;

    const classResult = await pool.request()
        .input('trainId', 'Int', trainId)
        .input('classCode', 'NVarChar', classCode)
        .query('SELECT availableSeats FROM TrainClasses WHERE trainId = @trainId AND classCode = @classCode');

    return classResult.recordset[0]?.availableSeats || 0;
};

module.exports = {
    BERTH_TYPES,
    getBerthType,
    getSeatMap,
    buildRakeSeatMap,
    seedSeatsForClass,
    validateAndLockSeats,
    releaseSeatsForBooking,
    countAvailableSeats,
    pickAvailableSeats
};
