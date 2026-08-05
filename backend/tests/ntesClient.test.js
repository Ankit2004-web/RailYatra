const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTrainStatusHtml, mapParsedToLiveStatus } = require('../services/ntesClient');

const SAMPLE_HTML = `
<html><body>
<div>Train Name : KOLKATA RAJDHANI</div>
<div>Start Date : 05-Aug-2026</div>
<div>Last Updates On 05-Aug-2026 14:22</div>
<div>Departed from NEW DELHI (NDLS) at 16:55 Delay: 00:05</div>
<div>Arrived at KANPUR CENTRAL (CNB) at 21:40 Delay: 00:10</div>
<div>Current Position : KANPUR CENTRAL (CNB)</div>
<div>Next Station : ALLAHABAD JN (ALD)</div>
<div>Platform : 4</div>
</body></html>
`;

test('parseTrainStatusHtml extracts NTES running events', () => {
    const parsed = parseTrainStatusHtml(SAMPLE_HTML);
    assert.equal(parsed.trainName, 'KOLKATA RAJDHANI');
    assert.equal(parsed.startDate, '05-Aug-2026');
    assert.ok(parsed.events.length >= 2);
    assert.equal(parsed.events[0].code, 'NDLS');
    assert.equal(parsed.delayMinutes, 10);
    assert.equal(parsed.nextStation, 'ALLAHABAD JN');
    assert.equal(parsed.platform, '4');
});

test('mapParsedToLiveStatus returns live train view model', () => {
    const parsed = parseTrainStatusHtml(SAMPLE_HTML);
    const vm = mapParsedToLiveStatus(parsed, '12301', { trainName: 'Fallback' });
    assert.equal(vm.trainNumber, '12301');
    assert.equal(vm.provider, 'ntes');
    assert.equal(vm.dataSource, 'ntes');
    assert.equal(vm.trainName, 'KOLKATA RAJDHANI');
    assert.equal(vm.status, 'Running');
});
