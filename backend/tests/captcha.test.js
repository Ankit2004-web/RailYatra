const test = require('node:test');
const assert = require('node:assert/strict');
const { createChallenge, verifyChallenge } = require('../services/captchaService');

test('image captcha verifies matching text case-insensitively', () => {
    const challenge = createChallenge();
    assert.ok(challenge.captchaId);
    assert.match(challenge.image, /image\/svg\+xml/);
    assert.ok(challenge.devAnswer);
    assert.equal(verifyChallenge(challenge.captchaId, challenge.devAnswer.toLowerCase()), true);
});

test('image captcha rejects a wrong answer', () => {
    const challenge = createChallenge();
    assert.equal(verifyChallenge(challenge.captchaId, 'XXXXX'), false);
});

test('image captcha cannot be reused after success', () => {
    const challenge = createChallenge();
    assert.equal(verifyChallenge(challenge.captchaId, challenge.devAnswer), true);
    assert.equal(verifyChallenge(challenge.captchaId, challenge.devAnswer), false);
});
