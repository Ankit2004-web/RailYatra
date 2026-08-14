import { api, pollBookingStatus } from '../api/client';
import { openRazorpayCheckout } from './razorpay';

function resolveBooking(booking) {
  if (!booking) return null;
  if (booking.id || booking._id) return booking;
  if (booking.booking?.id || booking.booking?._id) return booking.booking;
  return null;
}

function indianMobile(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(-10);
  return /^[6-9]\d{9}$/.test(digits) ? digits : '';
}

function checkoutContact(user, booking, extraPassengers = []) {
  const fromPassengers = [
    ...(extraPassengers || []),
    ...(booking?.passengers || [])
  ]
    .map((p) => indianMobile(p?.mobile || p?.phone))
    .find(Boolean);
  if (fromPassengers) return fromPassengers;
  if (user?.placeholderPhone) return '';
  return indianMobile(user?.phone);
}

export async function completeBookingPayment(booking, user, trainMeta = {}, { idempotencyKey, paymentMethod, passengers } = {}) {
  const paidBooking = resolveBooking(booking);
  if (!paidBooking?.id && !paidBooking?._id) {
    throw new Error('Booking was created but payment could not start. Open My Bookings to complete payment.');
  }
  const bookingId = paidBooking.id || paidBooking._id;
  const payHeaders = idempotencyKey ? { idempotencyKey } : {};
  const order = await api.post('/payments/create-order', { bookingId }, payHeaders);

  if (order.devMode) {
    const confirmed = await api.post('/payments/dev-confirm', { bookingId }, payHeaders);
    return confirmed.booking;
  }

  const payment = await openRazorpayCheckout({
    key: order.key,
    orderId: order.orderId,
    amount: order.amount,
    currency: order.currency,
    description: trainMeta.description || `Booking PNR ${paidBooking.pnrNumber || bookingId}`,
    prefill: {
      name: user?.name || '',
      email: user?.email || '',
      contact: checkoutContact(user, paidBooking, passengers),
      method: paymentMethod || undefined
    },
    notes: {
      bookingId: String(bookingId),
      train: trainMeta.trainNumber || ''
    }
  });

  const verifyKey = idempotencyKey ? `${idempotencyKey}-verify` : undefined;
  const verified = await api.post('/payments/verify', {
    bookingId,
    razorpay_order_id: payment.razorpay_order_id,
    razorpay_payment_id: payment.razorpay_payment_id,
    razorpay_signature: payment.razorpay_signature
  }, verifyKey ? { idempotencyKey: verifyKey } : {});

  if (verified.booking) return verified.booking;

  const polled = await pollBookingStatus(bookingId);
  if (polled?.status === 'Confirmed') {
    return api.get(`/bookings/${bookingId}`);
  }

  return verified.booking;
}
