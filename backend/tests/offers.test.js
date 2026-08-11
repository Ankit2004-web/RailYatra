const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getOffersPayload,
  getActiveOffers,
  getAppliedOfferDetails,
  istDateKey,
  findOfferByCode
} = require('../../shared/offers/engine');

test('offers refresh daily with new date-based codes', () => {
  const day1 = new Date('2026-08-11T10:00:00Z');
  const day2 = new Date('2026-08-12T10:00:00Z');

  const offers1 = getActiveOffers(day1);
  const offers2 = getActiveOffers(day2);

  assert.ok(offers1.length > 0);
  assert.notEqual(
    offers1.find((o) => o.id === 'daily-flash')?.code,
    offers2.find((o) => o.id === 'daily-flash')?.code
  );
});

test('weekend offer appears only on Fri-Sat-Sun IST', () => {
  const friday = new Date('2026-08-14T10:00:00Z');
  const monday = new Date('2026-08-17T10:00:00Z');

  const friOffers = getActiveOffers(friday);
  const monOffers = getActiveOffers(monday);

  assert.ok(friOffers.some((o) => o.id === 'weekend-rush'));
  assert.equal(monOffers.some((o) => o.id === 'weekend-rush'), false);
});

test('getOffersPayload includes refresh metadata', () => {
  const payload = getOffersPayload(new Date('2026-08-11T06:00:00Z'));
  assert.equal(payload.mode, 'daily');
  assert.ok(payload.refreshedFor);
  assert.ok(payload.refreshedLabel);
  assert.ok(Array.isArray(payload.offers));
  assert.ok(payload.totalActive >= 1);
});

test('daily flash discount applies with today code', () => {
  const ref = new Date('2026-08-11T06:00:00Z');
  const offers = getActiveOffers(ref);
  const flash = offers.find((o) => o.id === 'daily-flash');
  assert.ok(flash);

  const result = getAppliedOfferDetails(flash.code, { total: 800, classCode: 'SL' }, ref);
  assert.equal(result.error, null);
  assert.ok(result.savings > 0);
});

test('expired daily code from yesterday is rejected', () => {
  const yesterday = new Date('2026-08-10T06:00:00Z');
  const today = new Date('2026-08-11T06:00:00Z');
  const oldFlash = getActiveOffers(yesterday).find((o) => o.id === 'daily-flash');

  const result = getAppliedOfferDetails(oldFlash.code, { total: 800 }, today);
  assert.match(result.error || '', /invalid|expired/i);
});
