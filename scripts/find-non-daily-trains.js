const { getPool } = require('../database/connection');

(async () => {
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT TOP 15
      t.trainNumber,
      t.trainName,
      t.source,
      t.destination,
      t.runningDays,
      (SELECT COUNT(*) FROM TrainRunningDays trd WHERE trd.trainId = t.id AND trd.runs = 1) AS dayCount
    FROM Trains t
    WHERE t.isActive = 1
      AND t.runningDays NOT LIKE 'Daily'
      AND t.runningDays NOT LIKE 'Not in source%'
    ORDER BY t.trainNumber
  `);
  console.log(JSON.stringify(r.recordset, null, 2));
  process.exit(0);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
