const assert = require('assert');
const { parseWikipediaTrainPage, parseCoachComposition } = require('../../database/import/wikipediaTrainPageParser');
const { getClassCapacity, setWikiRakeCounts } = require('../utils/coachCapacity');

const SAMPLE_WIKITEXT = `{{Infobox rail service
| name = Puri Howrah Express
| start = {{stnlnk|Puri}}
| end = {{stnlnk|Howrah Junction}}
| distance = {{convert|502|km|0|abbr=on}}
| journeytime = 08 hours 30 mins in both ways
| frequency = Everyday
| class = AC First Class, AC 2 tier, AC 3 tier, AC 3 tier Economy, Sleeper class, Unreserved
| stock = LHB coaches
| trainnumber = 12837 / 12838
}}
==Coaches==
* 1 SLR
* 2 Unreserved
* 8 Sleeper Class
* 2 AC 3 tier Econony
* 5 AC 3 tier
* 2 AC 2 tier
* 1 AC First Class
* 1 Generator Car
==Service==
12838 departs Puri at 08:15 PM and arrives Howrah at 05:15 AM taking almost same time.
==Routeing==
The 12837 / 38 Howrah–Puri Express runs from Howrah Junction via {{stnlnk|Kharagpur Junction}}, {{stnlnk|Balasore}}, {{stnlnk|Cuttack}}, {{stnlnk|Bhubaneswar}} to Puri.`;

const { coachCounts } = parseCoachComposition(SAMPLE_WIKITEXT);
assert.strictEqual(coachCounts['1A'], 1);
assert.strictEqual(coachCounts['2A'], 2);
assert.strictEqual(coachCounts['3A'], 5);
assert.strictEqual(coachCounts['3E'], 2);
assert.strictEqual(coachCounts.SL, 8);
assert.strictEqual(coachCounts.GS, 2);

const parsed = parseWikipediaTrainPage(SAMPLE_WIKITEXT, { trainNumber: '12838' });
const t12838 = parsed.trains.find((t) => t.trainNumber === '12838');
assert.ok(t12838, '12838 should be parsed');
assert.strictEqual(t12838.originName, 'Puri');
assert.strictEqual(t12838.destinationName, 'Howrah');
assert.strictEqual(t12838.distanceKm, 502);
assert.strictEqual(t12838.coachBuild, 'LHB');
assert.ok(t12838.stops.length >= 5);
assert.strictEqual(t12838.stops[0].stationName, 'Puri');
assert.strictEqual(t12838.stops[t12838.stops.length - 1].stationName, 'Howrah Junction');

setWikiRakeCounts({
    12838: { '1A': 1, '2A': 2, '3A': 5, '3E': 2, SL: 8, GS: 2, _coachBuild: 'LHB' }
});
assert.strictEqual(getClassCapacity('1A', 'Puri Howrah Express', 'SF', '12838'), 22);
assert.strictEqual(getClassCapacity('2A', 'Puri Howrah Express', 'SF', '12838'), 92);
assert.strictEqual(getClassCapacity('3A', 'Puri Howrah Express', 'SF', '12838'), 320);
assert.strictEqual(getClassCapacity('3E', 'Puri Howrah Express', 'SF', '12838'), 156);
assert.strictEqual(getClassCapacity('SL', 'Puri Howrah Express', 'SF', '12838'), 624);
assert.strictEqual(getClassCapacity('GS', 'Puri Howrah Express', 'SF', '12838'), 198);

console.log('wikipediaTrainPage.test.js: all tests passed');
