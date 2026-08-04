const logger = require('../utils/logger');

async function sendSms(phone, message) {
    const apiKey = process.env.SMS_API_KEY;
    const provider = process.env.SMS_PROVIDER || 'dev';

    if (provider === 'twilio' && process.env.TWILIO_ACCOUNT_SID) {
        try {
            const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
            const body = new URLSearchParams({
                To: phone.startsWith('+') ? phone : `+91${phone}`,
                From: process.env.TWILIO_FROM_NUMBER,
                Body: message
            });
            const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
                method: 'POST',
                headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
                body
            });
            if (!res.ok) throw new Error(`Twilio error ${res.status}`);
            return { sent: true, provider: 'twilio' };
        } catch (err) {
            logger.warn('SMS send failed, falling back to dev', { error: err.message });
        }
    }

    logger.info(`[SMS dev] ${phone}: ${message}`);
    return { sent: true, provider: 'dev', devMessage: message };
}

module.exports = { sendSms };
