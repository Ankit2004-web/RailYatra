const { getPool } = require('../../database/connection');

const findByProvider = async (provider, providerUserId) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('provider', 'NVarChar', provider)
        .input('providerUserId', 'NVarChar', providerUserId)
        .query('SELECT * FROM OAuthAccounts WHERE provider = @provider AND providerUserId = @providerUserId');
    return result.recordset[0] || null;
};

const link = async ({ userId, provider, providerUserId, email }) => {
    const pool = await getPool();
    await pool.request()
        .input('userId', 'Int', userId)
        .input('provider', 'NVarChar', provider)
        .input('providerUserId', 'NVarChar', providerUserId)
        .input('email', 'NVarChar', email || null)
        .query(`INSERT INTO OAuthAccounts (userId, provider, providerUserId, email)
                VALUES (@userId, @provider, @providerUserId, @email)`);
};

module.exports = { findByProvider, link };
