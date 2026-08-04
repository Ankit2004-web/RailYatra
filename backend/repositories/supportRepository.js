const { getPool } = require('../../database/connection');

const create = async ({ userId, subject, category, message }) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('userId', 'Int', userId || null)
        .input('subject', 'NVarChar', subject)
        .input('category', 'NVarChar', category)
        .input('message', 'NVarChar', message)
        .query(`INSERT INTO SupportTickets (userId, subject, category, message, status)
                OUTPUT INSERTED.*
                VALUES (@userId, @subject, @category, @message, 'Open')`);
    return result.recordset[0];
};

const findByUserId = async (userId) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('userId', 'Int', userId)
        .query(`SELECT * FROM SupportTickets WHERE userId = @userId ORDER BY createdAt DESC`);
    return result.recordset;
};

const findAll = async ({ status } = {}) => {
    const pool = await getPool();
    let query = `SELECT t.*, u.name AS userName, u.email AS userEmail
                 FROM SupportTickets t
                 LEFT JOIN Users u ON t.userId = u.id WHERE 1=1`;
    const request = pool.request();
    if (status) {
        query += ' AND t.status = @status';
        request.input('status', 'NVarChar', status);
    }
    query += ' ORDER BY t.createdAt DESC';
    const result = await request.query(query);
    return result.recordset;
};

const updateStatus = async (id, status) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('id', 'Int', id)
        .input('status', 'NVarChar', status)
        .query(`UPDATE SupportTickets SET status = @status, updatedAt = SYSUTCDATETIME()
                OUTPUT INSERTED.* WHERE id = @id`);
    return result.recordset[0] || null;
};

module.exports = {
    create,
    findByUserId,
    findAll,
    updateStatus
};
