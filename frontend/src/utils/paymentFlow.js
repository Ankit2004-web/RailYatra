import { api } from '../api/client';
import { openRazorpayCheckout } from './razorpay';

export async function completeBookingPayment(booking, user, trainMeta = {}) {
  const order = await api.post('/payments/create-order', { bookingId: booking.id });

  if (order.devMode) {
    const confirmed = await api.post('/payments/dev-confirm', { bookingId: booking.id });
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
      contact: user?.phone || ''
    },
    notes: {
      bookingId: String(booking.id),
      train: trainMeta.trainNumber || ''
    }
  });

  const verified = await api.post('/payments/verify', {
    bookingId: booking.id,
    razorpay_order_id: payment.razorpay_order_id,
    razorpay_payment_id: payment.razorpay_payment_id,
    razorpay_signature: payment.razorpay_signature
  });

  return verified.booking;
}
