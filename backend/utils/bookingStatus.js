const AWAITING_PAYMENT_STATUSES = ['Pending', 'Waitlisted', 'RAC'];

const isAwaitingPayment = (booking) => Boolean(
    booking
    && booking.paymentStatus === 'Pending'
    && AWAITING_PAYMENT_STATUSES.includes(booking.status)
);

const isSeatHeldBooking = (booking) => booking?.status === 'Pending' && booking?.paymentStatus === 'Pending';

module.exports = {
    AWAITING_PAYMENT_STATUSES,
    isAwaitingPayment,
    isSeatHeldBooking
};
