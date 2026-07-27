const { getPool, closePool } = require('./connection');
const { buildRakeFromTrainClasses, getClassTotalFromRake } = require('../backend/services/rakeCompositionService');
const coachCapacityRulesService = require('../backend/services/coachCapacityRulesService');

async function backfillCoachCapacity() {
    await coachCapacityRulesService.loadRulesCache();
    const pool = await getPool();
    console.log('Updating TrainClasses with full rake capacity (all coaches × berths per coach)...');

    const trains = await pool.request().query(`
        SELECT t.id, t.trainName, tt.code AS trainTypeCode
        FROM Trains t
        LEFT JOIN TrainTypes tt ON tt.id = t.trainTypeId
    `);

    const classes = await pool.request().query(`
        SELECT id, trainId, classCode, className
        FROM TrainClasses
        ORDER BY trainId, classCode
    `);

    const classesByTrain = new Map();
    for (const row of classes.recordset) {
        if (!classesByTrain.has(row.trainId)) classesByTrain.set(row.trainId, []);
        classesByTrain.get(row.trainId).push(row);
    }

    let updated = 0;
    for (const train of trains.recordset) {
        const trainClasses = classesByTrain.get(train.id) || [];
        if (!trainClasses.length) continue;

        const rake = buildRakeFromTrainClasses(
            { trainName: train.trainName, trainTypeCode: train.trainTypeCode },
            trainClasses
        );

        for (const cls of trainClasses) {
            const capacity = getClassTotalFromRake(rake.coaches, cls.classCode);
            if (!capacity) continue;

            await pool.request()
                .input('id', 'Int', cls.id)
                .input('totalSeats', 'Int', capacity)
                .input('availableSeats', 'Int', capacity)
                .query(`UPDATE TrainClasses
                        SET totalSeats = @totalSeats,
                            availableSeats = @availableSeats,
                            updatedAt = SYSUTCDATETIME()
                        WHERE id = @id`);
            updated += 1;
        }
    }

    await pool.request().query(`
        UPDATE t
        SET t.availableSeats = x.totalCap,
            t.updatedAt = SYSUTCDATETIME()
        FROM Trains t
        INNER JOIN (
            SELECT trainId, SUM(totalSeats) AS totalCap
            FROM TrainClasses
            GROUP BY trainId
        ) x ON x.trainId = t.id
    `);

    console.log(`Updated ${updated} train class rows with full-rake totals.`);
    await closePool();
}

if (require.main === module) {
    backfillCoachCapacity().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { backfillCoachCapacity };
