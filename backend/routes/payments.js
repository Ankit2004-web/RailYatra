const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { body } = require('express-validator');
const bookingRepository = require('../repositories/bookingRepository');
const paymentRepository = require('../repositories/paymentRepository');
const razorpayService = require('../services/razorpayService');
const { isAwaitingPayment } = require('../utils/bookingStatus');
const idempotencyMiddleware = require('../middleware/idempotency');
const auditLogger = require('../middleware/auditLogger');

const paymentRules = [
    body('bookingId').isInt({ min: 1 }).withMessage('Valid booking ID is required')
];

const verifyRules = [
    body('bookingId').isInt({ min: 1 }).withMessage('Valid booking ID is required'),
    body('razorpay_order_id').notEmpty().withMessage('Order ID is required'),
    body('razorpay_payment_id').notEmpty().withMessage('Payment ID is required'),
    body('razorpay_signature').if(() => razorpayService.isConfigured() && !allowDevPayment()).notEmpty().withMessage('Payment signature is required')
];

const allowDevPayment = () => (
    process.env.ALLOW_DEV_PAYMENT === '1' || process.env.ALLOW_DEV_PAYMENT === 'true' || !razorpayService.isConfigured()
);

router.get('/config', (req, res) => {
    const configured = razorpayService.isConfigured() && !allowDevPayment();
    res.json({
        devMode: !configured,
        keyId: configured ? process.env.RAZORPAY_KEY_ID : null
    });
});

router.post('/create-order', auth, idempotencyMiddleware('/api/payments/create-order'), paymentRules, validate, async (req, res) => {
    try {
        const booking = await bookingRepository.findById(req.body.bookingId);

        if (!booking) {
            return res.status(404).json({ msg: 'Booking not found' });
        }

        if (booking.user.id !== req.user.id) {
            return res.status(403).json({ msg: 'Not authorized' });
        }

        if (!isAwaitingPayment(booking)) {
            return res.status(400).json({ msg: 'Booking is not awaiting payment' });
        }

        const payableAmount = booking.grandTotal || booking.paymentBreakdown?.totalFare || booking.totalPrice;
        const order = await razorpayService.createOrder(payableAmount, booking.id);
        await paymentRepository.create({
            bookingId: booking.id,
            razorpayOrderId: order.id,
            amount: payableAmount
        });

        res.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            key: order.key,
            devMode: order.devMode || allowDevPayment(),
            bookingId: booking.id
        });
    } catch (err) {
        console.error('Create order error:', err.message);
        if (allowDevPayment()) {
            try {
                const booking = await bookingRepository.findById(req.body.bookingId);
                const payableAmount = booking.grandTotal || booking.paymentBreakdown?.totalFare || booking.totalPrice;
                const order = { id: `dev_order_${booking.id}_${Date.now()}`, amount: Math.round(Number(payableAmount) * 100), currency: 'INR', key: 'dev_mode', devMode: true };
                await paymentRepository.create({ bookingId: booking.id, razorpayOrderId: order.id, amount: payableAmount });
                return res.json({ orderId: order.id, amount: order.amount, currency: order.currency, key: order.key, devMode: true, bookingId: booking.id });
            } catch (fallbackErr) {
                console.error('Dev payment fallback failed:', fallbackErr.message);
            }
        }
        res.status(500).json({ msg: 'Failed to create payment order' });
    }
});

router.post('/verify', auth, idempotencyMiddleware('/api/payments/verify'), verifyRules, validate, auditLogger('payment.verify', 'payment'), async (req, res) => {
    const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    try {
        const booking = await bookingRepository.findById(bookingId);

        if (!booking) {
            return res.status(404).json({ msg: 'Booking not found' });
        }

        if (booking.user.id !== req.user.id) {
            return res.status(403).json({ msg: 'Not authorized' });
        }

        if (!isAwaitingPayment(booking)) {
            return res.status(400).json({ msg: 'Booking is not awaiting payment' });
        }

        const isValid = razorpayService.verifyPayment({
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id,
            signature: razorpay_signature || ''
        });

        if (!isValid) {
            await paymentRepository.markFailed(bookingId);
            await bookingRepository.failBooking(bookingId);
            return res.status(400).json({ msg: 'Payment verification failed' });
        }

        await paymentRepository.markPaid(bookingId, razorpay_payment_id);
        const confirmed = await bookingRepository.confirmBooking(bookingId);

        res.json({ msg: 'Payment successful', booking: confirmed });
    } catch (err) {
        console.error('Verify payment error:', err.message);
        res.status(500).json({ msg: 'Payment verification failed' });
    }
});

router.post('/dev-confirm', auth, paymentRules, validate, async (req, res) => {
    if (razorpayService.isConfigured() && !allowDevPayment()) {
        return res.status(400).json({ msg: 'Dev confirm is only available without Razorpay keys' });
    }

    try {
        const booking = await bookingRepository.findById(req.body.bookingId);

        if (!booking) {
            return res.status(404).json({ msg: 'Booking not found' });
        }

        if (booking.user.id !== req.user.id) {
            return res.status(403).json({ msg: 'Not authorized' });
        }

        if (!isAwaitingPayment(booking)) {
            return res.status(400).json({ msg: 'Booking is not awaiting payment' });
        }

        const payableAmount = booking.grandTotal || booking.paymentBreakdown?.totalFare || booking.totalPrice;
        const order = await razorpayService.createOrder(payableAmount, booking.id);
        await paymentRepository.create({
            bookingId: booking.id,
            razorpayOrderId: order.id,
            amount: payableAmount
        });
        await paymentRepository.markPaid(booking.id, `dev_pay_${booking.id}`);
        const confirmed = await bookingRepository.confirmBooking(booking.id);

        res.json({ msg: 'Payment simulated (dev mode)', booking: confirmed });
    } catch (err) {
        console.error('Dev confirm error:', err.message);
        res.status(500).json({ msg: 'Failed to confirm payment' });
    }
});

module.exports = router;
