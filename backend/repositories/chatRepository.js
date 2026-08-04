const { getPool } = require('../../database/connection');

const findBySession = async (sessionId, limit = 100) => {
    const pool = await getPool();
    const safeLimit = Math.min(limit, 200);
    const result = await pool.request()
        .input('sessionId', 'NVarChar', sessionId)
        .query(`SELECT TOP (${safeLimit}) * FROM SupportChatMessages
                WHERE sessionId = @sessionId ORDER BY createdAt ASC`);
    return result.recordset;
};

const addMessage = async ({ userId, sessionId, sender, message }) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('userId', 'Int', userId || null)
        .input('sessionId', 'NVarChar', sessionId)
        .input('sender', 'NVarChar', sender)
        .input('message', 'NVarChar', message)
        .query(`INSERT INTO SupportChatMessages (userId, sessionId, sender, message)
                OUTPUT INSERTED.* VALUES (@userId, @sessionId, @sender, @message)`);
    return result.recordset[0];
};

module.exports = { findBySession, addMessage };
