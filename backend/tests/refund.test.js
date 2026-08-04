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
