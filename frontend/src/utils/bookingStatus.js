const AWAITING_PAYMENT_STATUSES = ['Pending', 'Waitlisted', 'RAC'];

export function isAwaitingPayment(booking) {
  return Boolean(
    booking
    && booking.paymentStatus === 'Pending'
    && AWAITING_PAYMENT_STATUSES.includes(booking.status)
  );
}

export function bookingFareAmount(booking) {
  return Number(booking?.grandTotal || booking?.totalPrice || 0);
}
