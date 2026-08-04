const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../server');

test('GET /api/health returns ok', async () => {
    const response = await request(app).get('/api/health');
    assert.equal(response.status, 200);
    assert.equal(response.body.status, 'ok');
    assert.equal(response.body.database, 'Microsoft SQL Server');
});

test('GET /api/captcha returns a challenge', async () => {
    const response = await request(app).get('/api/captcha');
    assert.equal(response.status, 200);
    assert.ok(response.body.captchaId);
    assert.match(response.body.question, /\d+ \+ \d+ = \?/);
});

test('POST /api/auth/login rejects missing captcha', async () => {
    const response = await request(app)
        .post('/api/auth/login')
        .send({ phone: '9876543210', password: 'secret123' });

    assert.equal(response.status, 400);
});

test('POST /api/auth/login maps legacy email field to phone', async () => {
    const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@railway.com', password: 'secret123', captchaId: 'x', captchaAnswer: '1' });

    assert.notEqual(response.body.errors?.some((e) => e.message === 'Mobile number or email is required'), true);
});

test('GET /api/admin/dashboard requires auth', async () => {
    const response = await request(app).get('/api/admin/dashboard');
    assert.equal(response.status, 401);
});

test('GET /api/swagger serves Swagger UI HTML', async () => {
    const response = await request(app).get('/api/swagger');
    assert.equal(response.status, 200);
    assert.match(response.text, /swagger-ui/i);
    assert.match(response.text, /openapi\.yaml/i);
});

test('GET /api/passengers/saved requires auth', async () => {
    const response = await request(app).get('/api/passengers/saved');
    assert.equal(response.status, 401);
});

test('GET /api/docs includes swaggerUi link', async () => {
    const response = await request(app).get('/api/docs');
    assert.equal(response.status, 200);
    assert.equal(response.body.swaggerUi, '/api/swagger');
});

test('POST /api/payments/webhook rejects missing secret configuration', async () => {
    const previous = process.env.RAZORPAY_WEBHOOK_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;

    const response = await request(app)
        .post('/api/payments/webhook')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ event: 'payment.captured' }));

    assert.equal(response.status, 503);

    if (previous) process.env.RAZORPAY_WEBHOOK_SECRET = previous;
});
