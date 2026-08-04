const crypto = require('crypto');
const { getPool } = require('../../database/connection');

const TTL_HOURS = 24;

const find = async (key, route) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('key', 'NVarChar', key)
        .input('route', 'NVarChar', route)
        .query(`SELECT * FROM IdempotencyKeys
                WHERE idempotencyKey = @key AND route = @route AND expiresAt > SYSUTCDATETIME()`);
    return result.recordset[0] || null;
};

const save = async ({ key, userId, route, statusCode, responseBody }) => {
    const pool = await getPool();
    const expiresAt = new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000);
    await pool.request()
        .input('key', 'NVarChar', key)
        .input('userId', 'Int', userId || null)
        .input('route', 'NVarChar', route)
        .input('statusCode', 'Int', statusCode)
        .input('body', 'NVarChar', JSON.stringify(responseBody))
        .input('expiresAt', 'DateTime2', expiresAt)
        .query(`MERGE IdempotencyKeys AS target
                USING (SELECT @key AS idempotencyKey, @route AS route) AS source
                ON target.idempotencyKey = source.idempotencyKey AND target.route = source.route
                WHEN MATCHED THEN UPDATE SET statusCode = @statusCode, responseBody = @body, expiresAt = @expiresAt
                WHEN NOT MATCHED THEN INSERT (idempotencyKey, userId, route, statusCode, responseBody, expiresAt)
                VALUES (@key, @userId, @route, @statusCode, @body, @expiresAt);`);
};

const hashKey = (userId, clientKey) => {
    if (clientKey) return clientKey.slice(0, 64);
    return crypto.randomBytes(16).toString('hex');
};

module.exports = { find, save, hashKey, TTL_HOURS };
