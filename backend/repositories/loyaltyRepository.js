const { getPool } = require('../../database/connection');

const tierForPoints = (points) => {
    if (points >= 5000) return 'Platinum';
    if (points >= 2000) return 'Gold';
    return 'Silver';
};

const findByUserId = async (userId) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('userId', 'Int', userId)
        .query('SELECT * FROM UserLoyalty WHERE userId = @userId');
    if (result.recordset[0]) return result.recordset[0];
    return { userId, points: 0, tier: 'Silver', lifetimePoints: 0 };
};

const ensure = async (userId) => {
    const existing = await findByUserId(userId);
    if (existing.userId && existing.points !== undefined) return existing;
    const pool = await getPool();
    await pool.request()
        .input('userId', 'Int', userId)
        .query(`INSERT INTO UserLoyalty (userId, points, tier, lifetimePoints) VALUES (@userId, 0, 'Silver', 0)`);
    return findByUserId(userId);
};

const addPoints = async (userId, points, reason) => {
    await ensure(userId);
    const pool = await getPool();
    await pool.request()
        .input('userId', 'Int', userId)
        .input('points', 'Int', points)
        .query(`UPDATE UserLoyalty SET
            points = points + @points,
            lifetimePoints = lifetimePoints + @points,
            updatedAt = SYSUTCDATETIME()
            WHERE userId = @userId`);
    const row = await findByUserId(userId);
    const tier = tierForPoints(row.points);
    if (tier !== row.tier) {
        await pool.request()
            .input('userId', 'Int', userId)
            .input('tier', 'NVarChar', tier)
            .query('UPDATE UserLoyalty SET tier = @tier WHERE userId = @userId');
        row.tier = tier;
    }
    row.lastReason = reason;
    return row;
};

module.exports = { findByUserId, ensure, addPoints, tierForPoints };
