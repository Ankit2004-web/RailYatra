/**
 * Running day calculation for multi-day trains.
 * DayOfWeek: 1=Monday … 7=Sunday (ISO).
 */

const DAY_NAMES = {
    mon: 1, monday: 1,
    tue: 2, tues: 2, tuesday: 2,
    wed: 3, wednesday: 3,
    thu: 4, thur: 4, thurs: 4, thursday: 4,
    fri: 5, friday: 5,
    sat: 6, saturday: 6,
    sun: 7, sunday: 7
};

function isoDayOfWeek(date) {
    const d = date instanceof Date ? date : parseDateOnly(date);
    const js = d.getDay();
    return js === 0 ? 7 : js;
}

function parseDateOnly(value) {
    if (!value) return new Date();
    const [y, m, d] = String(value).split('T')[0].split('-').map(Number);
    return new Date(y, m - 1, d);
}

function formatDateOnly(date) {
    const d = date instanceof Date ? date : parseDateOnly(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function addDays(date, days) {
    const d = parseDateOnly(date);
    d.setDate(d.getDate() + days);
    return d;
}

function parseRunningDaysString(runningDays) {
    if (!runningDays) return [];
    const text = String(runningDays).trim();
    if (/not in source|unverified|unknown/i.test(text)) return [];
    if (/^daily$/i.test(text)) {
        return [1, 2, 3, 4, 5, 6, 7];
    }
    const tokens = String(runningDays).split(/[\s,/|]+/).filter(Boolean);
    const days = new Set();
    for (const token of tokens) {
        const key = token.toLowerCase().replace(/\./g, '');
        if (DAY_NAMES[key]) days.add(DAY_NAMES[key]);
    }
    return days.size ? [...days].sort((a, b) => a - b) : [];
}

const ALL_RUNNING_DAYS = [1, 2, 3, 4, 5, 6, 7];

/** Resolve operating days from DB map or text. Unknown schedules are not treated as daily. */
function resolveRunningDayList(runningDaysString, fromMap) {
    if (fromMap?.length) {
        return [...new Set(fromMap.map(Number).filter((n) => n >= 1 && n <= 7))].sort((a, b) => a - b);
    }
    const text = String(runningDaysString || '').trim();
    if (/^daily$/i.test(text)) return ALL_RUNNING_DAYS;
    const parsed = parseRunningDaysString(runningDaysString);
    if (parsed.length) return parsed;
    return [];
}

/** Search/booking: treat missing or unverified schedules as daily so trains stay bookable. */
function effectiveRunningDays(runningDaysString, fromMap) {
    const list = resolveRunningDayList(runningDaysString, fromMap);
    if (list.length) return list;
    return ALL_RUNNING_DAYS;
}

function runningDaysFromRows(rows) {
    if (!rows?.length) return [];
    return rows.filter((r) => r.runs !== false && r.runs !== 0).map((r) => r.dayOfWeek).sort((a, b) => a - b);
}

function calculateSourceDepartureDate(boardingDate, departureDayOffset = 0) {
    return formatDateOnly(addDays(boardingDate, -(departureDayOffset || 0)));
}

function trainRunsOnBoardingDate(boardingDate, fromStopDepartureDayOffset, runningDayList) {
    if (!runningDayList?.length) return false;
    const sourceDate = calculateSourceDepartureDate(boardingDate, fromStopDepartureDayOffset);
    const dow = isoDayOfWeek(sourceDate);
    return runningDayList.includes(dow);
}

function runningDaysLabel(days) {
    if (!days || !days.length) return 'Not in source dataset';
    if (days.length === 7) return 'Daily';
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((d) => labels[d - 1]).join(' ');
}

function parseTimeToMinutes(timeStr) {
    if (!timeStr || timeStr === '--:--') return null;
    const [h, m] = timeStr.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
}

function calculateDurationMinutes(fromStop, toStop) {
    const depMin = parseTimeToMinutes(fromStop.departureTime || fromStop.departure);
    const arrMin = parseTimeToMinutes(toStop.arrivalTime || toStop.arrival);
    if (depMin == null || arrMin == null) return null;
    const dayDiff = (toStop.arrivalDayOffset || 0) - (fromStop.departureDayOffset || 0);
    return dayDiff * 1440 + (arrMin - depMin);
}

function formatDuration(minutes) {
    if (minutes == null || minutes < 0) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
}

const IST_TIME_ZONE = 'Asia/Kolkata';

/** Current calendar date and time-of-day in IST (Indian Railways local time). */
function getIstClock(now = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: IST_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    const parts = Object.fromEntries(
        formatter.formatToParts(now)
            .filter((part) => part.type !== 'literal')
            .map((part) => [part.type, part.value])
    );
    return {
        date: `${parts.year}-${parts.month}-${parts.day}`,
        minutes: parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10)
    };
}

/**
 * For today's journey date only: keep trains whose boarding departure is still in the future.
 * Future dates always return true.
 */
function isBoardingDepartureUpcoming(journeyDate, departureTime, departureDayOffset = 0, istClock = getIstClock()) {
    const journey = formatDateOnly(journeyDate);
    if (journey !== istClock.date) return true;
    if ((departureDayOffset || 0) > 0) return true;

    const depMinutes = parseTimeToMinutes(departureTime);
    if (depMinutes == null) return true;

    return depMinutes > istClock.minutes;
}

module.exports = {
    isoDayOfWeek,
    parseDateOnly,
    formatDateOnly,
    addDays,
    parseRunningDaysString,
    resolveRunningDayList,
    effectiveRunningDays,
    ALL_RUNNING_DAYS,
    runningDaysFromRows,
    calculateSourceDepartureDate,
    trainRunsOnBoardingDate,
    runningDaysLabel,
    parseTimeToMinutes,
    calculateDurationMinutes,
    formatDuration,
    getIstClock,
    isBoardingDepartureUpcoming
};
