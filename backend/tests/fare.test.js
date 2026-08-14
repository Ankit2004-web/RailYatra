const test = require('node:test');
const assert = require('node:assert/strict');
const { getPassengerFare } = require('../utils/quota');
const { calculateBookingFare } = require('../utils/fare');

test('Tatkal does not apply senior or Divyang concessions', () => {
    const senior = { age: 65, isSeniorCitizen: true, isDivyang: false };
    const generalFare = getPassengerFare(1000, 'SeniorCitizen', senior, 'General');
    const tatkalFare = getPassengerFare(1000, 'SeniorCitizen', senior, 'Tatkal');
    assert.equal(generalFare, 600);
    assert.equal(tatkalFare, 1000);

    const result = calculateBookingFare({
        basePrice: 1000,
        bookingType: 'Tatkal',
        quota: 'General',
        passengers: [{ age: 70, isSeniorCitizen: true }]
    });
    assert.equal(result.totalPrice, 1300);
});
