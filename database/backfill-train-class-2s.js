/**
 * Adds 2S (Second Sitting) to trains that should carry it per IR practice
 * but were imported without 2S from DataMeet (sleeper flag only).
 */
const { getPool, closePool } = require('./connection');
const { inferTrainCategory } = require('../backend/utils/coachCapacity');
const coachCapacityRulesService = require('../backend/services/coachCapacityRulesService');
const { buildRakeFromTrainClasses, getClassTotalFromRake } = require('../backend/services/rakeCompositionService');

const PREMIUM_CATEGORIES = new Set(['rajdhani', 'duronto', 'vandeBharat', 'garibRath', 'anubhuthi']);

function shouldAdd2S(trainName, trainTypeCode, classCodes) {
    if (classCodes.includes('2S')) return false;
    const category = inferTrainCategory(trainName, trainTypeCode);
    if (PREMIUM_CATEGORIES.has(category)) return false;
    if (classCodes.includes('SL')) return true;
    if (classCodes.some((c) => ['CC', 'EC', 'EA'].includes(c))) return true;
    if (category === 'passenger' || category === 'superfast' || category === 'express' || category === 'shatabdi') return true;
    return false;
}

async function backfillTrainClass2S() {
    await coachCapacityRulesService.loadRulesCache();

    const pool = await getPool();
    console.log('Adding 2S class to eligible trains (IR Second Sitting coaches)...');

    const trains = await pool.request().query(`
        SELECT t.id, t.trainName, tt.code AS trainTypeCode
        FROM Trains t
        LEFT JOIN TrainTypes tt ON tt.id = t.trainTypeId
    `);

    const classes = await pool.request().query(`
        SELECT trainId, classCode, className, price
        FROM TrainClasses
    `);

    const byTrain = new Map();
    for (const row of classes.recordset) {
        if (!byTrain.has(row.trainId)) byTrain.set(row.trainId, []);
        byTrain.get(row.trainId).push(row);
    }

    const travelClasses = await pool.request().query('SELECT id, code FROM TravelClasses');
    const tcMap = new Map(travelClasses.recordset.map((r) => [r.code, r.id]));

    let inserted = 0;
    let updated = 0;

    for (const train of trains.recordset) {
        const trainClasses = byTrain.get(train.id) || [];
        const classCodes = trainClasses.map((c) => c.classCode);

        if (!shouldAdd2S(train.trainName, train.trainTypeCode, classCodes)) continue;

        const rake = buildRakeFromTrainClasses(
            { trainName: train.trainName, trainTypeCode: train.trainTypeCode },
            [...trainClasses, { classCode: '2S', className: 'Second Sitting' }]
        );
        const capacity = getClassTotalFromRake(rake.coaches, '2S');
        if (!capacity) continue;

        const slRow = trainClasses.find((c) => c.classCode === 'SL');
        const basePrice = slRow?.price || trainClasses[0]?.price || 500;
        const price2S = Math.max(50, Math.round(Number(basePrice) * 0.6));

        const existing = trainClasses.find((c) => c.classCode === '2S');
        if (existing) {
            await pool.request()
                .input('id', 'Int', existing.id)
                .input('totalSeats', 'Int', capacity)
                .input('availableSeats', 'Int', capacity)
                .input('travelClassId', 'Int', tcMap.get('2S') || null)
                .query(`UPDATE TrainClasses
                        SET totalSeats = @totalSeats,
                            availableSeats = @availableSeats,
                            travelClassId = @travelClassId,
                            isAvailable = 1,
                            updatedAt = SYSUTCDATETIME()
                        WHERE id = @id`);
            updated += 1;
        } else {
            await pool.request()
                .input('trainId', 'Int', train.id)
                .input('classCode', 'NVarChar', '2S')
                .input('className', 'NVarChar', 'Second Sitting')
                .input('price', 'Decimal', price2S)
                .input('totalSeats', 'Int', capacity)
                .input('availableSeats', 'Int', capacity)
                .input('travelClassId', 'Int', tcMap.get('2S') || null)
                .query(`INSERT INTO TrainClasses (trainId, classCode, className, price, totalSeats, availableSeats, travelClassId, isAvailable)
                        VALUES (@trainId, @classCode, @className, @price, @totalSeats, @availableSeats, @travelClassId, 1)`);
            inserted += 1;
        }
    }

    if (inserted || updated) {
        const trains = await pool.request().query('SELECT id FROM Trains');
        for (const train of trains.recordset) {
            const cap = await pool.request()
                .input('trainId', 'Int', train.id)
                .query('SELECT COALESCE(SUM(totalSeats), 0) AS totalCap FROM TrainClasses WHERE trainId = @trainId');
            const totalCap = cap.recordset[0]?.totalCap || 0;
            await pool.request()
                .input('trainId', 'Int', train.id)
                .input('totalCap', 'Int', totalCap)
                .query('UPDATE Trains SET availableSeats = @totalCap, updatedAt = SYSUTCDATETIME() WHERE id = @trainId');
        }
    }

    console.log(`2S backfill complete: ${inserted} inserted, ${updated} updated.`);
    await closePool();
}

if (require.main === module) {
    backfillTrainClass2S().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { backfillTrainClass2S, shouldAdd2S };
