const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEmail } = require('../utils/email');

test('normalizeEmail lowercases and removes Gmail dots', () => {
    assert.equal(normalizeEmail('ImAnKit.Biswas@Gmail.com'), 'imankitbiswas@gmail.com');
    assert.equal(normalizeEmail('imankitbiswas@gmail.com'), 'imankitbiswas@gmail.com');
    assert.equal(normalizeEmail('user@Example.com'), 'user@example.com');
    assert.equal(normalizeEmail('a.b.c@googlemail.com'), 'abc@gmail.com');
});

test('normalizeEmail makes dotted and plain Gmail equivalent', () => {
    assert.equal(
        normalizeEmail('imankit.biswas@gmail.com'),
        normalizeEmail('imankitbiswas@gmail.com')
    );
});
