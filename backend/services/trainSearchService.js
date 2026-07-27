/**
 * Train-between-stations search using TrainStops graph (Category A master data).
 * Falls back to legacy text search when normalized stops are unavailable.
 */
const { getPool } = require('../../database/connection');
const trainClassRepository = require('../repositories/trainClassRepository');
const runningDayService = require('./runningDayService');
const { computeAvgSpeedKmh } = require('../utils/trainSpeed');
const { applyFaresToClasses, calculateClassFare } = require('../utils/irctcFareTable2025');
const { enrichClassesFromTrainMeta } = require('./coachCompositionService');

const normalizeStationQuery = (q) => String(q || '').trim();

async function resolveStation(query) {
    const pool = await getPool();
    const term = normalizeStationQuery(query);
    if (!term) return null;

    const upper = term.toUpperCase();
    const like = `%${term}%`;

    const exactCode = await pool.request()
        .input('code', 'NVarChar', upper)
        .query(`SELECT TOP 1 * FROM Stations WHERE UPPER(code) = @code AND isActive = 1`);

    if (exactCode.recordset[0]) return exactCode.recordset[0];

    const result = await pool.request()
        .input('like1', 'NVarChar', like)
        .input('like2', 'NVarChar', like)
        .input('like3', 'NVarChar', like)
        .query(`SELECT TOP 1 * FROM Stations
                WHERE isActive = 1 AND (name LIKE @like1 OR city LIKE @like2 OR normalizedName LIKE @like3)
                ORDER BY CASE WHEN name LIKE @like1 THEN 0 ELSE 1 END, name ASC`);

    return result.recordset[0] || null;
}

async function hasNormalizedStops() {
    const pool = await getPool();
    const result = await pool.request().query(
        'SELECT TOP 1 1 AS ok FROM TrainStops WHERE stationId IS NOT NULL'
    );
    return result.recordset.length > 0;
}

async function searchViaStops({ fromStationId, toStationId, date, classCode }) {
    const pool = await getPool();
    const request = pool.request()
        .input('fromId', 'Int', fromStationId)
        .input('toId', 'Int', toStationId);

    let classFilter = '';
    if (classCode) {
        request.input('classCode', 'NVarChar', classCode);
        classFilter = `AND EXISTS (
            SELECT 1 FROM TrainClasses tc
            WHERE tc.trainId = t.id AND tc.classCode = @classCode AND tc.isAvailable = 1
        )`;
    }

    const result = await request.query(`
        SELECT
            t.id AS trainId,
            t.trainNumber,
            t.trainName,
            t.runningDays,
            t.runningStatus,
            t.journeyDate,
            t.price,
            t.distance AS trainDistance,
            tt.code AS trainTypeCode,
            tt.name AS trainTypeName,
            fs.stopOrder AS fromStopSequence,
            fs.departureTime AS fromDepartureTime,
            fs.departureDayOffset AS fromDepartureDayOffset,
            fs.distanceKm AS fromDistanceKm,
            fs.stationId AS fromStationId,
            sFrom.code AS fromStationCode,
            sFrom.name AS fromStationName,
            ts.stopOrder AS toStopSequence,
            ts.arrivalTime AS toArrivalTime,
            ts.arrivalDayOffset AS toArrivalDayOffset,
            ts.distanceKm AS toDistanceKm,
            ts.stationId AS toStationId,
            sTo.code AS toStationCode,
            sTo.name AS toStationName
        FROM Trains t
        INNER JOIN TrainStops fs ON fs.trainId = t.id AND fs.stationId = @fromId
        INNER JOIN TrainStops ts ON ts.trainId = t.id AND ts.stationId = @toId
        INNER JOIN Stations sFrom ON sFrom.id = fs.stationId
        INNER JOIN Stations sTo ON sTo.id = ts.stationId
        LEFT JOIN TrainTypes tt ON tt.id = t.trainTypeId
        WHERE fs.stopOrder < ts.stopOrder
          AND t.isActive = 1
          AND t.runningStatus = 'Running'
          ${classFilter}
        ORDER BY fs.departureTime ASC
    `);

    const trainIds = [...new Set(result.recordset.map((r) => r.trainId))];
    const runningDaysMap = await loadRunningDaysMap(trainIds);
    const classesMap = await trainClassRepository.findByTrainIds(trainIds);

    const rows = [];
    for (const row of result.recordset) {
        const runningDayList = runningDayService.resolveRunningDayList(
            row.runningDays,
            runningDaysMap[row.trainId]
        );

        if (date && !runningDayService.trainRunsOnBoardingDate(date, row.fromDepartureDayOffset, runningDayList)) {
            continue;
        }

        const fromStop = {
            departureTime: row.fromDepartureTime,
            departureDayOffset: row.fromDepartureDayOffset
        };
        const toStop = {
            arrivalTime: row.toArrivalTime,
            arrivalDayOffset: row.toArrivalDayOffset,
            departureDayOffset: row.toArrivalDayOffset
        };
        const durationMinutes = runningDayService.calculateDurationMinutes(fromStop, toStop);
        const distanceKm = Math.max(0, (row.toDistanceKm || 0) - (row.fromDistanceKm || 0));

        rows.push(formatSearchResult(row, runningDayList, classesMap[row.trainId] || [], durationMinutes, distanceKm, date));
    }

    return rows;
}

async function loadRunningDaysMap(trainIds) {
    if (!trainIds.length) return {};
    const pool = await getPool();
    const placeholders = trainIds.map((_, i) => `@tid${i}`).join(',');
    const request = pool.request();
    trainIds.forEach((id, i) => request.input(`tid${i}`, 'Int', id));

    const result = await request.query(`
        SELECT trainId, dayOfWeek, runs FROM TrainRunningDays
        WHERE trainId IN (${placeholders}) AND runs = 1
        ORDER BY trainId, dayOfWeek
    `);

    const map = {};
    for (const row of result.recordset) {
        if (!map[row.trainId]) map[row.trainId] = [];
        map[row.trainId].push(row.dayOfWeek);
    }
    return map;
}

function formatSearchResult(row, runningDayList, classes, durationMinutes, distanceKm, date) {
    const journeyDate = date || row.journeyDate;
    const segmentKm = distanceKm || row.trainDistance || 0;
    const fareContext = {
        distanceKm: segmentKm,
        trainTypeCode: row.trainTypeCode,
        trainName: row.trainName,
        journeyDate
    };
    const pricedClasses = applyFaresToClasses(classes, fareContext);
    const enrichedClasses = enrichClassesFromTrainMeta(
        pricedClasses,
        row.trainName,
        row.trainTypeCode,
        { includeSeats: false }
    );
    const lowestPrice = enrichedClasses.length
        ? Math.min(...enrichedClasses.map((c) => c.price))
        : calculateClassFare({ ...fareContext, classCode: 'SL' });

    return {
        id: row.trainId,
        trainId: row.trainId,
        trainNumber: row.trainNumber,
        trainName: row.trainName,
        trainType: row.trainTypeName || null,
        trainTypeCode: row.trainTypeCode || null,
        source: row.fromStationName,
        destination: row.toStationName,
        departureTime: row.fromDepartureTime,
        arrivalTime: row.toArrivalTime,
        duration: runningDayService.formatDuration(durationMinutes),
        durationMinutes,
        distance: segmentKm,
        avgSpeedKmh: computeAvgSpeedKmh(
            segmentKm,
            durationMinutes,
            row.trainTypeCode,
            row.trainName
        ),
        date: journeyDate,
        runningDays: runningDayService.runningDaysLabel(runningDayList),
        runningDaysList: runningDayList,
        runningStatus: row.runningStatus,
        price: lowestPrice,
        classes: enrichedClasses,
        lowestPrice,
        fareReference: 'MoR Commercial Circular No. 11 of 2025 (w.e.f. 01.07.2025)',
        from: {
            stationCode: row.fromStationCode,
            stationName: row.fromStationName,
            departureTime: row.fromDepartureTime,
            dayOffset: row.fromDepartureDayOffset || 0
        },
        to: {
            stationCode: row.toStationCode,
            stationName: row.toStationName,
            arrivalTime: row.toArrivalTime,
            dayOffset: row.toArrivalDayOffset || 0
        }
    };
}

async function legacySearch({ source, destination, date }) {
    const pool = await getPool();
    const request = pool.request();
    let query = 'SELECT * FROM Trains WHERE isActive = 1';

    if (source) {
        query += ' AND source LIKE @source';
        request.input('source', 'NVarChar', `%${source}%`);
    }
    if (destination) {
        query += ' AND destination LIKE @destination';
        request.input('destination', 'NVarChar', `%${destination}%`);
    }
    if (date) {
        query += ' AND journeyDate = @date';
        request.input('date', 'Date', date);
    }
    query += " AND runningStatus = 'Running' ORDER BY departureTime ASC";

    const result = await request.query(query);
    const trainIds = result.recordset.map((t) => t.id);
    const classesMap = await trainClassRepository.findByTrainIds(trainIds);

    return result.recordset.map((train) => {
        const runningDayList = runningDayService.resolveRunningDayList(train.runningDays);
        return {
            ...train,
            id: train.id,
            date: date || train.journeyDate,
            price: Number(train.price),
            runningDays: runningDayService.runningDaysLabel(runningDayList),
            runningDaysList: runningDayList,
            classes: classesMap[train.id] || [],
            lowestPrice: classesMap[train.id]?.length
                ? Math.min(...classesMap[train.id].map((c) => c.price))
                : Number(train.price)
        };
    });
}

async function search({ source, destination, date, classCode, from, to }) {
    const fromQuery = from || source;
    const toQuery = to || destination;

    if (fromQuery && toQuery && String(fromQuery).trim().toLowerCase() === String(toQuery).trim().toLowerCase()) {
        return [];
    }

    if (await hasNormalizedStops()) {
        const fromStation = await resolveStation(fromQuery);
        const toStation = await resolveStation(toQuery);
        if (fromStation && toStation) {
            return searchViaStops({
                fromStationId: fromStation.id,
                toStationId: toStation.id,
                date,
                classCode
            });
        }
    }

    return legacySearch({ source: fromQuery, destination: toQuery, date });
}

async function autocompleteTrains(query, limit = 10) {
    const pool = await getPool();
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 20);
    const term = String(query || '').trim();
    if (!term) return [];

    const result = await pool.request()
        .input('q1', 'NVarChar', `${term}%`)
        .input('q2', 'NVarChar', `%${term}%`)
        .query(`
            SELECT TOP (${safeLimit})
                t.id, t.trainNumber, t.trainName, t.source, t.destination,
                ss.code AS sourceCode, ds.code AS destCode
            FROM Trains t
            LEFT JOIN Stations ss ON ss.id = t.sourceStationId
            LEFT JOIN Stations ds ON ds.id = t.destinationStationId
            WHERE t.isActive = 1
              AND (t.trainNumber LIKE @q1 OR t.trainName LIKE @q2 OR t.normalizedName LIKE @q2)
            ORDER BY CASE WHEN t.trainNumber LIKE @q1 THEN 0 ELSE 1 END, t.trainNumber ASC
        `);
    return result.recordset;
}

module.exports = {
    search,
    resolveStation,
    autocompleteTrains,
    hasNormalizedStops,
    searchViaStops
};
