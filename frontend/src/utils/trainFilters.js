import { mapTrainApiResponseToViewModel } from './trainMapper';

export const DEPARTURE_BUCKETS = [
  { id: 'night', label: '00:00 – 06:00', from: 0, to: 359 },
  { id: 'morning', label: '06:00 – 12:00', from: 360, to: 719 },
  { id: 'afternoon', label: '12:00 – 18:00', from: 720, to: 1079 },
  { id: 'evening', label: '18:00 – 24:00', from: 1080, to: 1439 }
];

export const ARRIVAL_BUCKETS = DEPARTURE_BUCKETS;

export const DURATION_BUCKETS = [
  { id: 'upto6', label: 'Up to 6h', test: (m) => m <= 360 },
  { id: '6to12', label: '6h – 12h', test: (m) => m > 360 && m <= 720 },
  { id: '12to18', label: '12h – 18h', test: (m) => m > 720 && m <= 1080 },
  { id: '18plus', label: '18h+', test: (m) => m > 1080 }
];

export const SORT_OPTIONS = [
  { value: 'departure-early', label: 'Departure Time – Earliest' },
  { value: 'departure-late', label: 'Departure Time – Latest' },
  { value: 'arrival-early', label: 'Arrival Time – Earliest' },
  { value: 'duration-short', label: 'Journey Duration – Shortest' },
  { value: 'name-asc', label: 'Train Name' },
  { value: 'number-asc', label: 'Train Number' },
  { value: 'fare-low', label: 'Fare – Low to High' }
];

export function defaultFilters(initialClass = '') {
  return {
    classes: initialClass ? [initialClass] : [],
    departureBuckets: [],
    arrivalBuckets: [],
    durations: [],
    trainTypes: []
  };
}

function minutesInDay(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function matchesBucket(minutesInDayValue, bucket) {
  return minutesInDayValue >= bucket.from && minutesInDayValue <= bucket.to;
}

export function applyTrainFilters(trains, filters, sortBy, journeyDate) {
  let list = trains.map((t) => mapTrainApiResponseToViewModel(t, journeyDate));

  if (filters.classes.length) {
    list = list.filter((t) =>
      t.classes.some((c) => filters.classes.includes(c.classCode))
    );
  }

  if (filters.departureBuckets.length) {
    const buckets = DEPARTURE_BUCKETS.filter((b) => filters.departureBuckets.includes(b.id));
    list = list.filter((t) => {
      const mins = minutesInDay(t.from.time);
      return buckets.some((b) => matchesBucket(mins, b));
    });
  }

  if (filters.arrivalBuckets.length) {
    const buckets = ARRIVAL_BUCKETS.filter((b) => filters.arrivalBuckets.includes(b.id));
    list = list.filter((t) => {
      const mins = minutesInDay(t.to.time);
      return buckets.some((b) => matchesBucket(mins, b));
    });
  }

  if (filters.durations.length) {
    const tests = DURATION_BUCKETS.filter((b) => filters.durations.includes(b.id));
    list = list.filter((t) => tests.some((b) => b.test(t.durationMinutes)));
  }

  if (filters.trainTypes.length) {
    list = list.filter((t) => t.trainTypeCode && filters.trainTypes.includes(t.trainTypeCode));
  }

  list.sort((a, b) => compareTrains(a, b, sortBy));
  return list;
}

function compareTrains(a, b, sortBy) {
  switch (sortBy) {
    case 'departure-late':
      return b.depMinutes - a.depMinutes;
    case 'arrival-early':
      return a.arrMinutes - b.arrMinutes;
    case 'duration-short':
      return a.durationMinutes - b.durationMinutes;
    case 'duration-long':
      return b.durationMinutes - a.durationMinutes;
    case 'name-asc':
      return (a.trainName || '').localeCompare(b.trainName || '');
    case 'number-asc':
      return String(a.trainNumber || '').localeCompare(String(b.trainNumber || ''), undefined, { numeric: true });
    case 'fare-low':
      return (a.lowestPrice ?? Infinity) - (b.lowestPrice ?? Infinity);
    case 'departure-early':
    default:
      return a.depMinutes - b.depMinutes;
  }
}

export function countByDuration(trains) {
  const counts = {};
  DURATION_BUCKETS.forEach((b) => { counts[b.id] = 0; });
  trains.forEach((t) => {
    const mins = t.durationMinutes || 0;
    DURATION_BUCKETS.forEach((b) => {
      if (b.test(mins)) counts[b.id] += 1;
    });
  });
  return counts;
}

export function activeFilterCount(filters) {
  return (
    filters.classes.length +
    filters.departureBuckets.length +
    filters.arrivalBuckets.length +
    filters.durations.length +
    filters.trainTypes.length
  );
}
