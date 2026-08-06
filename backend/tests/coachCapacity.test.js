const assert = require('assert');
const {
    getBerthsPerCoach,
    getClassCapacity,
    inferTrainCategory,
    inferCoachBuild,
    COACH_CAPACITY_ICF,
    COACH_CAPACITY_LHB
} = require('../utils/coachCapacity');

// LWFAC / LHB capacities (official IR per-coach classification)
assert.strictEqual(COACH_CAPACITY_LHB['1A'], 22);
assert.strictEqual(COACH_CAPACITY_LHB['2A'], 46);
assert.strictEqual(COACH_CAPACITY_LHB['3A'], 64);
assert.strictEqual(COACH_CAPACITY_LHB['3E'], 78);
assert.strictEqual(COACH_CAPACITY_LHB.EA, 50);
assert.strictEqual(COACH_CAPACITY_LHB.EC, 56);
assert.strictEqual(COACH_CAPACITY_LHB.CC, 73);
assert.strictEqual(COACH_CAPACITY_LHB.SL, 78);
assert.strictEqual(COACH_CAPACITY_LHB['2S'], 108);
assert.strictEqual(COACH_CAPACITY_LHB.GS, 99);

// ICF capacities
assert.strictEqual(COACH_CAPACITY_ICF['2A'], 46);
assert.strictEqual(COACH_CAPACITY_ICF['3A'], 64);
assert.strictEqual(COACH_CAPACITY_ICF.SL, 72);
assert.strictEqual(COACH_CAPACITY_ICF['2S'], 108);
assert.strictEqual(COACH_CAPACITY_ICF.GS, 90);

assert.strictEqual(getBerthsPerCoach('2A', 'LHB'), 46);
assert.strictEqual(getBerthsPerCoach('2A', 'ICF'), 46);
assert.strictEqual(getBerthsPerCoach('2S', 'ICF'), 108);
assert.strictEqual(getBerthsPerCoach('2S', 'LHB'), 108);

assert.strictEqual(inferCoachBuild('Mumbai Rajdhani Express'), 'LHB');
assert.strictEqual(inferCoachBuild('Lucknow Mail'), 'ICF');
assert.strictEqual(inferTrainCategory('Garib Rath Express'), 'garibRath');
assert.strictEqual(inferTrainCategory('Mumbai Rajdhani Express'), 'rajdhani');

assert.strictEqual(getClassCapacity('1A', 'Mumbai Rajdhani'), 22);
assert.strictEqual(getClassCapacity('2A', 'Mumbai Rajdhani'), 92);
assert.strictEqual(getClassCapacity('3A', 'Mumbai Rajdhani'), 256);
assert.strictEqual(getClassCapacity('SL', 'Lucknow Mail'), 432);
assert.strictEqual(getClassCapacity('3E', 'Garib Rath Express'), 936);

console.log('coachCapacity.test.js: all tests passed');
