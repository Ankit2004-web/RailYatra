const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    calculateBasicFare,
    calculateClassFare,
    ordinarySecondClassSlabIncrease,
    isCc11Effective,
    OFFICIAL_FARE_REFERENCE
} = require('../utils/irctcFareTable2025');

describe('IRCTC fare table — CC 11/2025', () => {
    it('references official Commercial Circular No. 11 of 2025', () => {
        assert.equal(OFFICIAL_FARE_REFERENCE.circular, 'Commercial Circular No. 11 of 2025');
        assert.equal(OFFICIAL_FARE_REFERENCE.effectiveFrom, '2025-07-01');
    });

    it('applies CC 11 revision from 01.07.2025 onward', () => {
        assert.equal(isCc11Effective('2025-06-30'), false);
        assert.equal(isCc11Effective('2025-07-01'), true);
        assert.equal(isCc11Effective('2026-07-31'), true);
    });

    it('uses ordinary second class slab increase per circular', () => {
        assert.equal(ordinarySecondClassSlabIncrease(400), 0);
        assert.equal(ordinarySecondClassSlabIncrease(800), 5);
        assert.equal(ordinarySecondClassSlabIncrease(1800), 10);
        assert.equal(ordinarySecondClassSlabIncrease(2800), 15);
    });

    it('charges more for AC than non-AC on same Mail/Express segment', () => {
        const context = {
            distanceKm: 500,
            trainTypeCode: 'SF',
            trainName: 'Dhauli Express',
            journeyDate: '2026-07-31'
        };
        const sl = calculateClassFare({ ...context, classCode: 'SL' });
        const ac = calculateClassFare({ ...context, classCode: '3A' });
        assert.ok(ac > sl);
    });

    it('adds CC 11 increment for journeys on or after July 2025', () => {
        const before = calculateBasicFare({
            distanceKm: 1000,
            classCode: '3A',
            trainTypeCode: 'EXP',
            trainName: 'Express',
            journeyDate: '2025-06-15'
        });
        const after = calculateBasicFare({
            distanceKm: 1000,
            classCode: '3A',
            trainTypeCode: 'EXP',
            trainName: 'Express',
            journeyDate: '2025-07-15'
        });
        assert.ok(after > before);
        assert.equal(after - before, 20);
    });

    it('includes reservation and superfast charges in class fare', () => {
        const baseOnly = calculateBasicFare({
            distanceKm: 350,
            classCode: 'SL',
            trainTypeCode: 'SF',
            trainName: 'Superfast',
            journeyDate: '2026-07-31'
        });
        const withCharges = calculateClassFare({
            distanceKm: 350,
            classCode: 'SL',
            trainTypeCode: 'SF',
            trainName: 'Superfast',
            journeyDate: '2026-07-31'
        });
        assert.ok(withCharges > baseOnly);
    });

    it('scales fare with distance', () => {
        const short = calculateClassFare({
            distanceKm: 150,
            classCode: '3A',
            trainTypeCode: 'EXP',
            journeyDate: '2026-07-31'
        });
        const long = calculateClassFare({
            distanceKm: 900,
            classCode: '3A',
            trainTypeCode: 'EXP',
            journeyDate: '2026-07-31'
        });
        assert.ok(long > short);
    });
});
