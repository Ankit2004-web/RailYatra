const bcrypt = require('bcryptjs');
const { getPool } = require('../../database/connection');

const toSafeUser = (user) => {
    if (!user) return null;
    const { password, ...safe } = user;
    return { ...safe, isAdmin: !!safe.isAdmin, isBlocked: !!safe.isBlocked };
};

const findByEmail = async (email) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('email', 'NVarChar', email)
        .query('SELECT * FROM Users WHERE email = @email');
    return result.recordset[0] || null;
};

const findById = async (id) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('id', 'Int', id)
        .query('SELECT * FROM Users WHERE id = @id');
    return result.recordset[0] || null;
};

const create = async ({ name, email, password, phone, isAdmin = false }) => {
    const pool = await getPool();
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await pool.request()
        .input('name', 'NVarChar', name)
        .input('email', 'NVarChar', email)
        .input('password', 'NVarChar', hashedPassword)
        .input('phone', 'NVarChar', phone)
        .input('isAdmin', 'Bit', isAdmin)
        .query(`INSERT INTO Users (name, email, password, phone, isAdmin)
                OUTPUT INSERTED.*
                VALUES (@name, @email, @password, @phone, @isAdmin)`);

    return result.recordset[0];
};

const comparePassword = async (user, password) => bcrypt.compare(password, user.password);

const findAll = async () => {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT id, name, email, phone, isAdmin, isBlocked, createdAt
        FROM Users
        ORDER BY createdAt DESC
    `);
    return result.recordset.map((user) => toSafeUser(user));
};

const updateUser = async (id, { isAdmin, isBlocked }) => {
    const pool = await getPool();
    const updates = [];
    const request = pool.request().input('id', 'Int', id);

    if (typeof isAdmin === 'boolean') {
        updates.push('isAdmin = @isAdmin');
        request.input('isAdmin', 'Bit', isAdmin);
    }
    if (typeof isBlocked === 'boolean') {
        updates.push('isBlocked = @isBlocked');
        request.input('isBlocked', 'Bit', isBlocked);
    }

    if (!updates.length) return findById(id);

    const result = await request.query(`
        UPDATE Users SET ${updates.join(', ')}, updatedAt = SYSUTCDATETIME()
        OUTPUT INSERTED.*
        WHERE id = @id
    `);

    return result.recordset[0] ? toSafeUser(result.recordset[0]) : null;
};

const updatePassword = async (id, password) => {
    const pool = await getPool();
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await pool.request()
        .input('id', 'Int', id)
        .input('password', 'NVarChar', hashedPassword)
        .query('UPDATE Users SET password = @password, updatedAt = SYSUTCDATETIME() WHERE id = @id');
};

const updateProfile = async (id, { name, phone, theme }) => {
    const pool = await getPool();
    const request = pool.request().input('id', 'Int', id);

    const fields = [];
    if (name !== undefined) {
        fields.push('name = @name');
        request.input('name', 'NVarChar', name);
    }
    if (phone !== undefined) {
        fields.push('phone = @phone');
        request.input('phone', 'NVarChar', phone);
    }
    if (theme !== undefined) {
        fields.push('theme = @theme');
        request.input('theme', 'NVarChar', theme);
    }

    if (!fields.length) return findById(id).then(toSafeUser);

    const result = await request.query(`
        UPDATE Users SET ${fields.join(', ')}, updatedAt = SYSUTCDATETIME()
        OUTPUT INSERTED.*
        WHERE id = @id
    `);
    return result.recordset[0] ? toSafeUser(result.recordset[0]) : null;
};

const updateAvatar = async (id, avatarUrl) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('id', 'Int', id)
        .input('avatarUrl', 'NVarChar', avatarUrl)
        .query(`
            UPDATE Users SET avatarUrl = @avatarUrl, updatedAt = SYSUTCDATETIME()
            OUTPUT INSERTED.*
            WHERE id = @id
        `);
    return result.recordset[0] ? toSafeUser(result.recordset[0]) : null;
};

const clearAvatar = async (id) => updateAvatar(id, null);

const getBookingStats = async (userId) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('userId', 'Int', userId)
        .query(`SELECT
            COUNT(*) AS totalBookings,
            SUM(CASE WHEN status = 'Confirmed' THEN 1 ELSE 0 END) AS confirmedBookings,
            SUM(CASE WHEN status IN ('Waitlisted', 'RAC') THEN 1 ELSE 0 END) AS waitlistedBookings,
            SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelledBookings,
            ISNULL(SUM(CASE WHEN status <> 'Cancelled' THEN totalPrice ELSE 0 END), 0) AS totalSpent
            FROM Bookings WHERE userId = @userId`);
    const row = result.recordset[0] || {};
    return {
        totalBookings: row.totalBookings || 0,
        confirmedBookings: row.confirmedBookings || 0,
        waitlistedBookings: row.waitlistedBookings || 0,
        cancelledBookings: row.cancelledBookings || 0,
        totalSpent: Number(row.totalSpent || 0)
    };
};

module.exports = {
    findByEmail,
    findById,
    create,
    comparePassword,
    toSafeUser,
    findAll,
    updateUser,
    updatePassword,
    updateProfile,
    updateAvatar,
    clearAvatar,
    getBookingStats
};
