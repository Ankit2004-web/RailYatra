const { getPool } = require('../../database/connection');

const findByTrainId = async (trainId) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('trainId', 'Int', trainId)
        .query(`SELECT * FROM TrainStops WHERE trainId = @trainId ORDER BY stopOrder ASC`);
    return result.recordset;
};

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

module.exports = { findByTrainId, getSegmentMetrics, createMany, replaceForTrain };
