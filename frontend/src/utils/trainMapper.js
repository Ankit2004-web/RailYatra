const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const FULL_DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const RUNNING_DAY_NAMES = {
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
  sun: 7, sunday: 7
};

function isoDayFromIndex(i) {
  return i === 6 ? 7 : i + 1;
}

function parseRunningDaysFromString(runningDays) {
  if (!runningDays) return null;
  const text = String(runningDays).trim();
  if (/^daily$/i.test(text)) return [1, 2, 3, 4, 5, 6, 7];
  if (/not in source|unverified|unknown/i.test(text)) return null;

  const tokens = text.split(/[\s,/|]+/).filter(Boolean);
  const days = new Set();
  for (const token of tokens) {
    const key = token.toLowerCase().replace(/\./g, '');
    if (RUNNING_DAY_NAMES[key]) days.add(RUNNING_DAY_NAMES[key]);
  }
  return days.size ? [...days].sort((a, b) => a - b) : null;
}

function normalizeRunningDaysList(list) {
  if (!Array.isArray(list) || !list.length) return null;
  const normalized = [...new Set(list.map(Number).filter((n) => n >= 1 && n <= 7))].sort((a, b) => a - b);
  return normalized.length ? normalized : null;
}

export function runningDayCircles(train) {
  const list =
    normalizeRunningDaysList(train.runningDaysList) ||
    parseRunningDaysFromString(train.runningDays) ||
    [1, 2, 3, 4, 5, 6, 7];

  return DAY_LABELS.map((label, i) => {
    const isoDay = isoDayFromIndex(i);
    const active = list.includes(isoDay);
    return {
      label,
      fullName: FULL_DAY_NAMES[i],
      active,
      isSunday: i === 6
    };
  });
}
const TRAIN_SPEED_RANGES = {
  PASS: { min: 30, max: 40, typical: 35 },
  EXP: { min: 50, max: 60, typical: 55 },
  SF: { min: 50, max: 60, typical: 58 },
  RAJ: { min: 80, max: 95, typical: 88 },
  SHAT: { min: 80, max: 95, typical: 90 },
  DUR: { min: 80, max: 95, typical: 85 },
  TEJAS: { min: 80, max: 95, typical: 92 },
  VB: { min: 130, max: 160, typical: 145 }
};

export function inferTrainSpeedCategory(trainTypeCode, trainName = '') {
  const code = String(trainTypeCode || '').toUpperCase();
  const name = String(trainName || '');

  if (code === 'VB' || /vande bharat/i.test(name)) return 'VB';
  if (/tejas/i.test(name)) return 'TEJAS';
  if (code === 'RAJ' || /rajdhani/i.test(name)) return 'RAJ';
  if (code === 'SHAT' || /shatabdi/i.test(name)) return 'SHAT';
  if (code === 'DUR' || /duronto/i.test(name)) return 'DUR';
  if (code === 'PASS' || /passenger|memu|demu|\blocal\b/i.test(name)) return 'PASS';
  if (code === 'SF' || /superfast|super fast|\bsf\b/i.test(name)) return 'SF';
  return 'EXP';
}

export function computeAvgSpeed(distanceKm, durationMinutes, trainTypeCode, trainName) {
  const category = inferTrainSpeedCategory(trainTypeCode, trainName);
  const range = TRAIN_SPEED_RANGES[category] || TRAIN_SPEED_RANGES.EXP;

  if (!distanceKm || !durationMinutes || durationMinutes <= 0) {
    return range.typical;
  }

  const raw = distanceKm / (durationMinutes / 60);
  return Math.round(Math.min(range.max, Math.max(range.min, raw)));
}

const CLASS_LABELS = {
  '1A': '1A – First AC',
  '2A': '2A – 2 Tier AC',
  '3A': '3A – 3 Tier AC',
  '3E': '3E – AC 3 Economy',
  CC: 'CC – Chair Car',
  EC: 'EC – Executive Chair Car',
  SL: 'SL – Sleeper',
  '2S': '2S – Second Sitting'
};

export function formatJourneyDate(dateStr, dayOffset = 0) {
  const normalized = normalizeDateInput(dateStr);
  if (!normalized) return '';
  const d = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  if (dayOffset) d.setDate(d.getDate() + dayOffset);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function normalizeDateInput(value) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().split('T')[0];
  }
  const str = String(value).trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split('T')[0];
}

export function formatDisplayDate(dateStr) {
  const normalized = normalizeDateInput(dateStr);
  if (!normalized) return '—';
  const d = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatJourneyDay(dateStr) {
  const normalized = normalizeDateInput(dateStr);
  if (!normalized) return '—';
  const d = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export function formatBoardingTime(timeStr) {
  if (!timeStr) return '';
  const normalized = String(timeStr).trim();
  return normalized.length >= 5 ? normalized.slice(0, 5) : normalized;
}

export function parseTimeToMinutes(timeStr, dayOffset = 0) {
  if (!timeStr) return dayOffset * 1440;
  const [h, m] = timeStr.split(':').map(Number);
  return dayOffset * 1440 + (h || 0) * 60 + (m || 0);
}

export function mapTrainApiResponseToViewModel(train, journeyDate) {
  const fromDayOffset = train.from?.dayOffset || 0;
  const toDayOffset = train.to?.dayOffset || 0;
  const date = journeyDate || train.date;

  return {
    raw: train,
    id: train.trainId || train.id,
    trainNumber: train.trainNumber,
    trainName: train.trainName,
    trainTypeCode: train.trainTypeCode || train.trainType || null,
    from: {
      code: train.from?.stationCode || train.fromStationCode || '',
      name: train.from?.stationName || train.fromStationName || train.source || '',
      time: train.from?.departureTime || train.fromDepartureTime || train.departureTime || '',
      dayOffset: fromDayOffset,
      dateLabel: formatJourneyDate(date, fromDayOffset)
    },
    to: {
      code: train.to?.stationCode || train.toStationCode || '',
      name: train.to?.stationName || train.toStationName || train.destination || '',
      time: train.to?.arrivalTime || train.toArrivalTime || train.arrivalTime || '',
      dayOffset: toDayOffset,
      dateLabel: formatJourneyDate(date, toDayOffset)
    },
    duration: train.duration || '',
    durationMinutes: train.durationMinutes || 0,
    distance: train.distance,
    runningDaysList: train.runningDaysList,
    runningDays: train.runningDays,
    classes: (train.classes || []).map((c) => ({
      classCode: c.classCode,
      className: c.className || CLASS_LABELS[c.classCode] || c.classCode,
      price: c.price != null ? Number(c.price) : null,
      availableSeats: c.availableSeats,
      totalSeats: c.totalSeats,
      coachCount: c.coachCount,
      coaches: c.coaches || []
    })),
    avgSpeedKmh: train.avgSpeedKmh ?? computeAvgSpeed(
      train.distance,
      train.durationMinutes,
      train.trainTypeCode || train.trainType,
      train.trainName
    ),
    depMinutes: parseTimeToMinutes(
      train.from?.departureTime || train.departureTime,
      fromDayOffset
    ),
    arrMinutes: parseTimeToMinutes(
      train.to?.arrivalTime || train.arrivalTime,
      toDayOffset
    ),
    lowestPrice: train.lowestPrice ?? (
      train.classes?.length
        ? Math.min(...train.classes.map((c) => Number(c.price)).filter((p) => !Number.isNaN(p)))
        : train.price != null ? Number(train.price) : null
    )
  };
}

export function collectAvailableClasses(trains) {
  const codes = new Set();
  trains.forEach((t) => (t.classes || []).forEach((c) => codes.add(c.classCode)));
  const order = ['1A', '2A', '3A', '3E', 'CC', 'EC', 'SL', '2S'];
  return order
    .filter((code) => codes.has(code))
    .map((code) => ({ code, label: CLASS_LABELS[code] || code }));
}

export function collectTrainTypes(trains) {
  const types = new Map();
  trains.forEach((t) => {
    const code = t.trainTypeCode || t.trainType;
    if (code) types.set(code, code);
  });
  return [...types.values()].sort();
}

export function collectClassPrices(trains) {
  const prices = {};
  trains.forEach((t) => {
    (t.classes || []).forEach((c) => {
      if (prices[c.classCode] == null && c.price != null) {
        prices[c.classCode] = Number(c.price);
      }
    });
  });
  return prices;
}

export { CLASS_LABELS, DAY_LABELS };
