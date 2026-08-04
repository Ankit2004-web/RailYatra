const { getPool } = require('../../database/connection');

const findByUserId = async (userId) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('userId', 'Int', userId)
        .query('SELECT * FROM FavoriteRoutes WHERE userId = @userId ORDER BY createdAt DESC');
    return result.recordset;
};

const create = async ({ userId, sourceCode, destinationCode, label }) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('userId', 'Int', userId)
        .input('sourceCode', 'NVarChar', sourceCode.toUpperCase())
        .input('destinationCode', 'NVarChar', destinationCode.toUpperCase())
        .input('label', 'NVarChar', label || null)
        .query(`INSERT INTO FavoriteRoutes (userId, sourceCode, destinationCode, label)
                OUTPUT INSERTED.* VALUES (@userId, @sourceCode, @destinationCode, @label)`);
    return result.recordset[0];
};

const remove = async (id, userId) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('id', 'Int', id)
        .input('userId', 'Int', userId)
        .query('DELETE FROM FavoriteRoutes WHERE id = @id AND userId = @userId');
    return result.rowsAffected[0] > 0;
};

module.exports = { findByUserId, create, remove };
