import { normalizeDateInput } from './trainMapper';

export const QUOTA_OPTIONS = [
  { value: 'General', label: 'General' },
  { value: 'Ladies', label: 'Ladies' },
  { value: 'SeniorCitizen', label: 'Senior Citizen' }
];

export const BOOKING_TYPE_OPTIONS = [
  { value: 'General', label: 'General' },
  { value: 'Tatkal', label: 'Tatkal' }
];

export function isTatkalEligible(journeyDate) {
  const normalized = normalizeDateInput(journeyDate);
  if (!normalized) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const journey = new Date(`${normalized}T00:00:00`);
  const days = Math.round((journey - today) / (1000 * 60 * 60 * 24));
  return days >= 1 && days <= 2;
}

export function isSoldOut(selectedClass, passengerCount) {
  if (!selectedClass) return false;
  const available = Number(selectedClass.availableSeats ?? 0);
  return available < passengerCount;
}
