const { getPool } = require('../../database/connection');

const findByUserId = async (userId, limit = 50) => {
    const pool = await getPool();
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const result = await pool.request()
        .input('userId', 'Int', userId)
        .query(`SELECT TOP (${safeLimit}) * FROM Notifications
                WHERE userId = @userId ORDER BY createdAt DESC`);
    return result.recordset;
};

const create = async ({ userId, type, title, message, meta = null }) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('userId', 'Int', userId)
        .input('type', 'NVarChar', type)
        .input('title', 'NVarChar', title)
        .input('message', 'NVarChar', message)
        .input('meta', 'NVarChar', meta ? JSON.stringify(meta) : null)
        .query(`INSERT INTO Notifications (userId, type, title, message, meta)
                OUTPUT INSERTED.*
                VALUES (@userId, @type, @title, @message, @meta)`);
    return result.recordset[0];
};

const markRead = async (id, userId) => {
    const pool = await getPool();
    await pool.request()
        .input('id', 'Int', id)
        .input('userId', 'Int', userId)
        .query(`UPDATE Notifications SET isRead = 1, updatedAt = SYSUTCDATETIME()
                WHERE id = @id AND userId = @userId`);
};

const markAllRead = async (userId) => {
    const pool = await getPool();
    await pool.request()
        .input('userId', 'Int', userId)
        .query(`UPDATE Notifications SET isRead = 1, updatedAt = SYSUTCDATETIME()
                WHERE userId = @userId AND isRead = 0`);
};

module.exports = {
    findByUserId,
    create,
    markRead,
    markAllRead
};
