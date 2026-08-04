const bookingRepository = require('../repositories/bookingRepository');
const paymentRepository = require('../repositories/paymentRepository');
const razorpayService = require('../services/razorpayService');
const { isAwaitingPayment } = require('../utils/bookingStatus');

const handlePaymentWebhook = async (req, res) => {
    try {
        if (!razorpayService.isWebhookConfigured()) {
            return res.status(503).json({ msg: 'Webhook secret not configured' });
        }

        const signature = req.headers['x-razorpay-signature'];
        const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');

        if (!razorpayService.verifyWebhookSignature(rawBody, signature)) {
            return res.status(400).json({ msg: 'Invalid webhook signature' });
        }

        const payload = JSON.parse(rawBody.toString('utf8'));
        const event = payload.event;

        if (event === 'payment.captured') {
            const paymentEntity = payload.payload?.payment?.entity;
            const bookingId = Number(
                paymentEntity?.notes?.bookingId
                || paymentEntity?.notes?.booking_id
            );
            const paymentId = paymentEntity?.id;

            if (bookingId && paymentId) {
                const booking = await bookingRepository.findById(bookingId);
                if (booking && isAwaitingPayment(booking)) {
                    await paymentRepository.markPaid(bookingId, paymentId);
                    await bookingRepository.confirmBooking(bookingId);
                }
            }
        }

        if (event === 'refund.processed') {
            const paymentEntity = payload.payload?.payment?.entity;
            const bookingId = Number(paymentEntity?.notes?.bookingId);
            if (bookingId) {
                await paymentRepository.markRefunded(bookingId);
            }
        }

        res.json({ status: 'ok' });
    } catch (err) {
        console.error('Payment webhook error:', err.message);
        res.status(500).json({ msg: 'Webhook processing failed' });
    }
};

module.exports = handlePaymentWebhook;
