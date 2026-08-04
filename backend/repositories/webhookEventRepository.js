const { getPool } = require('../../database/connection');

const isProcessed = async (provider, eventId) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('provider', 'NVarChar', provider)
        .input('eventId', 'NVarChar', eventId)
        .query('SELECT 1 AS ok FROM WebhookEvents WHERE provider = @provider AND eventId = @eventId');
    return result.recordset.length > 0;
};

const markProcessed = async ({ provider, eventId, eventType, payload }) => {
    const pool = await getPool();
    try {
        await pool.request()
            .input('provider', 'NVarChar', provider)
            .input('eventId', 'NVarChar', eventId)
            .input('eventType', 'NVarChar', eventType)
            .input('payload', 'NVarChar', payload ? JSON.stringify(payload).slice(0, 4000) : null)
            .query(`INSERT INTO WebhookEvents (provider, eventId, eventType, payload)
                    VALUES (@provider, @eventId, @eventType, @payload)`);
        return true;
    } catch (err) {
        if (err.message?.includes('UNIQUE') || err.message?.includes('duplicate')) {
            return false;
        }
        throw err;
    }
};

module.exports = { isProcessed, markProcessed };
