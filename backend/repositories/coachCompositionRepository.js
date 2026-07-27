const { getPool } = require('../../database/connection');

async function findCapacityRule(coachTypeId, coachModelId) {
    const pool = await getPool();
    const result = await pool.request()
        .input('tid', 'Int', coachTypeId)
        .input('mid', 'Int', coachModelId)
        .query(`SELECT TOP 1 * FROM CoachCapacityRules
                WHERE coachTypeId = @tid AND coachModelId = @mid
                  AND (effectiveTo IS NULL OR effectiveTo >= CAST(GETUTCDATE() AS DATE))
                ORDER BY effectiveFrom DESC`);
    return result.recordset[0] || null;
}

async function getActiveCompositionVersion(trainNumber) {
    const pool = await getPool();
    const result = await pool.request()
        .input('tn', 'NVarChar', trainNumber)
        .query(`SELECT TOP 1 * FROM CompositionVersion
                WHERE trainNumber = @tn AND isActive = 1
                ORDER BY importedAt DESC`);
    return result.recordset[0] || null;
}

async function getCoachesByTrainNumber(trainNumber, versionId = null) {
    const pool = await getPool();
    let version = versionId;
    if (!version) {
        const v = await getActiveCompositionVersion(trainNumber);
        version = v?.id || null;
    }
    if (!version) return { version: null, coaches: [] };

    const result = await pool.request()
        .input('vid', 'Int', version)
        .query(`SELECT tcc.*,
                       ct.code AS coachTypeCode, ct.name AS coachTypeName,
                       ct.isAcCoach, ct.isSleeperCoach, ct.isChairCoach, ct.isReservedCoach,
                       cm.code AS coachModelCode, cm.name AS coachModelName,
                       ccr.coupeCount, ccr.cabinCount, ccr.sourceReference AS capacitySource
                FROM TrainCoachComposition tcc
                INNER JOIN CoachTypes ct ON ct.id = tcc.coachTypeId
                LEFT JOIN CoachModels cm ON cm.id = tcc.coachModelId
                LEFT JOIN CoachCapacityRules ccr ON ccr.id = tcc.capacityRuleId
                WHERE tcc.compositionVersionId = @vid
                ORDER BY tcc.coachPosition ASC`);
    return { version, coaches: result.recordset };
}

async function getTrainCapacity(trainNumber, versionId = null) {
    const pool = await getPool();
    let version = versionId;
    if (!version) {
        const v = await getActiveCompositionVersion(trainNumber);
        version = v?.id || null;
    }
    if (!version) {
        return {
            trainNumber,
            capacityStatus: 'Unknown',
            message: 'Official coach composition not imported for this train'
        };
    }

    const result = await pool.request()
        .input('tn', 'NVarChar', trainNumber)
        .input('vid', 'Int', version)
        .query(`SELECT TOP 1 * FROM TrainCapacity WHERE trainNumber = @tn AND compositionVersionId = @vid`);
    return result.recordset[0] || null;
}

async function getTrainTypeCode(trainTypeId) {
    const pool = await getPool();
    const result = await pool.request()
        .input('id', 'Int', trainTypeId)
        .query('SELECT code FROM TrainTypes WHERE id = @id');
    return result.recordset[0]?.code || null;
}

async function getCoachLayout(coachTypeCode, coachModelCode) {
    const pool = await getPool();
    const result = await pool.request()
        .input('tc', 'NVarChar', coachTypeCode)
        .input('mc', 'NVarChar', coachModelCode)
        .query(`SELECT cl.*, ct.code AS coachTypeCode, cm.code AS coachModelCode
                FROM CoachLayouts cl
                INNER JOIN CoachTypes ct ON ct.id = cl.coachTypeId
                INNER JOIN CoachModels cm ON cm.id = cl.coachModelId
                WHERE ct.code = @tc AND cm.code = @mc`);
    return result.recordset[0] || null;
}

async function getAllCapacityRules() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT ccr.id,
               ccr.seatingCapacity,
               ccr.sleepingBerths,
               ccr.totalBerths,
               ccr.coupeCount,
               ccr.cabinCount,
               ccr.sourceReference,
               ct.code AS coachTypeCode,
               ct.travelClassId,
               tc.code AS travelClassCode,
               cm.code AS coachModelCode
        FROM CoachCapacityRules ccr
        INNER JOIN CoachTypes ct ON ct.id = ccr.coachTypeId
        INNER JOIN CoachModels cm ON cm.id = ccr.coachModelId
        LEFT JOIN TravelClasses tc ON tc.id = ct.travelClassId
        WHERE ccr.effectiveTo IS NULL OR ccr.effectiveTo >= CAST(GETUTCDATE() AS DATE)
        ORDER BY ccr.effectiveFrom DESC
    `);
    return result.recordset;
}

async function getLayoutsForTrain(trainNumber) {
    const { coaches } = await getCoachesByTrainNumber(trainNumber);
    const layouts = [];
    for (const c of coaches) {
        if (!c.coachTypeCode || !c.coachModelCode) continue;
        const layout = await getCoachLayout(c.coachTypeCode, c.coachModelCode);
        if (layout) {
            layouts.push({
                coachNumber: c.coachNumber,
                coachTypeCode: c.coachTypeCode,
                coachModelCode: c.coachModelCode,
                layout
            });
        }
    }
    return layouts;
}

module.exports = {
    findCapacityRule,
    getActiveCompositionVersion,
    getCoachesByTrainNumber,
    getTrainCapacity,
    getCoachLayout,
    getLayoutsForTrain,
    getTrainTypeCode,
    getAllCapacityRules
};
