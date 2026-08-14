export const ARP_DAYS = 60;
export const GENERAL_PASSENGER_LIMIT = 6;
export const TATKAL_PASSENGER_LIMIT = 4;
export const TATKAL_EXCLUDED_CLASSES = new Set(['1A', 'EC']);
export const CONCESSION_QUOTAS = new Set(['SeniorCitizen', 'Divyang', 'DutyPass']);
export const AC_CLASSES = new Set(['1A', '2A', '3A', '3E', 'CC', 'EC', 'EA', 'FC', 'EV']);

function pad(value) {
  return String(value).padStart(2, '0');
}

export function getIstParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(now);
  const read = (type) => parts.find((part) => part.type === type)?.value;
  const year = Number(read('year'));
  const month = Number(read('month'));
  const day = Number(read('day'));
  const hour = Number(read('hour'));
  const minute = Number(read('minute'));
  return {
    year,
    month,
    day,
    hour,
    minute,
    dateStr: `${year}-${pad(month)}-${pad(day)}`,
    minutes: hour * 60 + minute
  };
}

export function addDaysIso(dateStr, days) {
  const [year, month, day] = String(dateStr).split('-').map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function daysBetweenIso(fromDate, toDate) {
  const a = new Date(`${fromDate}T00:00:00Z`);
  const b = new Date(`${toDate}T00:00:00Z`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function isAcClass(classCode) {
  return AC_CLASSES.has(String(classCode || '').toUpperCase());
}

export function isTatkalExcludedClass(classCode) {
  return TATKAL_EXCLUDED_CLASSES.has(String(classCode || '').toUpperCase());
}

export function passengerLimitFor(bookingType) {
  return bookingType === 'Tatkal' ? TATKAL_PASSENGER_LIMIT : GENERAL_PASSENGER_LIMIT;
}

export function tatkalOpenLabel(classCode) {
  return isAcClass(classCode) ? '10:00 AM IST (AC)' : '11:00 AM IST (Non-AC)';
}

export function isTatkalWindowOpen(journeyDate, classCode = 'SL', now = new Date()) {
  if (!journeyDate) return false;
  if (isTatkalExcludedClass(classCode)) return false;
  const ist = getIstParts(now);
  const openDate = addDaysIso(String(journeyDate).slice(0, 10), -1);
  const openMinutes = isAcClass(classCode) ? 10 * 60 : 11 * 60;
  return ist.dateStr > openDate || (ist.dateStr === openDate && ist.minutes >= openMinutes);
}

export function isOpeningDay(journeyDate, now = new Date()) {
  if (!journeyDate) return false;
  const ist = getIstParts(now);
  return daysBetweenIso(ist.dateStr, String(journeyDate).slice(0, 10)) === ARP_DAYS;
}
