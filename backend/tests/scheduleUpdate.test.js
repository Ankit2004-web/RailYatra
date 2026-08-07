const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTrainNumbers } = require('../services/scheduleUpdateService');

test('parseTrainNumbers normalizes comma-separated 5-digit numbers', () => {
    assert.deepEqual(parseTrainNumbers('12021, 12301, abc'), ['12021', '12301']);
});

test('parseTrainNumbers caps batch size', () => {
    const nums = Array.from({ length: 20 }, (_, i) => String(10000 + i)).join(',');
    assert.equal(parseTrainNumbers(nums).length, 10);
});
