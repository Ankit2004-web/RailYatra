const test = require('node:test');
const assert = require('node:assert/strict');
const { isAwaitingPayment, isSeatHeldBooking } = require('../utils/bookingStatus');

test('isAwaitingPayment accepts Pending, Waitlisted, and RAC with unpaid payment', () => {
    assert.equal(isAwaitingPayment({ status: 'Pending', paymentStatus: 'Pending' }), true);
    assert.equal(isAwaitingPayment({ status: 'Waitlisted', paymentStatus: 'Pending' }), true);
    assert.equal(isAwaitingPayment({ status: 'RAC', paymentStatus: 'Pending' }), true);
    assert.equal(isAwaitingPayment({ status: 'Confirmed', paymentStatus: 'Paid' }), false);
    assert.equal(isAwaitingPayment({ status: 'Pending', paymentStatus: 'Paid' }), false);
});

test('isSeatHeldBooking only matches unpaid seat-held Pending bookings', () => {
    assert.equal(isSeatHeldBooking({ status: 'Pending', paymentStatus: 'Pending' }), true);
    assert.equal(isSeatHeldBooking({ status: 'Waitlisted', paymentStatus: 'Pending' }), false);
    assert.equal(isSeatHeldBooking({ status: 'Pending', paymentStatus: 'Paid' }), false);
});
