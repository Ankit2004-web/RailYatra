export const MAX_ADVANCE_BOOKING_DAYS = 60;

export function getMaxBookingDate(from = new Date()) {
  const max = new Date(from);
  max.setDate(max.getDate() + MAX_ADVANCE_BOOKING_DAYS);
  return max.toISOString().split('T')[0];
}

export function getTodayIso(from = new Date()) {
  return from.toISOString().split('T')[0];
}
