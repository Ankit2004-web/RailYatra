const crypto = require('crypto');
const { getPool } = require('../../database/connection');

const get = async (cacheKey) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('key', 'NVarChar', cacheKey)
        .query(`SELECT payload FROM SearchCache WHERE cacheKey = @key AND expiresAt > SYSUTCDATETIME()`);
    if (!result.recordset[0]) return null;
    try {
        return JSON.parse(result.recordset[0].payload);
    } catch {
        return null;
    }
};

const set = async (cacheKey, payload, ttlMinutes = 10) => {
    const pool = await getPool();
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    const isSqlite = (process.env.DB_DRIVER || '').toLowerCase() === 'sqlite';

    if (isSqlite) {
        await pool.request()
            .input('key', 'NVarChar', cacheKey)
            .input('payload', 'NVarChar', JSON.stringify(payload))
            .input('expiresAt', 'DateTime2', expiresAt)
            .query(`INSERT INTO SearchCache (cacheKey, payload, expiresAt)
                    VALUES (@key, @payload, @expiresAt)
                    ON CONFLICT(cacheKey) DO UPDATE SET payload = @payload, expiresAt = @expiresAt`);
        return;
    }

    await pool.request()
        .input('key', 'NVarChar', cacheKey)
        .input('payload', 'NVarChar', JSON.stringify(payload))
        .input('expiresAt', 'DateTime2', expiresAt)
        .query(`MERGE SearchCache AS target
                USING (SELECT @key AS cacheKey) AS source ON target.cacheKey = source.cacheKey
                WHEN MATCHED THEN UPDATE SET payload = @payload, expiresAt = @expiresAt
                WHEN NOT MATCHED THEN INSERT (cacheKey, payload, expiresAt) VALUES (@key, @payload, @expiresAt);`);
};

const buildKey = (params) =>
    crypto.createHash('sha256').update(JSON.stringify(params)).digest('hex').slice(0, 64);

const purgeExpired = async () => {
    const pool = await getPool();
    await pool.request().query('DELETE FROM SearchCache WHERE expiresAt < SYSUTCDATETIME()');
};

module.exports = { get, set, buildKey, purgeExpired };
