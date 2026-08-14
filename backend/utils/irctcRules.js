const { ROLES } = require('../constants/roles');
const {
    getIstParts,
    parseTimeToMinutes,
    addDaysIso,
    daysBetweenIso
} = require('./istTime');

const ARP_DAYS = 60;
const GENERAL_PASSENGER_LIMIT = 6;
const TATKAL_PASSENGER_LIMIT = 4;
const MONTHLY_TICKET_CAP = 12;
const MONTHLY_TICKET_CAP_AADHAAR = 24;
const GENERAL_OPEN_MINUTES = 8 * 60;
const TATKAL_AC_OPEN_MINUTES = 10 * 60;
const TATKAL_NON_AC_OPEN_MINUTES = 11 * 60;
const AADHAAR_PRIORITY_MINUTES = 15;
const AGENT_BLOCK_MINUTES = 30;
const CHART_HOURS_BEFORE = 10;
const MORNING_CHART_CUTOFF_HOUR = 20;
const AC_CLASSES = new Set(['1A', '2A', '3A', '3E', 'CC', 'EC', 'EA', 'FC', 'EV']);
const TATKAL_EXCLUDED_CLASSES = new Set(['1A', 'EC']);
const CONCESSION_QUOTAS = new Set(['SeniorCitizen', 'Divyang', 'DutyPass']);

function isAcClass(classCode) {
    return AC_CLASSES.has(String(classCode || '').toUpperCase());
}

function isPassengerAadhaarVerified(passenger) {
    const type = String(passenger?.idType || '').toLowerCase();
    if (!(type.includes('aadhaar') || type.includes('aadhar'))) return false;
    const number = String(passenger?.idNumber || '').replace(/\D/g, '');
    if (number.length === 12) return true;
    return Boolean(passenger?.idToken || passenger?.idFingerprint);
}

function isUserAadhaarVerified(user) {
    return Boolean(user?.aadhaarVerified || user?.aadhaar_verified);
}

function isBookingAgent(user) {
    const role = String(user?.role || '').toLowerCase();
    return role === ROLES.BOOKING_AGENT || role === 'agent' || role === 'travel_agent';
}

function tatkalOpenMinutes(classCode) {
    return isAcClass(classCode) ? TATKAL_AC_OPEN_MINUTES : TATKAL_NON_AC_OPEN_MINUTES;
}

function getChartCloseInstant({ journeyDate, departureTime }) {
    const depMinutes = parseTimeToMinutes(departureTime);
    const depHour = Math.floor(depMinutes / 60);
    if (depHour < 12) {
        return {
            date: addDaysIso(journeyDate, -1),
            minutes: MORNING_CHART_CUTOFF_HOUR * 60,
            reason: 'Chart closes at 8:00 PM IST the evening before morning trains'
        };
    }
    const closeMinutes = depMinutes - CHART_HOURS_BEFORE * 60;
    if (closeMinutes >= 0) {
        return {
            date: journeyDate,
            minutes: closeMinutes,
            reason: `Chart closes ${CHART_HOURS_BEFORE} hours before departure`
        };
    }
    return {
        date: addDaysIso(journeyDate, -1),
        minutes: closeMinutes + 24 * 60,
        reason: `Chart closes ${CHART_HOURS_BEFORE} hours before departure`
    };
}

function isChartClosed({ journeyDate, departureTime, now = new Date() }) {
    if (!journeyDate) return false;
    const ist = getIstParts(now);
    const close = getChartCloseInstant({ journeyDate, departureTime });
    if (ist.dateStr > close.date) return { closed: true, ...close };
    if (ist.dateStr === close.date && ist.minutes >= close.minutes) return { closed: true, ...close };
    return { closed: false, ...close };
}

function getTatkalWindow({ journeyDate, classCode, now = new Date() }) {
    const ist = getIstParts(now);
    const openDate = addDaysIso(journeyDate, -1);
    const openMinutes = tatkalOpenMinutes(classCode);
    const daysUntil = daysBetweenIso(ist.dateStr, journeyDate);
    const opened = ist.dateStr > openDate
        || (ist.dateStr === openDate && ist.minutes >= openMinutes);
    const minutesSinceOpen = ist.dateStr === openDate
        ? ist.minutes - openMinutes
        : ist.dateStr > openDate
            ? 24 * 60
            : -1;

    return {
        openDate,
        openMinutes,
        openLabel: isAcClass(classCode) ? '10:00 AM IST (AC)' : '11:00 AM IST (Non-AC)',
        opened,
        daysUntil,
        minutesSinceOpen,
        aadhaarPriority: opened && minutesSinceOpen >= 0 && minutesSinceOpen < AADHAAR_PRIORITY_MINUTES,
        agentBlocked: opened && minutesSinceOpen >= 0 && minutesSinceOpen < AGENT_BLOCK_MINUTES
    };
}

function isTatkalBookingOpen({ journeyDate, classCode, departureTime, now = new Date() }) {
    const chart = isChartClosed({ journeyDate, departureTime, now });
    if (chart.closed) {
        return { ok: false, error: `${chart.reason}. Tatkal booking is closed.`, status: 400 };
    }
    const window = getTatkalWindow({ journeyDate, classCode, now });
    if (!window.opened) {
        return {
            ok: false,
            error: `Tatkal opens at ${window.openLabel} one day before departure (${window.openDate}).`,
            status: 400,
            window
        };
    }
    return { ok: true, window, chart };
}

function evaluateBookingRules({
    journeyDate,
    bookingType = 'General',
    quota = 'General',
    classCode,
    passengers = [],
    user,
    departureTime,
    monthlyTicketCount = 0,
    aadhaarOtpOk = false,
    now = new Date()
}) {
    const ist = getIstParts(now);
    const daysUntil = daysBetweenIso(ist.dateStr, journeyDate);
    const type = bookingType === 'Tatkal' || quota === 'Tatkal' || quota === 'PremiumTatkal'
        ? 'Tatkal'
        : 'General';
    const aadhaarUser = isUserAadhaarVerified(user);
    const passengerAadhaar = passengers.some(isPassengerAadhaarVerified);
    const passengerLimit = type === 'Tatkal' ? TATKAL_PASSENGER_LIMIT : GENERAL_PASSENGER_LIMIT;

    if (daysUntil < 0) {
        return { error: 'Journey date cannot be in the past.', status: 400 };
    }
    if (daysUntil > ARP_DAYS) {
        return { error: `Advance Reservation Period is ${ARP_DAYS} days. Choose an earlier journey date.`, status: 400 };
    }

    const chart = isChartClosed({ journeyDate, departureTime, now });
    if (chart.closed) {
        return { error: `${chart.reason}. Fresh bookings are closed for this train.`, status: 400 };
    }

    if (passengers.length < 1) {
        return { error: 'At least one passenger is required.', status: 400 };
    }
    if (passengers.length > passengerLimit) {
        return {
            error: type === 'Tatkal'
                ? `Tatkal allows a maximum of ${TATKAL_PASSENGER_LIMIT} passengers per PNR.`
                : `A single PNR can have a maximum of ${GENERAL_PASSENGER_LIMIT} passengers.`,
            status: 400
        };
    }

    const monthlyCap = aadhaarUser && passengerAadhaar
        ? MONTHLY_TICKET_CAP_AADHAAR
        : MONTHLY_TICKET_CAP;
    if (monthlyTicketCount >= monthlyCap) {
        return {
            error: aadhaarUser
                ? `Monthly booking cap reached (${monthlyCap} tickets). Aadhaar-verified passengers can book up to ${MONTHLY_TICKET_CAP_AADHAAR}.`
                : `Monthly booking cap reached (${MONTHLY_TICKET_CAP} tickets). Verify Aadhaar to raise the cap to ${MONTHLY_TICKET_CAP_AADHAAR}.`,
            status: 429
        };
    }

    if (daysUntil === ARP_DAYS) {
        if (ist.minutes < GENERAL_OPEN_MINUTES) {
            return { error: 'Opening-day reservations start at 8:00 AM IST.', status: 400 };
        }
        if (!aadhaarUser) {
            return {
                error: 'On the first day of the 60-day ARP window, only Aadhaar-authenticated users can book. Verify Aadhaar on Profile, or book from Day 2.',
                status: 403
            };
        }
    }

    if (type === 'Tatkal') {
        if (TATKAL_EXCLUDED_CLASSES.has(String(classCode || '').toUpperCase())) {
            return { error: 'Tatkal is not available for First AC (1A) or Executive Class (EC).', status: 400 };
        }
        if (CONCESSION_QUOTAS.has(quota)) {
            return { error: 'No concessions (senior citizen, student, or Divyang) apply on Tatkal.', status: 400 };
        }

        const tatkal = isTatkalBookingOpen({ journeyDate, classCode, departureTime, now });
        if (!tatkal.ok) return tatkal;

        if (!aadhaarUser) {
            return {
                error: 'Tatkal booking requires an Aadhaar-authenticated account. Verify Aadhaar on Profile first.',
                status: 403
            };
        }
        if (!aadhaarOtpOk) {
            return {
                error: 'Complete the Aadhaar OTP check to book Tatkal.',
                status: 403
            };
        }
        if (tatkal.window.aadhaarPriority && !aadhaarUser) {
            return {
                error: 'The first 15 minutes of the Tatkal window are reserved for Aadhaar-linked users.',
                status: 403
            };
        }
        if (tatkal.window.agentBlocked && isBookingAgent(user)) {
            return {
                error: 'Travel agents cannot book Tatkal during the first 30 minutes of the window.',
                status: 403
            };
        }
    }

    return {
        ok: true,
        type,
        daysUntil,
        monthlyCap,
        passengerLimit,
        aadhaarUser,
        chart
    };
}

function describeBookingWindows({
    journeyDate,
    classCode,
    departureTime,
    bookingType = 'General',
    user,
    monthlyTicketCount = 0,
    now = new Date()
} = {}) {
    const ist = getIstParts(now);
    const aadhaarUser = isUserAadhaarVerified(user);
    const daysUntil = journeyDate ? daysBetweenIso(ist.dateStr, String(journeyDate).slice(0, 10)) : null;
    const type = bookingType === 'Tatkal' ? 'Tatkal' : 'General';
    const passengerLimit = type === 'Tatkal' ? TATKAL_PASSENGER_LIMIT : GENERAL_PASSENGER_LIMIT;
    const monthlyCap = aadhaarUser ? MONTHLY_TICKET_CAP_AADHAAR : MONTHLY_TICKET_CAP;
    const chart = journeyDate
        ? isChartClosed({ journeyDate: String(journeyDate).slice(0, 10), departureTime, now })
        : { closed: false };
    const tatkalWindow = journeyDate
        ? getTatkalWindow({ journeyDate: String(journeyDate).slice(0, 10), classCode, now })
        : null;
    const excludedClass = TATKAL_EXCLUDED_CLASSES.has(String(classCode || '').toUpperCase());

    return {
        arpDays: ARP_DAYS,
        istDate: ist.dateStr,
        daysUntil,
        passengerLimit,
        monthlyCap,
        monthlyCapStandard: MONTHLY_TICKET_CAP,
        monthlyCapAadhaar: MONTHLY_TICKET_CAP_AADHAAR,
        monthlyUsed: monthlyTicketCount,
        monthlyRemaining: Math.max(0, monthlyCap - monthlyTicketCount),
        aadhaarVerified: aadhaarUser,
        openingDay: daysUntil === ARP_DAYS,
        generalOpenAt: '08:00 AM IST',
        chart,
        tatkal: tatkalWindow
            ? {
                ...tatkalWindow,
                eligible: Boolean(tatkalWindow.opened && !chart.closed && !excludedClass),
                excludedClass,
                excludedReason: excludedClass ? 'Tatkal is not available for First AC (1A) or Executive Class (EC).' : null,
                otpRequired: true,
                maxPassengers: TATKAL_PASSENGER_LIMIT,
                acOpenAt: '10:00 AM IST',
                nonAcOpenAt: '11:00 AM IST'
            }
            : null
    };
}

module.exports = {
    ARP_DAYS,
    GENERAL_PASSENGER_LIMIT,
    TATKAL_PASSENGER_LIMIT,
    MONTHLY_TICKET_CAP,
    MONTHLY_TICKET_CAP_AADHAAR,
    TATKAL_EXCLUDED_CLASSES,
    CONCESSION_QUOTAS,
    CHART_HOURS_BEFORE,
    isAcClass,
    isPassengerAadhaarVerified,
    isUserAadhaarVerified,
    isChartClosed,
    getTatkalWindow,
    isTatkalBookingOpen,
    evaluateBookingRules,
    describeBookingWindows,
    tatkalOpenMinutes
};
