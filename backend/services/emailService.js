const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const { isWeb3FormsConfigured, submitToWeb3Forms } = require('./web3formsService');

const isSmtpConfigured = () => Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
);

const isEmailConfigured = () => isSmtpConfigured() || isWeb3FormsConfigured();

const getTransporter = () => nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const sendViaSmtp = async ({ to, subject, html }) => {
    const transporter = getTransporter();
    await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        html
    });
};

const deliverEmail = async ({ to, subject, html }) => {
    if (!isSmtpConfigured()) {
        return { sent: false, devMode: true };
    }

    await sendViaSmtp({ to, subject, html });
    return { sent: true, provider: 'smtp' };
};

const sendPasswordResetEmail = async ({ to, resetUrl }) => {
    if (!isSmtpConfigured()) {
        return { sent: false, devMode: true };
    }

    const subject = 'RailYatra - Password Reset';
    const html = `
        <p>You requested a password reset for your RailYatra account.</p>
        <p><a href="${resetUrl}">Reset your password</a></p>
        <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>
    `;
    const text = `You requested a password reset.\n\nReset your password: ${resetUrl}\n\nThis link expires in 1 hour.`;

    const result = await deliverEmail({ to, subject, html });
    logger.info('Password reset email sent', { to, provider: result.provider });
    return { sent: true, devMode: false, ...result };
};

const sendBookingConfirmationEmail = async ({ to, booking, ticketUrl }) => {
    const train = booking.train || {};
    const subject = `Booking Confirmed — PNR ${booking.pnrNumber}`;
    const html = `
        <h2>Your train booking is confirmed</h2>
        <p><strong>PNR:</strong> ${booking.pnrNumber}</p>
        <p><strong>Train:</strong> ${train.trainName} (${train.trainNumber})</p>
        <p><strong>Route:</strong> ${train.source} → ${train.destination}</p>
        <p><strong>Journey Date:</strong> ${new Date(booking.journeyDate).toLocaleDateString('en-IN')}</p>
        <p><strong>Class:</strong> ${booking.classCode || '-'}</p>
        <p><strong>Total Fare:</strong> ₹${booking.totalPrice}</p>
        <p>Download your e-ticket from My Bookings after logging in.</p>
        ${ticketUrl ? `<p><a href="${ticketUrl}">View ticket</a></p>` : ''}
    `;
    const text = [
        'Your train booking is confirmed.',
        `PNR: ${booking.pnrNumber}`,
        `Train: ${train.trainName} (${train.trainNumber})`,
        `Route: ${train.source} → ${train.destination}`,
        `Journey Date: ${new Date(booking.journeyDate).toLocaleDateString('en-IN')}`,
        `Class: ${booking.classCode || '-'}`,
        `Total Fare: ₹${booking.totalPrice}`
    ].join('\n');

    if (!isSmtpConfigured()) {
        logger.info('Booking confirmation (dev mode)', { to, pnr: booking.pnrNumber });
        return { sent: false, devMode: true };
    }

    const result = await deliverEmail({ to, subject, html });
    logger.info('Booking confirmation email sent', { to, pnr: booking.pnrNumber, provider: result.provider });
    return { sent: true, devMode: false, ...result };
};

const sendContactEmail = async ({ name, email, subject, message }) => {
    const resolvedSubject = subject?.trim() || 'RailYatra support enquiry';

    if (isWeb3FormsConfigured()) {
        await submitToWeb3Forms({
            name,
            email,
            replyto: email,
            subject: resolvedSubject,
            message
        });
        logger.info('Contact enquiry sent via Web3Forms', { from: email });
        return { sent: true, devMode: false, provider: 'web3forms' };
    }

    if (!isSmtpConfigured()) {
        return { sent: false, devMode: true };
    }

    const inbox = process.env.SMTP_FROM || process.env.SMTP_USER;
    const html = `
        <p><strong>From:</strong> ${name} &lt;${email}&gt;</p>
        <p><strong>Subject:</strong> ${resolvedSubject}</p>
        <hr />
        <p>${String(message || '').replace(/\n/g, '<br />')}</p>
    `;

    await sendViaSmtp({
        to: inbox,
        subject: `[Contact] ${resolvedSubject}`,
        html
    });

    logger.info('Contact enquiry sent via SMTP', { from: email });
    return { sent: true, devMode: false, provider: 'smtp' };
};

module.exports = {
    isEmailConfigured,
    isSmtpConfigured,
    isWeb3FormsConfigured,
    deliverEmail,
    sendPasswordResetEmail,
    sendBookingConfirmationEmail,
    sendContactEmail
};
