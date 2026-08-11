process.env.DB_DRIVER = 'sqlite';
process.env.SQLITE_PATH = process.env.SQLITE_PATH || require('path').join(__dirname, '../backend/data/railyatra-master.db');

const { runQuery, closePool } = require('../database/connection');

(async () => {
  const rows = await runQuery(`
    SELECT t.trainNumber, t.trainName, t.source, t.destination, t.runningDays,
           COUNT(trd.id) AS dayCount,
           GROUP_CONCAT(trd.dayOfWeek) AS days
    FROM Trains t
    LEFT JOIN TrainRunningDays trd ON trd.trainId = t.id AND trd.runs = 1
    WHERE t.isActive = 1
    GROUP BY t.id
    HAVING dayCount > 0 AND dayCount < 7
    ORDER BY dayCount, t.trainNumber
    LIMIT 20
  `);
  console.log('Partial TrainRunningDays (<7 days):');
  console.log(JSON.stringify(rows, null, 2));

  const partial = await runQuery(`
    SELECT runningDays, COUNT(*) AS c
    FROM Trains
    WHERE isActive = 1
      AND runningDays NOT IN ('Daily', 'Not in source dataset')
      AND runningDays IS NOT NULL
      AND TRIM(runningDays) != ''
    GROUP BY runningDays
    ORDER BY c DESC
    LIMIT 15
  `);
  console.log('\nDistinct runningDays labels:');
  console.log(JSON.stringify(partial, null, 2));
  await closePool();
  process.exit(0);
})().catch(async (e) => {
  console.error(e.message);
  try { await closePool(); } catch (_) {}
  process.exit(1);
});
