const { getPool } = require('../../database/connection');

const enqueue = async ({ aggregateType, aggregateId, eventType, payload }) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('aggregateType', 'NVarChar', aggregateType)
        .input('aggregateId', 'Int', aggregateId)
        .input('eventType', 'NVarChar', eventType)
        .input('payload', 'NVarChar', JSON.stringify(payload))
        .query(`INSERT INTO OutboxEvents (aggregateType, aggregateId, eventType, payload)
                OUTPUT INSERTED.id VALUES (@aggregateType, @aggregateId, @eventType, @payload)`);
    return result.recordset[0];
};

const fetchPending = async (limit = 50) => {
    const pool = await getPool();
    const safeLimit = Math.min(limit, 100);
    const result = await pool.request().query(`
        SELECT TOP (${safeLimit}) * FROM OutboxEvents WITH (UPDLOCK, ROWLOCK)
        WHERE status = 'Pending' AND attempts < 5
        ORDER BY createdAt ASC`);
    return result.recordset;
};

const markDone = async (id) => {
    const pool = await getPool();
    await pool.request()
        .input('id', 'Int', id)
        .query(`UPDATE OutboxEvents SET status = 'Processed', processedAt = SYSUTCDATETIME() WHERE id = @id`);
};

const markFailed = async (id, error) => {
    const pool = await getPool();
    await pool.request()
        .input('id', 'Int', id)
        .input('error', 'NVarChar', String(error).slice(0, 500))
        .query(`UPDATE OutboxEvents SET status = 'Pending', attempts = attempts + 1, lastError = @error WHERE id = @id`);
};

module.exports = { enqueue, fetchPending, markDone, markFailed };
