function pad(value) {
    return String(value).padStart(2, '0');
}

function getIstParts(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        weekday: 'short'
    }).formatToParts(now);

    const read = (type) => parts.find((part) => part.type === type)?.value;
    const year = Number(read('year'));
    const month = Number(read('month'));
    const day = Number(read('day'));
    const hour = Number(read('hour'));
    const minute = Number(read('minute'));
    const second = Number(read('second'));

    return {
        year,
        month,
        day,
        hour,
        minute,
        second,
        dateStr: `${year}-${pad(month)}-${pad(day)}`,
        minutes: hour * 60 + minute
    };
}

function parseTimeToMinutes(value) {
    const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
    if (!match) return 0;
    return (Number(match[1]) % 24) * 60 + Number(match[2]);
}

function addDaysIso(dateStr, days) {
    const [year, month, day] = String(dateStr).split('-').map(Number);
    const utc = Date.UTC(year, month - 1, day + days);
    const dt = new Date(utc);
    return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

function daysBetweenIso(fromDate, toDate) {
    const a = new Date(`${fromDate}T00:00:00Z`);
    const b = new Date(`${toDate}T00:00:00Z`);
    return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function monthRangeIso(now = new Date()) {
    const ist = getIstParts(now);
    const start = `${ist.year}-${pad(ist.month)}-01`;
    const next = ist.month === 12
        ? `${ist.year + 1}-01-01`
        : `${ist.year}-${pad(ist.month + 1)}-01`;
    return { start, next, year: ist.year, month: ist.month };
}

module.exports = {
    getIstParts,
    parseTimeToMinutes,
    addDaysIso,
    daysBetweenIso,
    monthRangeIso
};
