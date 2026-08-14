const test = require('node:test');
const assert = require('node:assert/strict');
const {
    evaluateBookingRules,
    isChartClosed,
    getTatkalWindow,
    isTatkalBookingOpen
} = require('../utils/irctcRules');

const ist = (iso) => new Date(iso);

const basePassengers = [{ name: 'Asha', age: 30, gender: 'Female', idType: 'Aadhaar', idNumber: '123412341234' }];
const aadhaarUser = { aadhaarVerified: true, role: 'passenger', phone: '9876543210' };
const plainUser = { aadhaarVerified: false, role: 'passenger', phone: '9876543210' };
const agentUser = { aadhaarVerified: true, role: 'booking_agent', phone: '9876543210' };

test('ARP rejects dates beyond 60 days', () => {
    const result = evaluateBookingRules({
        journeyDate: '2026-10-14',
        passengers: basePassengers,
        user: aadhaarUser,
        departureTime: '18:00',
        now: ist('2026-08-14T04:30:00.000Z')
    });
    assert.equal(result.status, 400);
    assert.match(result.error, /60 days/);
});

test('opening day before 8 AM IST is closed', () => {
    const result = evaluateBookingRules({
        journeyDate: '2026-10-13',
        passengers: basePassengers,
        user: aadhaarUser,
        departureTime: '18:00',
        now: ist('2026-08-14T02:00:00.000Z')
    });
    assert.match(result.error, /8:00 AM IST/);
});

test('opening day after 8 AM requires Aadhaar', () => {
    const denied = evaluateBookingRules({
        journeyDate: '2026-10-13',
        passengers: basePassengers,
        user: plainUser,
        departureTime: '18:00',
        now: ist('2026-08-14T03:00:00.000Z')
    });
    assert.equal(denied.status, 403);
    assert.match(denied.error, /Aadhaar/);

    const allowed = evaluateBookingRules({
        journeyDate: '2026-10-13',
        passengers: basePassengers,
        user: aadhaarUser,
        departureTime: '18:00',
        now: ist('2026-08-14T03:00:00.000Z')
    });
    assert.equal(allowed.ok, true);
});

test('general PNR allows 6 passengers and Tatkal allows 4', () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ ...basePassengers[0], name: `P${i}` }));
    const general = evaluateBookingRules({
        journeyDate: '2026-08-20',
        passengers: six,
        user: aadhaarUser,
        departureTime: '18:00',
        now: ist('2026-08-14T04:30:00.000Z')
    });
    assert.equal(general.ok, true);

    const tatkal = evaluateBookingRules({
        journeyDate: '2026-08-15',
        bookingType: 'Tatkal',
        classCode: '3A',
        passengers: six,
        user: aadhaarUser,
        departureTime: '18:00',
        aadhaarOtpOk: true,
        now: ist('2026-08-14T05:00:00.000Z')
    });
    assert.match(tatkal.error, /4 passengers/);
});

test('monthly cap is 12 unless account and passenger are Aadhaar-verified', () => {
    const capped = evaluateBookingRules({
        journeyDate: '2026-08-20',
        passengers: [{ name: 'Ravi', age: 40, gender: 'Male', idType: 'PAN', idNumber: 'ABCDE1234F' }],
        user: aadhaarUser,
        monthlyTicketCount: 12,
        departureTime: '18:00',
        now: ist('2026-08-14T04:30:00.000Z')
    });
    assert.equal(capped.status, 429);

    const raised = evaluateBookingRules({
        journeyDate: '2026-08-20',
        passengers: basePassengers,
        user: aadhaarUser,
        monthlyTicketCount: 12,
        departureTime: '18:00',
        now: ist('2026-08-14T04:30:00.000Z')
    });
    assert.equal(raised.ok, true);
});

test('morning trains chart at 8 PM IST the previous evening', () => {
    const closed = isChartClosed({
        journeyDate: '2026-08-15',
        departureTime: '08:00',
        now: ist('2026-08-14T14:30:00.000Z')
    });
    assert.equal(closed.closed, true);

    const open = isChartClosed({
        journeyDate: '2026-08-15',
        departureTime: '08:00',
        now: ist('2026-08-14T14:00:00.000Z')
    });
    assert.equal(open.closed, false);
});

test('Tatkal AC opens at 10:00 AM IST one day before departure', () => {
    const before = isTatkalBookingOpen({
        journeyDate: '2026-08-15',
        classCode: '3A',
        departureTime: '18:00',
        now: ist('2026-08-14T04:29:00.000Z')
    });
    assert.equal(before.ok, false);

    const after = getTatkalWindow({
        journeyDate: '2026-08-15',
        classCode: '3A',
        now: ist('2026-08-14T04:30:00.000Z')
    });
    assert.equal(after.opened, true);
    assert.equal(after.aadhaarPriority, true);
    assert.equal(after.agentBlocked, true);
});

test('agents are blocked for the first 30 minutes of Tatkal', () => {
    const result = evaluateBookingRules({
        journeyDate: '2026-08-15',
        bookingType: 'Tatkal',
        classCode: 'SL',
        passengers: basePassengers,
        user: agentUser,
        departureTime: '18:00',
        aadhaarOtpOk: true,
        now: ist('2026-08-14T05:50:00.000Z')
    });
    assert.equal(result.status, 403);
    assert.match(result.error, /agents/i);
});

test('Tatkal rejects 1A/EC and concession quotas', () => {
    const excluded = evaluateBookingRules({
        journeyDate: '2026-08-15',
        bookingType: 'Tatkal',
        classCode: '1A',
        passengers: basePassengers,
        user: aadhaarUser,
        departureTime: '18:00',
        aadhaarOtpOk: true,
        now: ist('2026-08-14T05:00:00.000Z')
    });
    assert.match(excluded.error, /1A/);

    const concession = evaluateBookingRules({
        journeyDate: '2026-08-15',
        bookingType: 'Tatkal',
        quota: 'SeniorCitizen',
        classCode: 'SL',
        passengers: basePassengers,
        user: aadhaarUser,
        departureTime: '18:00',
        aadhaarOtpOk: true,
        now: ist('2026-08-14T05:45:00.000Z')
    });
    assert.match(concession.error, /concessions/i);
});

test('Tatkal requires live Aadhaar OTP', () => {
    const result = evaluateBookingRules({
        journeyDate: '2026-08-15',
        bookingType: 'Tatkal',
        classCode: 'SL',
        passengers: basePassengers,
        user: aadhaarUser,
        departureTime: '18:00',
        aadhaarOtpOk: false,
        now: ist('2026-08-14T05:45:00.000Z')
    });
    assert.equal(result.status, 403);
    assert.match(result.error, /OTP/);
});
