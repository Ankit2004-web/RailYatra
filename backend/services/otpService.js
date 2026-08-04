const crypto = require('crypto');
const { sendSms } = require('./smsService');

const store = new Map();
const TTL_MS = 5 * 60 * 1000;

const normalizePhone = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);

const createOtp = async (phone) => {
    const normalized = normalizePhone(phone);
    if (normalized.length !== 10) {
        return { error: 'Valid 10-digit mobile number is required' };
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpId = crypto.randomBytes(12).toString('hex');
    store.set(otpId, {
        phone: normalized,
        otp,
        expiresAt: Date.now() + TTL_MS
    });

    await sendSms(normalized, `Your RailYatra OTP is ${otp}. Valid for 5 minutes.`);

    if (process.env.NODE_ENV !== 'production') {
        console.log(`[OTP dev] ${normalized}: ${otp} (id: ${otpId})`);
    }

    return {
        otpId,
        phone: normalized,
        devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
        expiresInSec: TTL_MS / 1000,
        msg: 'OTP sent to your mobile number'
    };
};

const verifyOtp = (otpId, otp, phone) => {
    const entry = store.get(otpId);
    if (!entry || entry.expiresAt <= Date.now()) {
        store.delete(otpId);
        return false;
    }
    const normalized = normalizePhone(phone);
    const valid = entry.phone === normalized && String(otp).trim() === entry.otp;
    if (valid) store.delete(otpId);
    return valid;
};

module.exports = {
    createOtp,
    verifyOtp,
    normalizePhone
};
