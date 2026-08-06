const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { intervalsOverlap, canAllocateSeat } = require('../utils/segmentOverlap');
const runningDayService = require('../services/runningDayService');
const { filterTrainsDepartingAfterNow } = require('../services/trainSearchService');

describe('today departure filtering', () => {
    const today = '2026-08-06';
    const istClock = { date: today, minutes: 13 * 60 + 20 };

    it('keeps future-date trains regardless of departure time', () => {
        assert.equal(
            runningDayService.isBoardingDepartureUpcoming('2026-08-07', '06:00', 0, istClock),
            true
        );
    });

    it('hides today trains that already departed', () => {
        assert.equal(
            runningDayService.isBoardingDepartureUpcoming(today, '10:30', 0, istClock),
            false
        );
    });

    it('keeps today trains departing after the current IST time', () => {
        assert.equal(
            runningDayService.isBoardingDepartureUpcoming(today, '14:05', 0, istClock),
            true
        );
    });

    it('filters mixed search results by journey date', () => {
        const filtered = filterTrainsDepartingAfterNow([
            { id: 1, journeyDate: today, departureTime: '09:00' },
            { id: 2, journeyDate: today, departureTime: '15:30' },
            { id: 3, journeyDate: '2026-08-07', departureTime: '08:00' }
        ], istClock);

        assert.deepEqual(filtered.map((t) => t.id), [2, 3]);
    });
});

describe('segment overlap inventory', () => {
    it('non-overlapping segments allow reuse', () => {
        assert.equal(intervalsOverlap(1, 3, 3, 5), false);
        assert.equal(canAllocateSeat([{ fromStopSequence: 1, toStopSequence: 3 }], 3, 5), true);
    });

    it('overlapping segments block allocation', () => {
        assert.equal(intervalsOverlap(1, 3, 2, 4), true);
        assert.equal(canAllocateSeat([{ fromStopSequence: 1, toStopSequence: 3 }], 2, 4), false);
    });

    it('adjacent segments [1,3) and [3,5) do not conflict', () => {
        assert.equal(canAllocateSeat([{ fromStopSequence: 1, toStopSequence: 3 }], 3, 5), true);
    });
});

describe('train route search logic (in-memory spec train 10001)', () => {
    const stops = [
        { stationCode: 'DEVA', stopSequence: 1 },
        { stationCode: 'DEVB', stopSequence: 2 },
        { stationCode: 'DEVC', stopSequence: 3 },
        { stationCode: 'DEVD', stopSequence: 4 },
        { stationCode: 'DEVE', stopSequence: 5 }
    ];

    function findRoute(fromCode, toCode) {
        if (fromCode === toCode) return null;
        const from = stops.find((s) => s.stationCode === fromCode);
        const to = stops.find((s) => s.stationCode === toCode);
        if (!from || !to) return null;
        if (from.stopSequence >= to.stopSequence) return null;
        return { from, to };
    }

    it('A→E found', () => assert.ok(findRoute('DEVA', 'DEVE')));
    it('B→D found', () => assert.ok(findRoute('DEVB', 'DEVD')));
    it('C→E found', () => assert.ok(findRoute('DEVC', 'DEVE')));
    it('D→B not found', () => assert.equal(findRoute('DEVD', 'DEVB'), null));
    it('E→A not found', () => assert.equal(findRoute('DEVE', 'DEVA'), null));
    it('A→A invalid', () => assert.equal(findRoute('DEVA', 'DEVA'), null));
});
