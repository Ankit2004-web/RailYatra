const { getPool } = require('../../database/connection');

const defaults = {
    notifyBooking: true,
    notifyRefund: true,
    notifyDelay: true,
    notifyChart: true,
    gstNumber: null,
    gstBusinessName: null
};

const findByUserId = async (userId) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('userId', 'Int', userId)
        .query('SELECT * FROM UserPreferences WHERE userId = @userId');
    return result.recordset[0] || { userId, ...defaults };
};

const upsert = async (userId, prefs) => {
    const pool = await getPool();
    const existing = await findByUserId(userId);
    const merged = { ...existing, ...prefs, userId };

    if (existing.userId && existing.notifyBooking !== undefined && !prefs._forceCreate) {
        await pool.request()
            .input('userId', 'Int', userId)
            .input('notifyBooking', 'Bit', merged.notifyBooking ? 1 : 0)
            .input('notifyRefund', 'Bit', merged.notifyRefund ? 1 : 0)
            .input('notifyDelay', 'Bit', merged.notifyDelay ? 1 : 0)
            .input('notifyChart', 'Bit', merged.notifyChart ? 1 : 0)
            .input('gstNumber', 'NVarChar', merged.gstNumber || null)
            .input('gstBusinessName', 'NVarChar', merged.gstBusinessName || null)
            .query(`UPDATE UserPreferences SET
                notifyBooking = @notifyBooking, notifyRefund = @notifyRefund,
                notifyDelay = @notifyDelay, notifyChart = @notifyChart,
                gstNumber = @gstNumber, gstBusinessName = @gstBusinessName,
                updatedAt = SYSUTCDATETIME() WHERE userId = @userId`);
    } else {
        await pool.request()
            .input('userId', 'Int', userId)
            .input('notifyBooking', 'Bit', merged.notifyBooking ? 1 : 0)
            .input('notifyRefund', 'Bit', merged.notifyRefund ? 1 : 0)
            .input('notifyDelay', 'Bit', merged.notifyDelay ? 1 : 0)
            .input('notifyChart', 'Bit', merged.notifyChart ? 1 : 0)
            .input('gstNumber', 'NVarChar', merged.gstNumber || null)
            .input('gstBusinessName', 'NVarChar', merged.gstBusinessName || null)
            .query(`INSERT INTO UserPreferences (userId, notifyBooking, notifyRefund, notifyDelay, notifyChart, gstNumber, gstBusinessName)
                    VALUES (@userId, @notifyBooking, @notifyRefund, @notifyDelay, @notifyChart, @gstNumber, @gstBusinessName)`);
    }
    return findByUserId(userId);
};

module.exports = { findByUserId, upsert, defaults };
