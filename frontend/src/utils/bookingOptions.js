import { normalizeDateInput } from './trainMapper';
import { isTatkalWindowOpen, isTatkalExcludedClass, CONCESSION_QUOTAS } from './irctcRules';

export const QUOTA_OPTIONS = [
  { value: 'General', label: 'General' },
  { value: 'Ladies', label: 'Ladies' },
  { value: 'SeniorCitizen', label: 'Senior Citizen' },
  { value: 'Tatkal', label: 'Tatkal' },
  { value: 'PremiumTatkal', label: 'Premium Tatkal' },
  { value: 'Defence', label: 'Defence' },
  { value: 'ForeignTourist', label: 'Foreign Tourist' },
  { value: 'Parliament', label: 'Parliament House' },
  { value: 'LowerBerth', label: 'Lower Berth' },
  { value: 'Divyang', label: 'Divyang' },
  { value: 'DutyPass', label: 'Duty Pass' }
];

export const CLASS_OPTIONS = [
  { value: '1A', label: '1A - AC First' },
  { value: '2A', label: '2A - AC 2 Tier' },
  { value: '3A', label: '3A - AC 3 Tier' },
  { value: '3E', label: '3E - AC 3 Economy' },
  { value: 'SL', label: 'SL - Sleeper' },
  { value: 'CC', label: 'CC - Chair Car' },
  { value: 'EC', label: 'EC - Executive Chair' },
  { value: '2S', label: '2S - Second Sitting' },
  { value: 'UR', label: 'UR - Unreserved' }
];

export const BOOKING_TYPE_OPTIONS = [
  { value: 'General', label: 'General' },
  { value: 'Tatkal', label: 'Tatkal' }
];

export function isTatkalEligible(journeyDate, classCode) {
  const normalized = normalizeDateInput(journeyDate);
  if (!normalized) return false;
  if (isTatkalExcludedClass(classCode)) return false;
  return isTatkalWindowOpen(normalized, classCode);
}

export function quotaOptionsFor(bookingType) {
  if (bookingType !== 'Tatkal') return QUOTA_OPTIONS;
  return QUOTA_OPTIONS.filter((option) => !CONCESSION_QUOTAS.has(option.value));
}

export function isSoldOut(selectedClass, passengerCount) {
  if (!selectedClass) return false;
  const available = Number(selectedClass.availableSeats ?? 0);
  return available < passengerCount;
}
