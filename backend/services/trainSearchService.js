/**
 * Train-between-stations search using TrainStops graph (Category A master data).
 * Falls back to legacy text search when normalized stops are unavailable.
 */
const { getPool } = require('../../database/connection');
const trainClassRepository = require('../repositories/trainClassRepository');
const runningDayService = require('./runningDayService');
const { computeAvgSpeedKmh } = require('../utils/trainSpeed');
const { applyFaresToClasses, calculateClassFare } = require('../utils/irctcFareTable2025');
const searchCacheRepository = require('../repositories/searchCacheRepository');
const { enrichClassesFromTrainMeta } = require('./coachCompositionService');

const normalizeStationQuery = (q) => String(q || '').trim();

/** Prefer passenger junction codes over goods/halt yards for common search terms. */
const STATION_CODE_ALIASES = {
    howrah: 'HWH',
    'howrah junction': 'HWH',
    'howrah jn': 'HWH',
    bhubaneswar: 'BBS',
    'bhubaneswar new': 'BBS',
    kolkata: 'KOAA',
    chennai: 'MAS',
    mumbai: 'CSTM',
    delhi: 'NDLS',
    'new delhi': 'NDLS',
    bangalore: 'SBC',
    hyderabad: 'HYB',
    secunderabad: 'SC'
};

function normalizeTimeValue(value) {
    if (value == null || value === '') return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const h = String(value.getHours()).padStart(2, '0');
        const m = String(value.getMinutes()).padStart(2, '0');
        return `${h}:${m}`;
    }
    const str = String(value).trim();
    if (!str) return null;
    const match = str.match(/(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return `${String(match[1]).padStart(2, '0')}:${match[2]}`;
}

function resolveSegmentDepartureTime(row) {
    return normalizeTimeValue(row.fromDepartureTime)
        || normalizeTimeValue(row.fromDeparture)
        || normalizeTimeValue(row.fromArrivalTime)
        || normalizeTimeValue(row.fromArrival)
        || normalizeTimeValue(row.fromDepartureFallback)
        || (row.fromStopSequence === row.minStopOrder ? normalizeTimeValue(row.trainDepartureTime) : null);
}

function resolveSegmentArrivalTime(row) {
    return normalizeTimeValue(row.toArrivalTime)
        || normalizeTimeValue(row.toArrival)
        || normalizeTimeValue(row.toDepartureTime)
        || normalizeTimeValue(row.toDeparture)
        || normalizeTimeValue(row.toArrivalFallback)
        || (row.toStopSequence === row.maxStopOrder ? normalizeTimeValue(row.trainArrivalTime) : null);
}

function stationMeta(station, fallbackName) {
    if (!station) return fallbackName ? { code: '', name: fallbackName } : null;
    return {
        id: station.id,
        code: station.code || '',
        name: station.name || fallbackName || station.code || ''
    };
}

async function batchLoadSegmentTimes(trainIds, fromStationId, toStationId) {
    if (!trainIds.length || !fromStationId || !toStationId) return {};
    const pool = await getPool();
    const placeholders = trainIds.map((_, i) => `@tid${i}`).join(',');
    const request = pool.request()
        .input('fromId', 'Int', fromStationId)
        .input('toId', 'Int', toStationId);
    trainIds.forEach((id, i) => request.input(`tid${i}`, 'Int', id));

    const result = await request.query(`
        SELECT
            t.id AS trainId,
            t.departureTime AS trainDepartureTime,
            t.arrivalTime AS trainArrivalTime,
            fs.stopOrder AS fromStopSequence,
            fs.departureTime AS fromDepartureTime,
            fs.arrivalTime AS fromArrivalTime,
            fs.departureDayOffset AS fromDepartureDayOffset,
            ts.stopOrder AS toStopSequence,
            ts.arrivalTime AS toArrivalTime,
            ts.departureTime AS toDepartureTime,
            ts.arrivalDayOffset AS toArrivalDayOffset,
            (SELECT MIN(stopOrder) FROM TrainStops WHERE trainId = t.id) AS minStopOrder,
            (SELECT MAX(stopOrder) FROM TrainStops WHERE trainId = t.id) AS maxStopOrder,
            (SELECT TOP 1 tsD.departureTime FROM TrainStops tsD
             WHERE tsD.trainId = t.id AND tsD.stopOrder >= fs.stopOrder AND tsD.departureTime IS NOT NULL
             ORDER BY tsD.stopOrder) AS fromDepartureFallback,
            (SELECT TOP 1 tsA.arrivalTime FROM TrainStops tsA
             WHERE tsA.trainId = t.id AND tsA.stopOrder <= ts.stopOrder AND tsA.arrivalTime IS NOT NULL
             ORDER BY tsA.stopOrder DESC) AS toArrivalFallback
        FROM Trains t
        INNER JOIN TrainStops fs ON fs.trainId = t.id AND fs.stationId = @fromId
        INNER JOIN TrainStops ts ON ts.trainId = t.id AND ts.stationId = @toId
        WHERE t.id IN (${placeholders}) AND fs.stopOrder < ts.stopOrder
    `);

    const map = {};
    for (const row of result.recordset) {
        map[row.trainId] = row;
    }
    return map;
}

function applySearchSegmentToTrain(train, fromMeta, toMeta, segmentRow) {
    const row = segmentRow || {};
    const fromDepartureTime = resolveSegmentDepartureTime(row)
        || normalizeTimeValue(train.from?.departureTime)
        || normalizeTimeValue(train.from?.arrivalTime)
        || normalizeTimeValue(train.departureTime);
    const toArrivalTime = resolveSegmentArrivalTime(row)
        || normalizeTimeValue(train.to?.arrivalTime)
        || normalizeTimeValue(train.to?.departureTime)
        || normalizeTimeValue(train.arrivalTime);
    const fromDayOffset = row.fromDepartureDayOffset ?? train.from?.dayOffset ?? 0;
    const toDayOffset = row.toArrivalDayOffset ?? train.to?.dayOffset ?? 0;
    const fromStop = { departureTime: fromDepartureTime, departureDayOffset: fromDayOffset };
    const toStop = {
        arrivalTime: toArrivalTime,
        arrivalDayOffset: toDayOffset,
        departureDayOffset: toDayOffset
    };
    const durationMinutes = runningDayService.calculateDurationMinutes(fromStop, toStop)
        ?? train.durationMinutes
        ?? null;

    return {
        ...train,
        source: fromMeta.name,
        destination: toMeta.name,
        departureTime: fromDepartureTime,
        arrivalTime: toArrivalTime,
        duration: runningDayService.formatDuration(durationMinutes),
        durationMinutes,
        boarding: {
            stationCode: fromMeta.code,
            stationName: fromMeta.name,
            departureTime: fromDepartureTime,
            dayOffset: fromDayOffset
        },
        drop: {
            stationCode: toMeta.code,
            stationName: toMeta.name,
            arrivalTime: toArrivalTime,
            dayOffset: toDayOffset
        },
        from: {
            stationCode: fromMeta.code,
            stationName: fromMeta.name,
            departureTime: fromDepartureTime,
            dayOffset: fromDayOffset
        },
        to: {
            stationCode: toMeta.code,
            stationName: toMeta.name,
            arrivalTime: toArrivalTime,
            dayOffset: toDayOffset
        }
    };
}

async function finalizeSearchResults(trains, fromStation, toStation, fromQuery, toQuery) {
    const fromMeta = stationMeta(fromStation, fromQuery);
    const toMeta = stationMeta(toStation, toQuery);
    if (!fromMeta || !toMeta) {
        return trains.map((train) => applySearchSegmentToTrain(train, fromMeta || { code: '', name: fromQuery || '' }, toMeta || { code: '', name: toQuery || '' }));
    }

    const trainIds = trains.map((t) => t.trainId || t.id).filter(Boolean);
    const segmentMap = fromStation?.id && toStation?.id
        ? await batchLoadSegmentTimes(trainIds, fromStation.id, toStation.id)
        : {};

    return trains.map((train) => applySearchSegmentToTrain(
        train,
        fromMeta,
        toMeta,
        segmentMap[train.trainId || train.id]
    ));
}

async function resolveStation(query) {
    const pool = await getPool();
    const term = normalizeStationQuery(query);
    if (!term) return null;

    const upper = term.toUpperCase();
    const aliasCode = STATION_CODE_ALIASES[term.toLowerCase()];
    if (aliasCode) {
        const aliasResult = await pool.request()
            .input('code', 'NVarChar', aliasCode)
            .query(`SELECT TOP 1 * FROM Stations WHERE UPPER(code) = @code AND isActive = 1`);
        if (aliasResult.recordset[0]) return aliasResult.recordset[0];
    }

    const like = `%${term}%`;

    const exactCode = await pool.request()
        .input('code', 'NVarChar', upper)
        .query(`SELECT TOP 1 * FROM Stations WHERE UPPER(code) = @code AND isActive = 1`);

    if (exactCode.recordset[0]) return exactCode.recordset[0];

    const result = await pool.request()
        .input('like1', 'NVarChar', like)
        .input('like2', 'NVarChar', like)
        .input('like3', 'NVarChar', like)
        .input('upper', 'NVarChar', upper)
        .query(`SELECT TOP 1 * FROM Stations
                WHERE isActive = 1 AND (name LIKE @like1 OR city LIKE @like2 OR normalizedName LIKE @like3 OR UPPER(code) = @upper)
                ORDER BY
                  CASE WHEN UPPER(code) = @upper THEN 0
                       WHEN name LIKE '%GOODS%' OR name LIKE '%HALT%' OR name LIKE '% NEW%' OR name LIKE '% YARD%' THEN 3
                       WHEN name LIKE '% JN%' OR name LIKE '% JUNCTION%' OR name LIKE '% CANT%' OR name LIKE '% TERMINAL%' THEN 1
                       ELSE 2 END,
                  CASE WHEN name LIKE @like1 THEN 0 ELSE 1 END,
                  LEN(name) ASC,
                  name ASC`);

    return result.recordset[0] || null;
}

async function hasNormalizedStops() {
    const pool = await getPool();
    const result = await pool.request().query(
        'SELECT TOP 1 1 AS ok FROM TrainStops WHERE stationId IS NOT NULL'
    );
    return result.recordset.length > 0;
}

async function searchViaStops({ fromStationId, toStationId, date, classCode, fromStationMeta, toStationMeta }) {
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
            t.departureTime AS trainDepartureTime,
            t.arrivalTime AS trainArrivalTime,
            tt.code AS trainTypeCode,
            tt.name AS trainTypeName,
            fs.stopOrder AS fromStopSequence,
            fs.departureTime AS fromDepartureTime,
            fs.arrivalTime AS fromArrivalTime,
            (SELECT TOP 1 tsD.departureTime FROM TrainStops tsD
             WHERE tsD.trainId = t.id AND tsD.stopOrder >= fs.stopOrder AND tsD.departureTime IS NOT NULL
             ORDER BY tsD.stopOrder) AS fromDepartureFallback,
            fs.departureDayOffset AS fromDepartureDayOffset,
            fs.distanceKm AS fromDistanceKm,
            fs.stationId AS fromStationId,
            sFrom.code AS fromStationCode,
            sFrom.name AS fromStationName,
            ts.stopOrder AS toStopSequence,
            ts.arrivalTime AS toArrivalTime,
            ts.departureTime AS toDepartureTime,
            (SELECT TOP 1 tsA.arrivalTime FROM TrainStops tsA
             WHERE tsA.trainId = t.id AND tsA.stopOrder <= ts.stopOrder AND tsA.arrivalTime IS NOT NULL
             ORDER BY tsA.stopOrder DESC) AS toArrivalFallback,
            ts.arrivalDayOffset AS toArrivalDayOffset,
            ts.distanceKm AS toDistanceKm,
            ts.stationId AS toStationId,
            sTo.code AS toStationCode,
            sTo.name AS toStationName,
            (SELECT MIN(stopOrder) FROM TrainStops WHERE trainId = t.id) AS minStopOrder,
            (SELECT MAX(stopOrder) FROM TrainStops WHERE trainId = t.id) AS maxStopOrder
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

        const fromDepartureTime = resolveSegmentDepartureTime(row);
        const toArrivalTime = resolveSegmentArrivalTime(row);

        const fromStop = {
            departureTime: fromDepartureTime,
            departureDayOffset: row.fromDepartureDayOffset
        };
        const toStop = {
            arrivalTime: toArrivalTime,
            arrivalDayOffset: row.toArrivalDayOffset,
            departureDayOffset: row.toArrivalDayOffset
        };
        const durationMinutes = runningDayService.calculateDurationMinutes(fromStop, toStop);
        const distanceKm = Math.max(0, (row.toDistanceKm || 0) - (row.fromDistanceKm || 0));

        rows.push(formatSearchResult(
            { ...row, fromDepartureTime, toArrivalTime },
            runningDayList,
            classesMap[row.trainId] || [],
            durationMinutes,
            distanceKm,
            date,
            fromStationMeta,
            toStationMeta
        ));
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

function formatSearchResult(row, runningDayList, classes, durationMinutes, distanceKm, date, fromStationMeta, toStationMeta) {
    const journeyDate = date || row.journeyDate;
    const fromDepartureTime = normalizeTimeValue(row.fromDepartureTime);
    const toArrivalTime = normalizeTimeValue(row.toArrivalTime);
    const fromCode = fromStationMeta?.code || row.fromStationCode;
    const fromName = fromStationMeta?.name || row.fromStationName;
    const toCode = toStationMeta?.code || row.toStationCode;
    const toName = toStationMeta?.name || row.toStationName;
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
        source: fromName,
        destination: toName,
        departureTime: fromDepartureTime,
        arrivalTime: toArrivalTime,
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
        boarding: {
            stationCode: fromCode,
            stationName: fromName,
            departureTime: fromDepartureTime,
            dayOffset: row.fromDepartureDayOffset || 0
        },
        drop: {
            stationCode: toCode,
            stationName: toName,
            arrivalTime: toArrivalTime,
            dayOffset: row.toArrivalDayOffset || 0
        },
        from: {
            stationCode: fromCode,
            stationName: fromName,
            departureTime: fromDepartureTime,
            dayOffset: row.fromDepartureDayOffset || 0
        },
        to: {
            stationCode: toCode,
            stationName: toName,
            arrivalTime: toArrivalTime,
            dayOffset: row.toArrivalDayOffset || 0
        }
    };
}

async function legacySearch({ source, destination, date, fromStationMeta, toStationMeta }) {
    const pool = await getPool();
    const request = pool.request();
    const isSqliteCloud = (process.env.DB_DRIVER || '').toLowerCase() === 'sqlite';
    let query = 'SELECT * FROM Trains WHERE isActive = 1';

    if (source) {
        query += ' AND source LIKE @source';
        request.input('source', 'NVarChar', `%${source}%`);
    }
    if (destination) {
        query += ' AND destination LIKE @destination';
        request.input('destination', 'NVarChar', `%${destination}%`);
    }
    if (date && !isSqliteCloud) {
        query += ' AND journeyDate = @date';
        request.input('date', 'Date', date);
    }
    query += " AND runningStatus = 'Running' ORDER BY departureTime ASC";

    const result = await request.query(query);
    const trainIds = result.recordset.map((t) => t.id);
    const classesMap = await trainClassRepository.findByTrainIds(trainIds);

    return result.recordset.map((train) => {
        const runningDayList = runningDayService.resolveRunningDayList(train.runningDays);
        const fromDepartureTime = normalizeTimeValue(train.departureTime);
        const toArrivalTime = normalizeTimeValue(train.arrivalTime);
        const fromName = fromStationMeta?.name || train.source;
        const toName = toStationMeta?.name || train.destination;
        const fromCode = fromStationMeta?.code || '';
        const toCode = toStationMeta?.code || '';
        const durationMinutes = runningDayService.calculateDurationMinutes(
            { departureTime: fromDepartureTime, departureDayOffset: 0 },
            { arrivalTime: toArrivalTime, arrivalDayOffset: 0, departureDayOffset: 0 }
        );

        return {
            ...train,
            id: train.id,
            date: date || train.journeyDate,
            source: fromName,
            destination: toName,
            departureTime: fromDepartureTime,
            arrivalTime: toArrivalTime,
            duration: runningDayService.formatDuration(durationMinutes),
            durationMinutes,
            price: Number(train.price),
            runningDays: runningDayService.runningDaysLabel(runningDayList),
            runningDaysList: runningDayList,
            classes: classesMap[train.id] || [],
            lowestPrice: classesMap[train.id]?.length
                ? Math.min(...classesMap[train.id].map((c) => c.price))
                : Number(train.price),
            from: {
                stationCode: fromCode,
                stationName: fromName,
                departureTime: fromDepartureTime,
                dayOffset: 0
            },
            to: {
                stationCode: toCode,
                stationName: toName,
                arrivalTime: toArrivalTime,
                dayOffset: 0
            },
            boarding: {
                stationCode: fromCode,
                stationName: fromName,
                departureTime: fromDepartureTime,
                dayOffset: 0
            },
            drop: {
                stationCode: toCode,
                stationName: toName,
                arrivalTime: toArrivalTime,
                dayOffset: 0
            }
        };
    });
}

async function search({ source, destination, date, classCode, from, to, flexDays = 0 }) {
    const fromQuery = from || source;
    const toQuery = to || destination;

    if (fromQuery && toQuery && String(fromQuery).trim().toLowerCase() === String(toQuery).trim().toLowerCase()) {
        return [];
    }

    const cacheKey = searchCacheRepository.buildKey({
        v: 5,
        from: fromQuery, to: toQuery, date, classCode, flexDays
    });

    const fromStation = fromQuery ? await resolveStation(fromQuery) : null;
    const toStation = toQuery ? await resolveStation(toQuery) : null;
    const searchMeta = {
        from: stationMeta(fromStation, fromQuery),
        to: stationMeta(toStation, toQuery)
    };

    try {
        const cached = await searchCacheRepository.get(cacheKey);
        if (cached) {
            const cachedTrains = Array.isArray(cached) ? cached : cached.trains;
            if (cachedTrains?.length) {
                const trains = await finalizeSearchResults(
                    cachedTrains,
                    fromStation,
                    toStation,
                    fromQuery,
                    toQuery
                );
                return { trains, searchMeta: cached.searchMeta || searchMeta };
            }
        }
    } catch (_) { /* cache optional */ }

    const flex = Math.min(Math.max(parseInt(flexDays, 10) || 0, 0), 3);
    const dates = [date];
    if (flex > 0 && date) {
        const base = new Date(`${date}T00:00:00`);
        for (let d = 1; d <= flex; d += 1) {
            const before = new Date(base);
            before.setDate(before.getDate() - d);
            const after = new Date(base);
            after.setDate(after.getDate() + d);
            dates.push(before.toISOString().split('T')[0], after.toISOString().split('T')[0]);
        }
    }

    const seen = new Set();
    const merged = [];
    const stopsAvailable = await hasNormalizedStops();
    const routeAware = stopsAvailable && fromStation && toStation;

    for (const journeyDate of [...new Set(dates)]) {
        let batch = [];
        if (routeAware) {
            batch = await searchViaStops({
                fromStationId: fromStation.id,
                toStationId: toStation.id,
                date: journeyDate,
                classCode,
                fromStationMeta: fromStation,
                toStationMeta: toStation
            });
        } else if (!fromStation || !toStation || !stopsAvailable) {
            batch = await legacySearch({
                source: fromStation?.name || fromStation?.city || fromQuery,
                destination: toStation?.name || toStation?.city || toQuery,
                date: journeyDate,
                fromStationMeta: fromStation,
                toStationMeta: toStation
            });
        }
        for (const train of batch) {
            const key = `${train.id}-${journeyDate}`;
            if (!seen.has(key)) {
                seen.add(key);
                merged.push({ ...train, journeyDate: journeyDate || train.journeyDate });
            }
        }
    }

    const trains = await finalizeSearchResults(merged, fromStation, toStation, fromQuery, toQuery);
    const payload = { trains, searchMeta };

    try {
        await searchCacheRepository.set(cacheKey, payload, 10);
    } catch (_) { /* ignore */ }

    return payload;
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
