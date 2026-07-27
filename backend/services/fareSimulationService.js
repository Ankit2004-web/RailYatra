/**
 * Fare estimation using IRCA table + MoR Commercial Circular No. 11 of 2025 (w.e.f. 01.07.2025).
 * Segment-specific authorized fares in TrainSegmentFares take precedence when present.
 */
const { getPool } = require('../../database/connection');
const {
    calculateClassFare,
    calculateBasicFare,
    getDefaultRatePerKm,
    OFFICIAL_FARE_REFERENCE,
    RESERVATION_CHARGE,
    SUPERFAST_SURCHARGE,
    isSuperfastTrain
} = require('../utils/irctcFareTable2025');

async function getFareRule(travelClassCode, trainTypeCode) {
    const pool = await getPool();
    const result = await pool.request()
        .input('classCode', 'NVarChar', travelClassCode)
        .input('typeCode', 'NVarChar', trainTypeCode || null)
        .query(`
            SELECT TOP 1 fr.*
            FROM FareRules fr
            INNER JOIN TravelClasses tc ON tc.id = fr.travelClassId
            LEFT JOIN TrainTypes tt ON tt.id = fr.trainTypeId
            WHERE tc.code = @classCode
              AND (fr.trainTypeId IS NULL OR tt.code = @typeCode)
              AND fr.effectiveFrom <= CAST(SYSUTCDATETIME() AS DATE)
              AND (fr.effectiveTo IS NULL OR fr.effectiveTo >= CAST(SYSUTCDATETIME() AS DATE))
            ORDER BY CASE WHEN fr.trainTypeId IS NULL THEN 1 ELSE 0 END
        `);
    return result.recordset[0] || null;
}

async function getExactSegmentFare({ trainId, fromStationId, toStationId, travelClassCode, quotaCode }) {
    const pool = await getPool();
    const result = await pool.request()
        .input('trainId', 'Int', trainId)
        .input('fromId', 'Int', fromStationId)
        .input('toId', 'Int', toStationId)
        .input('classCode', 'NVarChar', travelClassCode)
        .input('quotaCode', 'NVarChar', quotaCode || 'GN')
        .query(`
            SELECT TOP 1 tsf.fare
            FROM TrainSegmentFares tsf
            INNER JOIN TravelClasses tc ON tc.id = tsf.travelClassId
            LEFT JOIN Quotas q ON q.id = tsf.quotaId
            WHERE tsf.trainId = @trainId
              AND tsf.fromStationId = @fromId
              AND tsf.toStationId = @toId
              AND tc.code = @classCode
              AND (tsf.quotaId IS NULL OR q.code = @quotaCode)
              AND tsf.effectiveFrom <= CAST(SYSUTCDATETIME() AS DATE)
              AND (tsf.effectiveTo IS NULL OR tsf.effectiveTo >= CAST(SYSUTCDATETIME() AS DATE))
        `);
    return result.recordset[0]?.fare ?? null;
}

async function calculateEstimatedFare({
    trainId,
    trainTypeCode,
    trainName,
    distanceKm,
    travelClassCode,
    quotaCode,
    passengerCount = 1,
    fromStationId,
    toStationId,
    journeyDate
}) {
    if (fromStationId && toStationId) {
        const exact = await getExactSegmentFare({
            trainId, fromStationId, toStationId, travelClassCode, quotaCode
        });
        if (exact != null) {
            return buildFareBreakdown(exact, passengerCount, travelClassCode, quotaCode, 'exact_authorized_dataset');
        }
    }

    const perPassenger = calculateClassFare({
        distanceKm,
        classCode: travelClassCode,
        trainTypeCode,
        trainName,
        journeyDate,
        quotaCode
    });

    const basic = calculateBasicFare({
        distanceKm,
        classCode: travelClassCode,
        trainTypeCode,
        trainName,
        journeyDate
    });

    const reservation = (RESERVATION_CHARGE[travelClassCode] ?? 30) * passengerCount;
    const superfast = isSuperfastTrain(trainTypeCode, trainName)
        ? (SUPERFAST_SURCHARGE[travelClassCode] ?? 20) * passengerCount
        : 0;

    return buildFareBreakdown(perPassenger * passengerCount, passengerCount, travelClassCode, quotaCode, 'cc11_2025_simulation', {
        baseFare: basic * passengerCount,
        reservationCharge: reservation,
        superfastCharge: superfast,
        distanceKm,
        fareReference: OFFICIAL_FARE_REFERENCE
    });
}

function buildFareBreakdown(total, passengerCount, classCode, quotaCode, source, extra = {}) {
    return {
        totalFare: total,
        passengerCount,
        classCode,
        quotaCode: quotaCode || 'GN',
        fareSource: source,
        isSimulated: source === 'cc11_2025_simulation',
        ...extra
    };
}

async function seedDefaultFareRulesIfEmpty() {
    const pool = await getPool();
    const count = await pool.request().query('SELECT COUNT(*) AS c FROM FareRules');
    if (count.recordset[0].c > 0) return;

    const classes = await pool.request().query('SELECT id, code FROM TravelClasses');
    for (const cls of classes.recordset) {
        const rate = getDefaultRatePerKm(cls.code, 'EXP', '', '2025-07-01');
        await pool.request()
            .input('tcId', 'Int', cls.id)
            .input('rate', 'Decimal', rate)
            .input('min', 'Decimal', cls.code === '2S' ? 10 : 100)
            .query(`INSERT INTO FareRules (travelClassId, baseRatePerKm, minimumFare, reservationCharge, superfastCharge, effectiveFrom)
                    VALUES (@tcId, @rate, @min, 40, 20, '2025-07-01')`);
    }
}

module.exports = {
    calculateEstimatedFare,
    getExactSegmentFare,
    seedDefaultFareRulesIfEmpty
};
