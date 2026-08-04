const test = require('node:test');
const assert = require('node:assert/strict');
const { buildKey } = require('../repositories/searchCacheRepository');
const { hashKey } = require('../repositories/idempotencyRepository');

test('searchCache buildKey is deterministic for same params', () => {
    const params = { from: 'NDLS', to: 'BCT', date: '2026-08-01', classCode: 'SL', flexDays: 1 };
    assert.equal(buildKey(params), buildKey(params));
    assert.notEqual(buildKey(params), buildKey({ ...params, flexDays: 0 }));
});

test('idempotency hashKey truncates client key to 64 chars', () => {
    const longKey = 'a'.repeat(100);
    assert.equal(hashKey(1, longKey).length, 64);
    assert.equal(hashKey(1, 'uuid-test-key'), 'uuid-test-key');
});

test('idempotency middleware skips when no header', async () => {
    const idempotencyMiddleware = require('../middleware/idempotency');
    const middleware = idempotencyMiddleware('/api/bookings');
    let called = false;
    const req = { method: 'POST', headers: {}, user: { id: 1 }, baseUrl: '/api/bookings', path: '/' };
    const res = { statusCode: 201, json: () => res };
    await new Promise((resolve) => {
        middleware(req, res, () => { called = true; resolve(); });
    });
    assert.equal(called, true);
});
