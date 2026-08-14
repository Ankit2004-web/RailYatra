const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateRefund } = require('../utils/refund');

test('full refund for waitlisted booking', () => {
    const result = calculateRefund({
        totalPrice: 1000,
        journeyDate: '2030-01-01',
        paymentStatus: 'Pending',
        bookingStatus: 'Waitlisted',
        passengerCount: 1
    });
    assert.equal(result.refundAmount, 0);
});

test('full refund for paid RAC booking', () => {
    const result = calculateRefund({
        totalPrice: 1200,
        journeyDate: '2030-01-01',
        paymentStatus: 'Paid',
        bookingStatus: 'RAC',
        passengerCount: 1
    });
    assert.equal(result.refundAmount, 1200);
});

test('100% refund minus charge when cancelled 48h+ before journey', () => {
    const journeyDate = new Date();
    journeyDate.setDate(journeyDate.getDate() + 5);
    const result = calculateRefund({
        totalPrice: 1000,
        journeyDate: journeyDate.toISOString().split('T')[0],
        paymentStatus: 'Paid',
        bookingStatus: 'Confirmed',
        passengerCount: 2
    });
    assert.equal(result.refundPercent, 100);
    assert.equal(result.refundAmount, 960);
});

test('confirmed Tatkal cancelled by passenger has zero refund', () => {
    const result = calculateRefund({
        totalPrice: 1800,
        journeyDate: '2030-01-01',
        paymentStatus: 'Paid',
        bookingStatus: 'Confirmed',
        bookingType: 'Tatkal',
        passengerCount: 1
    });
    assert.equal(result.refundAmount, 0);
    assert.equal(result.refundPercent, 0);
});

test('Tatkal waitlist after chart refunds fare minus clerkage', () => {
    const result = calculateRefund({
        totalPrice: 1800,
        journeyDate: '2030-01-01',
        paymentStatus: 'Paid',
        bookingStatus: 'Waitlisted',
        bookingType: 'Tatkal',
        passengerCount: 2
    });
    assert.equal(result.refundAmount, 1780);
    assert.equal(result.cancellationCharge, 20);
});

test('train disruption grants full refund even for confirmed Tatkal', () => {
    const result = calculateRefund({
        totalPrice: 1800,
        journeyDate: '2030-01-01',
        paymentStatus: 'Paid',
        bookingStatus: 'Confirmed',
        bookingType: 'Tatkal',
        cause: 'train_cancelled'
    });
    assert.equal(result.refundAmount, 1800);
    assert.equal(result.refundPercent, 100);
});
