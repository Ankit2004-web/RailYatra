const { getPool } = require('../../database/connection');
const {
    classifyIdType,
    looksLikePlainIdentity,
    maskIdentity,
    last4,
    hmacFingerprint,
    encryptIdentity,
    newVaultToken,
    NOTICE_VERSION
} = require('../utils/identityPrivacy');

const mapVaultRow = (row) => {
    if (!row) return null;
    return {
        token: row.token,
        idType: row.idType,
        masked: row.maskedNumber,
        purpose: row.purpose,
        saveForLater: Boolean(row.saveForLater),
        createdAt: row.createdAt,
        expiresAt: row.expiresAt || null
    };
};

const insertVaultRecord = async ({
    userId,
    idType,
    rawNumber,
    purpose,
    saveForLater = false
}) => {
    const kind = classifyIdType(idType);
    const fingerprint = hmacFingerprint(kind, rawNumber);
    const masked = maskIdentity(kind, rawNumber);
    const token = newVaultToken();
    const encrypted = saveForLater ? encryptIdentity(rawNumber) : { iv: null, authTag: null, ciphertext: null };
    const pool = await getPool();
    await pool.request()
        .input('token', 'NVarChar', token)
        .input('userId', 'Int', userId)
        .input('idType', 'NVarChar', kind)
        .input('fingerprint', 'NVarChar', fingerprint)
        .input('last4', 'NVarChar', last4(kind, rawNumber))
        .input('maskedNumber', 'NVarChar', masked)
        .input('ciphertext', 'NVarChar', encrypted.ciphertext)
        .input('iv', 'NVarChar', encrypted.iv)
        .input('authTag', 'NVarChar', encrypted.authTag)
        .input('purpose', 'NVarChar', purpose)
        .input('saveForLater', 'Bit', saveForLater ? 1 : 0)
        .input('consentVersion', 'NVarChar', NOTICE_VERSION)
        .query(`INSERT INTO IdentityVault
            (token, userId, idType, fingerprint, last4, maskedNumber, ciphertext, iv, authTag, purpose, saveForLater, consentVersion)
            VALUES (@token, @userId, @idType, @fingerprint, @last4, @maskedNumber, @ciphertext, @iv, @authTag, @purpose, @saveForLater, @consentVersion)`);
    return { token, fingerprint, masked, idType: kind };
};

const protectPassengerIdentities = async (userId, passengers, { purpose, saveForLater = false } = {}) => {
    const protectedList = [];
    for (const passenger of passengers || []) {
        const raw = String(passenger.idNumber || '').trim();
        if (!raw || !looksLikePlainIdentity(passenger.idType, raw)) {
            protectedList.push({
                ...passenger,
                idNumber: raw ? maskIdentity(passenger.idType, raw) : null,
                idToken: passenger.idToken || null,
                idFingerprint: passenger.idFingerprint || null
            });
            continue;
        }
        const stored = await insertVaultRecord({
            userId,
            idType: passenger.idType,
            rawNumber: raw,
            purpose: purpose || 'journey_id_proof',
            saveForLater: Boolean(saveForLater)
        });
        protectedList.push({
            ...passenger,
            idType: stored.idType,
            idNumber: stored.masked,
            idToken: stored.token,
            idFingerprint: stored.fingerprint
        });
    }
    return protectedList;
};

const listByUser = async (userId) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('userId', 'Int', userId)
        .query(`SELECT token, idType, maskedNumber, purpose, saveForLater, createdAt, expiresAt
                FROM IdentityVault
                WHERE userId = @userId
                ORDER BY createdAt DESC`);
    return result.recordset.map(mapVaultRow);
};

const unlink = async (userId, token) => {
    const pool = await getPool();
    await pool.request()
        .input('userId', 'Int', userId)
        .input('token', 'NVarChar', token)
        .query(`UPDATE Passengers SET idToken = NULL WHERE idToken = @token`);
    try {
        await pool.request()
            .input('userId', 'Int', userId)
            .input('token', 'NVarChar', token)
            .query(`UPDATE SavedPassengers SET idToken = NULL, idType = NULL, idNumber = NULL, idFingerprint = NULL
                    WHERE userId = @userId AND idToken = @token`);
    } catch (_) { /* older schemas may not have identity columns on SavedPassengers */ }
    const result = await pool.request()
        .input('userId', 'Int', userId)
        .input('token', 'NVarChar', token)
        .query('DELETE FROM IdentityVault WHERE userId = @userId AND token = @token');
    return result.rowsAffected[0] > 0;
};

const unlinkAllForUser = async (userId) => {
    const pool = await getPool();
    await pool.request()
        .input('userId', 'Int', userId)
        .query(`UPDATE Passengers SET idToken = NULL
                WHERE idToken IN (SELECT token FROM IdentityVault WHERE userId = @userId)`);
    try {
        await pool.request()
            .input('userId', 'Int', userId)
            .query(`UPDATE SavedPassengers SET idToken = NULL, idType = NULL, idNumber = NULL, idFingerprint = NULL
                    WHERE userId = @userId`);
    } catch (_) { /* older schemas */ }
    await pool.request()
        .input('userId', 'Int', userId)
        .query('DELETE FROM IdentityVault WHERE userId = @userId');
};

const listUserIdsWithVault = async () => {
    const pool = await getPool();
    const result = await pool.request().query('SELECT DISTINCT userId FROM IdentityVault WHERE userId IS NOT NULL');
    return result.recordset.map((row) => row.userId);
};

const scrubPlaintextPassengers = async () => {
    const pool = await getPool();
    const rows = await pool.request().query('SELECT id, bookingId, idType, idNumber FROM Passengers WHERE idNumber IS NOT NULL');
    let scrubbed = 0;
    for (const row of rows.recordset || []) {
        if (!looksLikePlainIdentity(row.idType, row.idNumber)) continue;
        const booking = await pool.request()
            .input('bookingId', 'Int', row.bookingId)
            .query('SELECT userId FROM Bookings WHERE id = @bookingId');
        const userId = booking.recordset[0]?.userId || null;
        const stored = await insertVaultRecord({
            userId,
            idType: row.idType,
            rawNumber: row.idNumber,
            purpose: 'journey_id_proof',
            saveForLater: false
        });
        await pool.request()
            .input('id', 'Int', row.id)
            .input('idNumber', 'NVarChar', stored.masked)
            .input('idToken', 'NVarChar', stored.token)
            .input('idFingerprint', 'NVarChar', stored.fingerprint)
            .query(`UPDATE Passengers
                    SET idNumber = @idNumber, idToken = @idToken, idFingerprint = @idFingerprint
                    WHERE id = @id`);
        scrubbed += 1;
    }
    return scrubbed;
};

module.exports = {
    insertVaultRecord,
    protectPassengerIdentities,
    listByUser,
    unlink,
    unlinkAllForUser,
    listUserIdsWithVault,
    scrubPlaintextPassengers,
    mapVaultRow
};
