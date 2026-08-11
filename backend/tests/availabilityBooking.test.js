process.env.DB_DRIVER = 'sqlite';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

const test = require('node:test');
const assert = require('node:assert/strict');
const seatRepository = require('../repositories/seatRepository');
const { enrichClassesFromRakeCoaches } = require('../services/coachCompositionService');
const { withTransaction, runQuery } = require('../../database/connection');

test('enrichClassesFromRakeCoaches preserves booked-down availableSeats', () => {
  const classes = [{ classCode: 'SL', className: 'Sleeper', totalSeats: 400, availableSeats: 388, price: 900 }];
  const rakeCoaches = Array.from({ length: 6 }, (_, i) => ({
    classCode: 'SL',
    coachNumber: `S${i + 1}`,
    sleepingBerths: 72,
    seatingCapacity: null,
    seats: []
  }));

  const enriched = enrichClassesFromRakeCoaches(classes, rakeCoaches);
  assert.equal(enriched[0].availableSeats, 388);
  assert.ok(enriched[0].totalSeats >= 400);
});

test('syncAvailabilityAfterSeatChange updates TrainClasses from Seats table', async () => {
  const { getPool } = require('../../database/connection');
  await getPool();

  const trains = await runQuery('SELECT id FROM Trains WHERE isActive = 1 LIMIT 1');
  const trainId = trains[0]?.id;
  if (!trainId) {
    console.log('skip: no trains in test database');
    return;
  }

  const classes = await runQuery(
    'SELECT classCode, availableSeats FROM TrainClasses WHERE trainId = ? AND isAvailable = 1 LIMIT 1',
    [trainId]
  );
  const classCode = classes[0]?.classCode;
  if (!classCode) return;

  const journeyDate = '2030-06-15';
  const capacity = 20;

  await runQuery('DELETE FROM Seats WHERE trainId = ? AND classCode = ? AND journeyDate = ?', [trainId, classCode, journeyDate]);

  for (let seatNumber = 1; seatNumber <= capacity; seatNumber += 1) {
    await runQuery(
      `INSERT INTO Seats (trainId, classCode, seatNumber, berthType, journeyDate, status)
       VALUES (?, ?, ?, 'LB', ?, 'Available')`,
      [trainId, classCode, seatNumber, journeyDate]
    );
  }

  await withTransaction(async ({ query }) => {
    await query(
      `UPDATE Seats SET status = 'Booked', bookingId = 99999
       WHERE trainId = ? AND classCode = ? AND journeyDate = ? AND seatNumber IN (1, 2)`,
      [trainId, classCode, journeyDate]
    );
    await seatRepository.syncAvailabilityAfterSeatChange(query, trainId, classCode, journeyDate);
  });

  const updated = await runQuery(
    'SELECT availableSeats FROM TrainClasses WHERE trainId = ? AND classCode = ?',
    [trainId, classCode]
  );

  assert.equal(updated[0].availableSeats, capacity - 2);

  const liveMap = await seatRepository.getAvailableCountsForTrains([trainId], journeyDate);
  assert.equal(liveMap[trainId][classCode], capacity - 2);

  await runQuery('DELETE FROM Seats WHERE trainId = ? AND classCode = ? AND journeyDate = ?', [trainId, classCode, journeyDate]);
});
