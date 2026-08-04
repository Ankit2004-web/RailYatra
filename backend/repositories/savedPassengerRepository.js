const { getPool } = require('../../database/connection');

const mapRow = (row) => ({
    id: row.id,
    name: row.name,
    age: row.age,
    gender: row.gender,
    berthPreference: row.berthPreference || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
});

const findByUserId = async (userId) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('userId', 'Int', userId)
        .query('SELECT * FROM SavedPassengers WHERE userId = @userId ORDER BY name ASC');
    return result.recordset.map(mapRow);
};

const findById = async (id, userId) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('id', 'Int', id)
        .input('userId', 'Int', userId)
        .query('SELECT * FROM SavedPassengers WHERE id = @id AND userId = @userId');
    const row = result.recordset[0];
    return row ? mapRow(row) : null;
};

const create = async (userId, { name, age, gender, berthPreference }) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('userId', 'Int', userId)
        .input('name', 'NVarChar', name.trim())
        .input('age', 'Int', age)
        .input('gender', 'NVarChar', gender)
        .input('berthPreference', 'NVarChar', berthPreference || null)
        .query(`INSERT INTO SavedPassengers (userId, name, age, gender, berthPreference)
                OUTPUT INSERTED.*
                VALUES (@userId, @name, @age, @gender, @berthPreference)`);
    return mapRow(result.recordset[0]);
};

const update = async (id, userId, { name, age, gender, berthPreference }) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('id', 'Int', id)
        .input('userId', 'Int', userId)
        .input('name', 'NVarChar', name.trim())
        .input('age', 'Int', age)
        .input('gender', 'NVarChar', gender)
        .input('berthPreference', 'NVarChar', berthPreference || null)
        .query(`UPDATE SavedPassengers
                SET name = @name, age = @age, gender = @gender, berthPreference = @berthPreference,
                    updatedAt = SYSUTCDATETIME()
                OUTPUT INSERTED.*
                WHERE id = @id AND userId = @userId`);
    const row = result.recordset[0];
    return row ? mapRow(row) : null;
};

const remove = async (id, userId) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('id', 'Int', id)
        .input('userId', 'Int', userId)
        .query('DELETE FROM SavedPassengers WHERE id = @id AND userId = @userId');
    return result.rowsAffected[0] > 0;
};

module.exports = {
    findByUserId,
    findById,
    create,
    update,
    remove
};
