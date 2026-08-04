const { getPool } = require('../../database/connection');

const log = async ({ userId, action, resource, details, ipAddress }) => {
    const pool = await getPool();
    await pool.request()
        .input('userId', 'Int', userId || null)
        .input('action', 'NVarChar', action)
        .input('resource', 'NVarChar', resource || null)
        .input('details', 'NVarChar', details ? JSON.stringify(details).slice(0, 4000) : null)
        .input('ipAddress', 'NVarChar', ipAddress || null)
        .query(`INSERT INTO AuditLogs (userId, action, resource, details, ipAddress)
                VALUES (@userId, @action, @resource, @details, @ipAddress)`);
};

const findRecent = async (limit = 100) => {
    const pool = await getPool();
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
    const result = await pool.request().query(`
        SELECT TOP (${safeLimit}) a.*, u.name AS userName, u.email AS userEmail
        FROM AuditLogs a
        LEFT JOIN Users u ON a.userId = u.id
        ORDER BY a.createdAt DESC
    `);
    return result.recordset;
};

module.exports = {
    log,
    findRecent
};
