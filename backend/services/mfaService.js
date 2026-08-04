const { generateSecret, verifySync, generateURI } = require('otplib');
const crypto = require('crypto');

const getOtpAuthUrl = (email, secret) =>
    generateURI({ issuer: 'RailYatra', label: email || 'user@railyatra.com', secret });

const verifyToken = (secret, token) => {
    if (!secret || !token) return false;
    try {
        return verifySync({ secret, token: String(token).trim(), epochTolerance: 1 });
    } catch {
        return false;
    }
};

const hashBackupCode = (code) =>
    crypto.createHash('sha256').update(String(code)).digest('hex');

module.exports = {
    generateSecret,
    getOtpAuthUrl,
    verifyToken,
    hashBackupCode
};
