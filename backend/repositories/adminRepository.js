const { getPool } = require('../../database/connection');

const getDashboardStats = async () => {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT
            (SELECT COUNT(*) FROM Users) AS totalUsers,
            (SELECT COUNT(*) FROM Users WHERE isAdmin = 1) AS totalAdmins,
            (SELECT COUNT(*) FROM Users WHERE isBlocked = 1) AS blockedUsers,
            (SELECT COUNT(*) FROM Trains) AS totalTrains,
            (SELECT COUNT(*) FROM Stations) AS totalStations,
            (SELECT COUNT(*) FROM Bookings) AS totalBookings,
            (SELECT COUNT(*) FROM Bookings WHERE status = 'Confirmed') AS confirmedBookings,
            (SELECT COUNT(*) FROM Bookings WHERE status = 'Pending') AS pendingBookings,
            (SELECT COUNT(*) FROM Bookings WHERE status = 'Waitlisted') AS waitlistedBookings,
            (SELECT COUNT(*) FROM Bookings WHERE status = 'Cancelled') AS cancelledBookings,
            (SELECT ISNULL(SUM(ISNULL(grandTotal, totalPrice)), 0) FROM Bookings WHERE status = 'Confirmed' AND paymentStatus = 'Paid') AS totalRevenue,
            (SELECT COUNT(*) FROM Bookings WHERE CAST(bookingDate AS DATE) = CAST(SYSUTCDATETIME() AS DATE)) AS todayBookings
    `);

    return result.recordset[0];
};

const getRevenueReport = async (fromDate, toDate) => {
    const pool = await getPool();
    const request = pool.request();
    let query = `
        SELECT CAST(bookingDate AS DATE) AS date,
               COUNT(*) AS bookingCount,
               SUM(ISNULL(grandTotal, totalPrice)) AS revenue
        FROM Bookings
        WHERE status = 'Confirmed' AND paymentStatus = 'Paid'
    `;

    if (fromDate) {
        query += ' AND CAST(bookingDate AS DATE) >= @fromDate';
        request.input('fromDate', 'Date', fromDate);
    }
    if (toDate) {
        query += ' AND CAST(bookingDate AS DATE) <= @toDate';
        request.input('toDate', 'Date', toDate);
    }

    query += ' GROUP BY CAST(bookingDate AS DATE) ORDER BY date ASC';
    const result = await request.query(query);
    return result.recordset.map((row) => ({
        date: row.date,
        bookingCount: row.bookingCount,
        revenue: Number(row.revenue)
    }));
};

const getOccupancyReport = async () => {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT t.id AS trainId, t.trainNumber, t.trainName, t.source, t.destination,
               tc.classCode, tc.className, tc.totalSeats, tc.availableSeats,
               (tc.totalSeats - tc.availableSeats) AS bookedSeats,
               CASE WHEN tc.totalSeats > 0
                    THEN CAST((tc.totalSeats - tc.availableSeats) * 100.0 / tc.totalSeats AS DECIMAL(5,1))
                    ELSE 0 END AS occupancyPercent
        FROM TrainClasses tc
        INNER JOIN Trains t ON tc.trainId = t.id
        ORDER BY occupancyPercent DESC, t.trainNumber ASC
    `);

    return result.recordset.map((row) => ({
        ...row,
        occupancyPercent: Number(row.occupancyPercent)
    }));
};

const getCancellationReport = async (fromDate, toDate) => {
    const pool = await getPool();
    const request = pool.request();
    let query = `
        SELECT CAST(updatedAt AS DATE) AS date,
               COUNT(*) AS cancellationCount,
               SUM(ISNULL(grandTotal, totalPrice)) AS lostRevenue
        FROM Bookings
        WHERE status = 'Cancelled'
    `;

    if (fromDate) {
        query += ' AND CAST(updatedAt AS DATE) >= @fromDate';
        request.input('fromDate', 'Date', fromDate);
    }
    if (toDate) {
        query += ' AND CAST(updatedAt AS DATE) <= @toDate';
        request.input('toDate', 'Date', toDate);
    }

    query += ' GROUP BY CAST(updatedAt AS DATE) ORDER BY date ASC';
    const result = await request.query(query);
    return result.recordset.map((row) => ({
        date: row.date,
        cancellationCount: row.cancellationCount,
        lostRevenue: Number(row.lostRevenue || 0)
    }));
};

const getRecentBookings = async (limit = 10) => {
    const pool = await getPool();
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
    const result = await pool.request().query(`
        SELECT TOP (${safeLimit}) b.id, b.pnrNumber, b.status,
               ISNULL(b.grandTotal, b.totalPrice) AS totalPrice, b.bookingDate,
               t.trainNumber, t.trainName, u.name AS userName
        FROM Bookings b
        INNER JOIN Trains t ON b.trainId = t.id
        INNER JOIN Users u ON b.userId = u.id
        ORDER BY b.bookingDate DESC
    `);
    return result.recordset;
};

module.exports = {
    getDashboardStats,
    getRevenueReport,
    getOccupancyReport,
    getCancellationReport,
    getRecentBookings
};
