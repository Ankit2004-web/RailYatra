const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { verifyWebhookSignature, isWebhookConfigured } = require('../services/razorpayService');

test('verifyWebhookSignature validates Razorpay HMAC', () => {
    const previous = process.env.RAZORPAY_WEBHOOK_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret';
    const body = Buffer.from(JSON.stringify({ event: 'payment.captured' }));
    const signature = crypto.createHmac('sha256', 'test_webhook_secret').update(body).digest('hex');

    assert.equal(isWebhookConfigured(), true);
    assert.equal(verifyWebhookSignature(body, signature), true);
    assert.equal(verifyWebhookSignature(body, 'bad-signature'), false);

    if (previous === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = previous;
});
