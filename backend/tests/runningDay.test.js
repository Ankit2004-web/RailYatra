const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const runningDayService = require('../services/runningDayService');

describe('running day service', () => {
    it('parses Daily as all 7 days', () => {
        assert.deepEqual(runningDayService.parseRunningDaysString('Daily'), [1, 2, 3, 4, 5, 6, 7]);
    });

    it('calculates source departure date from boarding offset', () => {
        const source = runningDayService.calculateSourceDepartureDate('2026-07-21', 1);
        assert.equal(source, '2026-07-20');
    });

    it('multi-day test: train departs Monday, board at B on Tuesday', () => {
        const monday = '2026-07-20';
        const tuesday = '2026-07-21';
        const runningDays = [1];
        const fromOffset = 1;
        assert.equal(runningDayService.trainRunsOnBoardingDate(tuesday, fromOffset, runningDays), true);
        assert.equal(runningDayService.calculateSourceDepartureDate(tuesday, fromOffset), monday);
    });

    it('resolveRunningDayList returns empty when source data missing', () => {
        assert.deepEqual(
            runningDayService.resolveRunningDayList('Not in source dataset'),
            []
        );
    });

    it('effectiveRunningDays defaults to daily when source data missing', () => {
        assert.deepEqual(
            runningDayService.effectiveRunningDays('Not in source dataset'),
            [1, 2, 3, 4, 5, 6, 7]
        );
    });

    it('resolveRunningDayList prefers normalized map over text', () => {
        assert.deepEqual(
            runningDayService.resolveRunningDayList('Daily', [1, 3, 5]),
            [1, 3, 5]
        );
    });

    it('returns empty for not-in-source running days', () => {
        assert.deepEqual(runningDayService.parseRunningDaysString('Not in source dataset'), []);
    });

    it('returns false when source day does not run', () => {
        const tuesday = '2026-07-21';
        assert.equal(runningDayService.trainRunsOnBoardingDate(tuesday, 0, [3]), false);
    });

    it('trainRunsOnBoardingDate rejects when running days unknown', () => {
        assert.equal(runningDayService.trainRunsOnBoardingDate('2026-07-21', 0, []), false);
    });

    it('trainRunsOnBoardingDate passes when effective days default to daily', () => {
        const days = runningDayService.effectiveRunningDays('Not in source dataset');
        assert.equal(runningDayService.trainRunsOnBoardingDate('2026-07-21', 0, days), true);
    });

    it('calculates duration across day boundary', () => {
        const mins = runningDayService.calculateDurationMinutes(
            { departureTime: '22:00', departureDayOffset: 0 },
            { arrivalTime: '02:00', arrivalDayOffset: 1 }
        );
        assert.equal(mins, 240);
    });
});
