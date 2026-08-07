const { getPool } = require('../../database/connection');

/** Train stops joined to active Stations — app catalog stations only. */
const findAppStopsByTrainId = async (trainId) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('trainId', 'Int', trainId)
        .query(`
            SELECT
                ts.stopOrder,
                ts.arrivalTime,
                ts.departureTime,
                ts.arrivalDayOffset,
                ts.departureDayOffset,
                ts.haltMinutes,
                ts.distanceKm,
                ts.platformHint,
                ts.isTechnicalStop,
                s.id AS stationId,
                s.code AS stationCode,
                s.name AS stationName,
                s.city AS stationCity
            FROM TrainStops ts
            INNER JOIN Stations s ON s.isActive = 1
                AND (
                    (ts.stationId IS NOT NULL AND ts.stationId = s.id)
                    OR (
                        ts.stationId IS NULL
                        AND ts.stationCode IS NOT NULL
                        AND UPPER(TRIM(ts.stationCode)) = UPPER(TRIM(s.code))
                    )
                )
            WHERE ts.trainId = @trainId
            ORDER BY ts.stopOrder ASC
        `);
    return result.recordset;
};

const findByTrainId = async (trainId) => findAppStopsByTrainId(trainId);

const getSegmentMetrics = async (trainId, fromStationId, toStationId) => {
    if (!trainId || !fromStationId || !toStationId) return null;
    const pool = await getPool();
    const result = await pool.request()
        .input('trainId', 'Int', trainId)
        .input('fromId', 'Int', fromStationId)
        .input('toId', 'Int', toStationId)
        .query(`
            SELECT
                f.distanceKm AS fromKm,
                t.distanceKm AS toKm,
                f.departureDayOffset AS fromDepartureDayOffset
            FROM TrainStops f
            INNER JOIN TrainStops t ON t.trainId = f.trainId
            WHERE f.trainId = @trainId
              AND f.stationId = @fromId
              AND t.stationId = @toId
        `);
    const row = result.recordset[0];
    if (!row || row.fromKm == null || row.toKm == null) return null;
    return {
        distanceKm: Math.max(0, Number(row.toKm) - Number(row.fromKm)),
        fromDepartureDayOffset: Number(row.fromDepartureDayOffset) || 0
    };
};

const createMany = async (trainId, stops) => {
    const pool = await getPool();

    for (const stop of stops) {
        await pool.request()
            .input('trainId', 'Int', trainId)
            .input('stationCode', 'NVarChar', stop.stationCode || null)
            .input('stationName', 'NVarChar', stop.stationName)
            .input('stopOrder', 'Int', stop.stopOrder)
            .input('arrivalTime', 'NVarChar', stop.arrivalTime || null)
            .input('departureTime', 'NVarChar', stop.departureTime || null)
            .input('haltMinutes', 'Int', stop.haltMinutes || 0)
            .input('distanceKm', 'Int', stop.distanceKm || null)
            .query(`INSERT INTO TrainStops (trainId, stationCode, stationName, stopOrder, arrivalTime, departureTime, haltMinutes, distanceKm)
                    VALUES (@trainId, @stationCode, @stationName, @stopOrder, @arrivalTime, @departureTime, @haltMinutes, @distanceKm)`);
    }
};

const replaceForTrain = async (trainId, stops) => {
    const pool = await getPool();
    await pool.request()
        .input('trainId', 'Int', trainId)
        .query('DELETE FROM TrainStops WHERE trainId = @trainId');

    if (stops?.length) {
        await createMany(trainId, stops);
    }
};

module.exports = { findByTrainId, findAppStopsByTrainId, getSegmentMetrics, createMany, replaceForTrain };
