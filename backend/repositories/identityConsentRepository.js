const { getPool } = require('../../database/connection');
const { NOTICE_VERSION } = require('../utils/identityPrivacy');

const grant = async (userId, { purpose, documentType = null }) => {
    const pool = await getPool();
    const existing = await pool.request()
        .input('userId', 'Int', userId)
        .input('purpose', 'NVarChar', purpose)
        .query(`SELECT TOP 1 * FROM IdentityConsents
                WHERE userId = @userId AND purpose = @purpose AND withdrawnAt IS NULL
                ORDER BY grantedAt DESC`);
    if (existing.recordset[0]) return existing.recordset[0];

    await pool.request()
        .input('userId', 'Int', userId)
        .input('purpose', 'NVarChar', purpose)
        .input('documentType', 'NVarChar', documentType)
        .input('noticeVersion', 'NVarChar', NOTICE_VERSION)
        .query(`INSERT INTO IdentityConsents (userId, purpose, documentType, granted, noticeVersion)
                VALUES (@userId, @purpose, @documentType, 1, @noticeVersion)`);
    const created = await pool.request()
        .input('userId', 'Int', userId)
        .input('purpose', 'NVarChar', purpose)
        .query(`SELECT TOP 1 * FROM IdentityConsents
                WHERE userId = @userId AND purpose = @purpose
                ORDER BY grantedAt DESC`);
    return created.recordset[0];
};

const withdraw = async (userId, purpose) => {
    const pool = await getPool();
    await pool.request()
        .input('userId', 'Int', userId)
        .input('purpose', 'NVarChar', purpose)
        .query(`UPDATE IdentityConsents
                SET granted = 0, withdrawnAt = SYSUTCDATETIME()
                WHERE userId = @userId AND purpose = @purpose AND withdrawnAt IS NULL`);
};

const listByUser = async (userId) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('userId', 'Int', userId)
        .query(`SELECT * FROM IdentityConsents WHERE userId = @userId ORDER BY grantedAt DESC`);
    return result.recordset;
};

const hasActive = async (userId, purpose) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('userId', 'Int', userId)
        .input('purpose', 'NVarChar', purpose)
        .query(`SELECT TOP 1 id FROM IdentityConsents
                WHERE userId = @userId AND purpose = @purpose AND granted = 1 AND withdrawnAt IS NULL`);
    return Boolean(result.recordset[0]);
};

module.exports = { grant, withdraw, listByUser, hasActive };
