export const BERTH_OPTIONS = [
  'No Preference',
  'Lower',
  'Middle',
  'Upper',
  'Side Lower',
  'Side Upper',
  'Window',
  'Aisle'
];

export const GENDER_OPTIONS = ['Male', 'Female', 'Other'];

export function normalizeBerthPreference(value) {
  if (!value || value === 'No Preference') return null;
  return value;
}

export function displayBerthPreference(value) {
  return value || 'No Preference';
}

export function savedPassengerToBooking(passenger) {
  return {
    name: passenger.name,
    age: String(passenger.age),
    gender: passenger.gender,
    berthPreference: displayBerthPreference(passenger.berthPreference)
  };
}

export function bookingPassengerToSaved(passenger) {
  return {
    name: passenger.name.trim(),
    age: Number(passenger.age),
    gender: passenger.gender,
    berthPreference: normalizeBerthPreference(passenger.berthPreference)
  };
}
