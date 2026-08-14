import { api, pollBookingStatus } from '../api/client';
import { openRazorpayCheckout } from './razorpay';

export async function completeBookingPayment(booking, user, trainMeta = {}, { idempotencyKey, paymentMethod } = {}) {
  const payHeaders = idempotencyKey ? { idempotencyKey } : {};
  const order = await api.post('/payments/create-order', { bookingId: booking.id }, payHeaders);

  if (order.devMode) {
    const confirmed = await api.post('/payments/dev-confirm', { bookingId: booking.id }, payHeaders);
    return confirmed.booking;
  }

  const payment = await openRazorpayCheckout({
    key: order.key,
    orderId: order.orderId,
    amount: order.amount,
    currency: order.currency,
    description: trainMeta.description || `Booking PNR ${booking.pnrNumber || booking.id}`,
    prefill: {
      name: user?.name || '',
      email: user?.email || '',
      contact: user?.phone || '',
      method: paymentMethod || undefined
    },
    notes: {
      bookingId: String(booking.id),
      train: trainMeta.trainNumber || ''
    }
  });

  const verifyKey = idempotencyKey ? `${idempotencyKey}-verify` : undefined;
  const verified = await api.post('/payments/verify', {
    bookingId: booking.id,
    razorpay_order_id: payment.razorpay_order_id,
    razorpay_payment_id: payment.razorpay_payment_id,
    razorpay_signature: payment.razorpay_signature
  }, verifyKey ? { idempotencyKey: verifyKey } : {});

  if (verified.booking) return verified.booking;

  const polled = await pollBookingStatus(booking.id);
  if (polled?.status === 'Confirmed') {
    return api.get(`/bookings/${booking.id}`);
  }

  return verified.booking;
}
