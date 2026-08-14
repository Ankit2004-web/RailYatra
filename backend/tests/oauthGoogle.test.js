process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-oauth-tests';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../server');
const oauthService = require('../services/oauthService');

test('GET /api/oauth/google/config reports whether Google Sign-In is configured', async () => {
    const previous = process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.VITE_GOOGLE_CLIENT_ID;

    const disabled = await request(app).get('/api/oauth/google/config');
    assert.equal(disabled.status, 200);
    assert.equal(disabled.body.enabled, false);

    process.env.GOOGLE_CLIENT_ID = 'test-google-client.apps.googleusercontent.com';
    const enabled = await request(app).get('/api/oauth/google/config');
    assert.equal(enabled.status, 200);
    assert.equal(enabled.body.enabled, true);
    assert.equal(enabled.body.clientId, 'test-google-client.apps.googleusercontent.com');

    if (previous === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = previous;
});

test('verifyGoogleToken rejects missing token', async () => {
    await assert.rejects(() => oauthService.verifyGoogleToken(''), /Missing Google token/);
});

test('POST /api/oauth/google requires idToken', async () => {
    const response = await request(app).post('/api/oauth/google').send({});
    assert.equal(response.status, 400);
});
