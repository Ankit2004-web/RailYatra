const runningDayService = require('../services/runningDayService');

const MAX_ADVANCE_BOOKING_DAYS = 60;
const ACTIVE_BOOKING_STATUSES = ['Confirmed', 'Pending', 'Waitlisted', 'RAC'];

function normalizePassengerName(name) {
    return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizePassengerPhone(phone) {
    return String(phone || '').replace(/\D/g, '').slice(-10);
}

function validateAdvanceBookingDate(journeyDate, now = new Date()) {
    const journey = runningDayService.formatDateOnly(journeyDate);
    const today = runningDayService.formatDateOnly(now);
    if (journey < today) {
        return { error: 'Journey date cannot be in the past.', status: 400 };
    }

    const maxDate = runningDayService.formatDateOnly(
        runningDayService.addDays(today, MAX_ADVANCE_BOOKING_DAYS)
    );
    if (journey > maxDate) {
        return {
            error: `Tickets can only be booked up to ${MAX_ADVANCE_BOOKING_DAYS} days before the journey date.`,
            status: 400
        };
    }

    return { ok: true, journeyDate: journey, maxDate };
}

function getMaxAdvanceBookingDate(now = new Date()) {
    return runningDayService.formatDateOnly(
        runningDayService.addDays(runningDayService.formatDateOnly(now), MAX_ADVANCE_BOOKING_DAYS)
    );
}

module.exports = {
    MAX_ADVANCE_BOOKING_DAYS,
    ACTIVE_BOOKING_STATUSES,
    normalizePassengerName,
    normalizePassengerPhone,
    validateAdvanceBookingDate,
    getMaxAdvanceBookingDate
};
