const AWAITING_PAYMENT_STATUSES = ['Pending', 'Waitlisted', 'RAC'];

export function isAwaitingPayment(booking) {
  return Boolean(
    booking
    && booking.paymentStatus === 'Pending'
    && AWAITING_PAYMENT_STATUSES.includes(booking.status)
  );
}

export function bookingFareAmount(booking) {
  const breakdownTotal = booking?.paymentBreakdown?.totalFare;
  if (breakdownTotal != null && Number(breakdownTotal) > 0) {
    return Number(breakdownTotal);
  }
  if (booking?.grandTotal != null && Number(booking.grandTotal) > 0) {
    return Number(booking.grandTotal);
  }
  return Number(booking?.totalPrice || 0);
}
