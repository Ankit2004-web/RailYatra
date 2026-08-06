process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-e2e-tests';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const dbReady = (() => {
    try {
        require('../../database/connection').loadDriver();
        return true;
    } catch {
        return false;
    }
})();

const app = require('../server');

const solveCaptcha = (question) => {
    const match = String(question).match(/(\d+)\s*\+\s*(\d+)/);
    if (!match) throw new Error(`Could not parse captcha question: ${question}`);
    return String(Number(match[1]) + Number(match[2]));
};

const fetchCaptcha = async (agent) => {
    const response = await agent.get('/api/captcha');
    assert.equal(response.status, 200);
    return {
        captchaId: response.body.captchaId,
        captchaAnswer: solveCaptcha(response.body.question)
    };
};

test('E2E booking → dev payment → ticket download', { skip: dbReady ? false : 'SQL Server driver unavailable' }, async () => {
    if (dbReady) {
        await require('../../database/sync')();
    }

    const agent = request(app);
    const email = `e2e_${Date.now()}@railyatra.test`;
    const phone = `9${String(Date.now()).slice(-9)}`;
    const password = 'Test@123456';
    const captcha = await fetchCaptcha(agent);

    const registerResponse = await agent
        .post('/api/auth/register')
        .send({
            name: 'E2E Traveller',
            email,
            phone,
            password,
            ...captcha
        });

    assert.equal(registerResponse.status, 200);
    assert.ok(registerResponse.body.token);
    const token = registerResponse.body.token;
    const authHeader = { 'x-auth-token': token };

    const trainsResponse = await agent.get('/api/trains').set(authHeader);
    assert.equal(trainsResponse.status, 200);
    assert.ok(trainsResponse.body.length > 0, 'Seed trains required for E2E test');

    const train = trainsResponse.body[0];
    const trainDetail = await agent.get(`/api/trains/${train.id}`).set(authHeader);
    assert.equal(trainDetail.status, 200);
    assert.ok(trainDetail.body.classes?.length, 'Train must have at least one class');

    const classCode = trainDetail.body.classes[0].classCode;
    const journeyDate = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];

    const bookingCaptcha = await fetchCaptcha(agent);
    const bookingResponse = await agent
        .post('/api/bookings')
        .set(authHeader)
        .send({
            trainId: train.id,
            journeyDate,
            classCode,
            passengers: [{ name: 'E2E Passenger', age: 28, gender: 'Male', berthPreference: 'Lower' }],
            bookingType: 'General',
            quota: 'General',
            seatNumbers: [],
            ...bookingCaptcha
        });

    assert.equal(bookingResponse.status, 201, bookingResponse.body?.msg || 'booking failed');
    assert.equal(bookingResponse.body.status, 'Pending');
    const bookingId = bookingResponse.body.id;

    const payResponse = await agent
        .post('/api/payments/dev-confirm')
        .set(authHeader)
        .send({ bookingId });

    assert.equal(payResponse.status, 200);
    assert.equal(payResponse.body.booking.status, 'Confirmed');
    assert.ok(payResponse.body.booking.seatNumbers?.length > 0);

    const ticketResponse = await agent
        .get(`/api/bookings/${bookingId}/ticket`)
        .set(authHeader);

    assert.equal(ticketResponse.status, 200);
    assert.match(ticketResponse.headers['content-type'], /pdf/i);
    assert.ok(ticketResponse.body.length > 500, 'Ticket PDF should not be empty');
});
