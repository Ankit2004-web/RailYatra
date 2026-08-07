const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTrainStatusHtml, mapParsedToLiveStatus, parseTrainRouteHtml } = require('../services/ntesClient');

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

const ROUTE_HTML = `
<h5>HOWRAH JN - BARBIL</h5>
<div class=" w3-card-2 w3-sand"><div><font size="2" color="green"><b>Yet to start from its source</b></font></div></div>
<div class=" w3-card-2 stopRow" style="width:100%;">
 <div class="w3-container" style="float:left;width:100px;text-align:right;">
  <span><b><font size="1">06:00 08-Aug</font></b></span>
 </div>
 <div class="w3-bar-block"><div class="w3-bar-item"><i class="fa fa-circle" style="color:green;"></i></div></div>
 <div class="w3-container" style="float:right;flex:1;display:flex;">
  <div class="w3-container" style="float:left;flex:1;">
   <span><font size="1"><b>HOWRAH JN</b><br>
   <div><b>HWH <span class="w3-round w3-orange">PF 9*</span></b></div>
   <br><b>0</b> KMs</font></span>
  </div>
  <div class="w3-container" style="float:right;text-align:right;width:100px;">
   <span><b><font size="1">06:00 08-Aug</font></b></span>
  </div>
 </div>
</div>
<div class=" w3-card-2 stopRow" style="width:100%;">
 <div class="w3-container" style="float:left;width:100px;text-align:right;">
  <span><b><font size="1">07:55 08-Aug</font></b></span><br>
  <span><font size="1" color="green"><b>07:55 08-Aug*</b><br><span class="w3-round w3-green">On Time</span></font></span>
 </div>
 <div class="w3-bar-block"><div class="w3-bar-item"><i class="fa fa-circle" style="color:orange;"></i></div></div>
 <div class="w3-container" style="float:right;flex:1;display:flex;">
  <div class="w3-container" style="float:left;flex:1;">
   <span><font size="1"><b>KHARAGPUR JN</b><br>
   <div><b>KGP <span class="w3-round w3-orange">PF 1*</span></b></div>
   <br><b>116</b> KMs</font></span>
  </div>
  <div class="w3-container" style="float:right;text-align:right;width:100px;">
   <span><b><font size="1">08:00 08-Aug</font></b></span>
  </div>
 </div>
</div>
`;

test('parseTrainRouteHtml extracts full station timeline', () => {
    const route = parseTrainRouteHtml(ROUTE_HTML);
    assert.equal(route.stops.length, 2);
    assert.equal(route.stops[0].stationCode, 'HWH');
    assert.equal(route.stops[1].stationName, 'KHARAGPUR JN');
    assert.equal(route.stops[1].distanceKm, 116);
    assert.equal(route.stops[1].arrival.onTime, true);
    assert.match(route.statusBanner, /Yet to start/i);
});
