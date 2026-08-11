const bcrypt = require('bcryptjs');
const { getPool } = require('../../database/connection');
const { resolveRole } = require('../constants/roles');
const { normalizeEmail } = require('../utils/email');

const normalizePhone = (value) => String(value || '').replace(/\D/g, '').slice(-10);

const toSafeUser = (user) => {
    if (!user) return null;
    const { password, ...safe } = user;
    const role = resolveRole(safe);
    return {
        ...safe,
        role,
        isAdmin: role === 'admin' || !!safe.isAdmin,
        isBlocked: !!safe.isBlocked
    };
};

const findByEmail = async (email) => {
    const pool = await getPool();
    const input = String(email || '').trim().toLowerCase();
    const needle = normalizeEmail(input);

    const exact = await pool.request()
        .input('email', 'NVarChar', needle)
        .query('SELECT TOP 1 * FROM Users WHERE LOWER(TRIM(email)) = @email');
    if (exact.recordset[0]) return exact.recordset[0];

    if (needle !== input) {
        const raw = await pool.request()
            .input('email', 'NVarChar', input)
            .query('SELECT TOP 1 * FROM Users WHERE LOWER(TRIM(email)) = @email');
        if (raw.recordset[0]) return raw.recordset[0];
    }

    const candidates = await pool.request()
        .input('gmail', 'NVarChar', '%@gmail.com')
        .input('googlemail', 'NVarChar', '%@googlemail.com')
        .query(`SELECT * FROM Users WHERE email IS NOT NULL AND (
            LOWER(email) LIKE @gmail OR LOWER(email) LIKE @googlemail
        )`);

    return candidates.recordset.find((user) => normalizeEmail(user.email) === needle) || null;
};

const findByPhone = async (phone) => {
    const normalized = normalizePhone(phone);
    if (normalized.length !== 10) return null;
    const pool = await getPool();
    const localEmail = `${normalized}@railyatra.local`;
    const result = await pool.request()
        .input('phone', 'NVarChar', normalized)
        .input('localEmail', 'NVarChar', localEmail)
        .query(`SELECT TOP 1 * FROM Users
            WHERE phone = @phone
               OR LOWER(TRIM(email)) = LOWER(@localEmail)`);
    return result.recordset[0] || null;
};

/** Resolve a login id (mobile or email) to a stored user row. */
const resolveLoginUser = async (loginId) => {
    const raw = String(loginId || '').trim();
    if (!raw) return null;

    if (raw.includes('@')) {
        return findByEmail(raw);
    }

    const phone = normalizePhone(raw);
    if (phone.length !== 10) return null;

    return findByPhone(phone);
};

const findById = async (id) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('id', 'Int', id)
        .query('SELECT * FROM Users WHERE id = @id');
    return result.recordset[0] || null;
};

const create = async ({ name, email, password, phone, isAdmin = false, role = 'passenger' }) => {
    const pool = await getPool();
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const resolvedRole = isAdmin ? 'admin' : role;
    const normalizedPhone = normalizePhone(phone);

    const result = await pool.request()
        .input('name', 'NVarChar', name)
        .input('email', 'NVarChar', email)
        .input('password', 'NVarChar', hashedPassword)
        .input('phone', 'NVarChar', normalizedPhone.length === 10 ? normalizedPhone : phone)
        .input('isAdmin', 'Bit', resolvedRole === 'admin')
        .input('role', 'NVarChar', resolvedRole)
        .query(`INSERT INTO Users (name, email, password, phone, isAdmin, role)
                OUTPUT INSERTED.*
                VALUES (@name, @email, @password, @phone, @isAdmin, @role)`);

    return result.recordset[0];
};

const comparePassword = async (user, password) => bcrypt.compare(password, user.password);

const findAll = async () => {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT id, name, email, phone, isAdmin, isBlocked, role, createdAt
        FROM Users
        ORDER BY createdAt DESC
    `);
    return result.recordset.map((user) => toSafeUser(user));
};

const updateUser = async (id, { isAdmin, isBlocked, role }) => {
    const pool = await getPool();
    const updates = [];
    const request = pool.request().input('id', 'Int', id);

    if (typeof isAdmin === 'boolean') {
        updates.push('isAdmin = @isAdmin');
        request.input('isAdmin', 'Bit', isAdmin);
        if (isAdmin) {
            updates.push("role = 'admin'");
        }
    }
    if (typeof isBlocked === 'boolean') {
        updates.push('isBlocked = @isBlocked');
        request.input('isBlocked', 'Bit', isBlocked);
    }
    if (role) {
        updates.push('role = @role');
        request.input('role', 'NVarChar', role);
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

const registerDevice = async (userId, { deviceLabel, userAgent }) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('userId', 'Int', userId)
        .input('deviceLabel', 'NVarChar', deviceLabel)
        .input('userAgent', 'NVarChar', userAgent)
        .query(`INSERT INTO UserDevices (userId, deviceLabel, userAgent)
                OUTPUT INSERTED.* VALUES (@userId, @deviceLabel, @userAgent)`);
    return result.recordset[0];
};

const listDevices = async (userId) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('userId', 'Int', userId)
        .query('SELECT * FROM UserDevices WHERE userId = @userId ORDER BY lastSeenAt DESC');
    return result.recordset;
};

const setMfaSecret = async (userId, secret) => {
    const pool = await getPool();
    await pool.request()
        .input('id', 'Int', userId)
        .input('secret', 'NVarChar', secret)
        .query('UPDATE Users SET mfaSecret = @secret, updatedAt = SYSUTCDATETIME() WHERE id = @id');
};

const setMfaEnabled = async (userId, enabled) => {
    const pool = await getPool();
    await pool.request()
        .input('id', 'Int', userId)
        .input('enabled', 'Bit', enabled ? 1 : 0)
        .query('UPDATE Users SET mfaEnabled = @enabled, updatedAt = SYSUTCDATETIME() WHERE id = @id');
};

module.exports = {
    findByEmail,
    findByPhone,
    resolveLoginUser,
    normalizePhone,
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
    getBookingStats,
    registerDevice,
    listDevices,
    setMfaSecret,
    setMfaEnabled
};
