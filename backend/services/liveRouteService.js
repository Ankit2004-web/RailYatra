const trainStopRepository = require('../repositories/trainStopRepository');
const stationRepository = require('../repositories/stationRepository');
const runningDayService = require('./runningDayService');

function parseClockMinutes(timeStr) {
    if (!timeStr || timeStr === '--:--') return null;
    const [h, m] = String(timeStr).split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
}

function formatStopTime(timeStr, dayOffset = 0) {
    if (!timeStr || timeStr === '--:--') return null;
    return { time: timeStr, dayOffset: dayOffset || 0 };
}

function stopAbsoluteMinutes(journeyDate, timeStr, dayOffset = 0) {
    const mins = parseClockMinutes(timeStr);
    if (mins == null || !journeyDate) return null;
    const base = runningDayService.parseDateOnly(journeyDate);
    base.setDate(base.getDate() + (dayOffset || 0));
    return base.getTime() + mins * 60_000;
}

function normalizeCode(value) {
    return String(value || '').trim().toUpperCase();
}

function normalizeName(value) {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function mapStopRow(stop, index, total, journeyDate, istClock) {
    const isFirst = index === 0;
    const isLast = index === total - 1;
    const arrival = isFirst ? null : formatStopTime(stop.arrivalTime, stop.arrivalDayOffset);
    const departure = isLast ? null : formatStopTime(stop.departureTime, stop.departureDayOffset);

    return {
        order: index + 1,
        stationId: stop.stationId,
        stationName: stop.stationName,
        stationCode: stop.stationCode || null,
        stationCity: stop.stationCity || null,
        platform: stop.platformHint || null,
        distanceKm: stop.distanceKm != null ? Number(stop.distanceKm) : null,
        haltMinutes: stop.haltMinutes || 0,
        arrival: arrival ? { scheduled: `${arrival.time}`, actual: null, delayLabel: null, onTime: null } : null,
        departure: departure ? { scheduled: `${departure.time}`, actual: null, delayLabel: null, onTime: null } : null,
        trackColor: 'gray',
        phase: 'upcoming',
        isCurrent: false,
        coachPositionAvailable: false,
        _arrMs: arrival ? stopAbsoluteMinutes(journeyDate, arrival.time, arrival.dayOffset) : null,
        _depMs: departure ? stopAbsoluteMinutes(journeyDate, departure.time, departure.dayOffset) : null
    };
}

function applyProgressPhases(stops, journeyDate) {
    const istClock = runningDayService.getIstClock();
    const nowMs = runningDayService.parseDateOnly(istClock.date).getTime() + istClock.minutes * 60_000;
    const isToday = journeyDate === istClock.date;

    let currentIdx = -1;
    if (isToday) {
        for (let i = 0; i < stops.length; i += 1) {
            const marker = stops[i]._depMs ?? stops[i]._arrMs;
            if (marker != null && marker <= nowMs) currentIdx = i;
        }
    } else if (journeyDate < istClock.date) {
        currentIdx = stops.length - 1;
    }

    stops.forEach((stop, idx) => {
        delete stop._arrMs;
        delete stop._depMs;
        if (currentIdx < 0 && idx === 0) {
            stop.phase = 'current';
            stop.isCurrent = true;
            stop.trackColor = 'green';
        } else if (idx < currentIdx) {
            stop.phase = 'passed';
            stop.trackColor = 'green';
        } else if (idx === currentIdx) {
            stop.phase = 'current';
            stop.isCurrent = true;
            stop.trackColor = 'orange';
        } else {
            stop.phase = 'upcoming';
            stop.trackColor = idx === currentIdx + 1 ? 'orange' : 'gray';
        }
    });

    return { currentIdx, istClock };
}

function timelineHeader(train, stops, currentIdx) {
    const currentStop = stops.find((s) => s.isCurrent) || stops[0];
    const nextStop = stops[stops.findIndex((s) => s.isCurrent) + 1] || stops[1] || null;

    return {
        source: stops[0]?.stationName || train.source,
        destination: stops[stops.length - 1]?.stationName || train.destination,
        journeyStatus: currentIdx < 0
            ? 'Scheduled'
            : (currentIdx >= stops.length - 1 ? 'Arrived' : 'Running'),
        statusBanner: currentIdx < 0
            ? `Scheduled from ${stops[0]?.stationName || train.source} (RailYatra stations)`
            : `At ${currentStop?.stationName}${currentStop?.stationCode ? ` (${currentStop.stationCode})` : ''} per RailYatra schedule`,
        upcomingStation: nextStop
            ? `${nextStop.stationName}${nextStop.stationCode ? ` (${nextStop.stationCode})` : ''}`
            : null,
        currentStop,
        nextStop
    };
}

/** Build station timeline from app TrainStops + Stations only. */
async function buildScheduledTimeline(train, journeyDate) {
    const rawStops = await trainStopRepository.findAppStopsByTrainId(train.id);
    if (!rawStops?.length) return null;

    const stops = rawStops.map((stop, index) => mapStopRow(stop, index, rawStops.length, journeyDate));
    const { currentIdx } = applyProgressPhases(stops, journeyDate);
    const header = timelineHeader(train, stops, currentIdx);

    return {
        source: header.source,
        destination: header.destination,
        journeyStatus: header.journeyStatus,
        statusBanner: header.statusBanner,
        upcomingStation: header.upcomingStation,
        stopCount: stops.length,
        dataScope: 'railyatra-stations',
        stops
    };
}

/** Minimal source → destination timeline using app station records only. */
async function buildEndpointTimeline(train, journeyDate) {
    let sourceStation = train.sourceStation || null;
    let destStation = train.destinationStation || null;

    if (!sourceStation?.code && train.sourceStationCode) {
        sourceStation = { code: train.sourceStationCode, name: train.sourceStationName || train.source };
    }
    if (!destStation?.code && train.destStationCode) {
        destStation = { code: train.destStationCode, name: train.destStationName || train.destination };
    }

    if (!sourceStation?.code && train.source) {
        const matches = await stationRepository.search(String(train.source).slice(0, 20), 1);
        sourceStation = matches[0] ? { code: matches[0].code, name: matches[0].name } : null;
    }
    if (!destStation?.code && train.destination) {
        const matches = await stationRepository.search(String(train.destination).slice(0, 20), 1);
        destStation = matches[0] ? { code: matches[0].code, name: matches[0].name } : null;
    }

    if (!sourceStation && !destStation) return null;

    const rows = [
        sourceStation && {
            stopOrder: 1,
            stationId: sourceStation.id,
            stationCode: sourceStation.code,
            stationName: sourceStation.name,
            departureTime: train.departureTime,
            departureDayOffset: 0,
            arrivalTime: null,
            arrivalDayOffset: 0,
            distanceKm: 0,
            haltMinutes: 0,
            platformHint: null
        },
        destStation && {
            stopOrder: 2,
            stationId: destStation.id,
            stationCode: destStation.code,
            stationName: destStation.name,
            arrivalTime: train.arrivalTime,
            arrivalDayOffset: 0,
            departureTime: null,
            departureDayOffset: 0,
            distanceKm: train.distance || null,
            haltMinutes: 0,
            platformHint: null
        }
    ].filter(Boolean);

    if (!rows.length) return null;

    const stops = rows.map((stop, index) => mapStopRow(stop, index, rows.length, journeyDate));
    const { currentIdx } = applyProgressPhases(stops, journeyDate);
    const header = timelineHeader(train, stops, currentIdx);

    return {
        source: header.source,
        destination: header.destination,
        journeyStatus: header.journeyStatus,
        statusBanner: `${header.statusBanner} (endpoint route — add full stops in admin to expand)`,
        upcomingStation: header.upcomingStation,
        stopCount: stops.length,
        dataScope: 'railyatra-stations',
        stops
    };
}

/** Overlay NTES live times onto app station rows (matched by station code). */
function mergeNtesOverlay(timeline, ntesStatus) {
    if (!timeline?.stops?.length || !ntesStatus?.routeTimeline?.stops?.length) {
        return { timeline, delayMinutes: ntesStatus?.delayMinutes || 0, merged: false };
    }

    const ntesByCode = new Map();
    for (const stop of ntesStatus.routeTimeline.stops) {
        const code = normalizeCode(stop.stationCode);
        if (code) ntesByCode.set(code, stop);
    }

    let merged = false;
    const stops = timeline.stops.map((stop) => {
        const ntesStop = ntesByCode.get(normalizeCode(stop.stationCode));
        if (!ntesStop) return stop;
        merged = true;
        return {
            ...stop,
            arrival: ntesStop.arrival || stop.arrival,
            departure: ntesStop.departure || stop.departure,
            platform: ntesStop.platform || stop.platform,
            phase: ntesStop.phase || stop.phase,
            isCurrent: ntesStop.isCurrent ?? stop.isCurrent,
            trackColor: ntesStop.trackColor || stop.trackColor
        };
    });

    return {
        timeline: {
            ...timeline,
            stops,
            statusBanner: ntesStatus.statusBanner || timeline.statusBanner,
            upcomingStation: ntesStatus.upcomingStation || timeline.upcomingStation,
            journeyStatus: ntesStatus.status || timeline.journeyStatus,
            dataScope: 'railyatra-stations+ntes'
        },
        delayMinutes: ntesStatus.delayMinutes || 0,
        merged
    };
}

/** Apply timeline onto response and derive header fields. */
function attachTimeline(status, timeline) {
    if (!timeline?.stops?.length) return status;

    const current = timeline.stops.find((s) => s.isCurrent) || timeline.stops.filter((s) => s.phase === 'passed').pop();
    const next = timeline.stops[timeline.stops.findIndex((s) => s.isCurrent) + 1]
        || timeline.stops.find((s) => s.phase === 'upcoming');

    return {
        ...status,
        routeTimeline: timeline,
        routeStops: timeline.stops,
        source: timeline.source || status.source,
        destination: timeline.destination || status.destination,
        currentLocation: current
            ? `${current.stationName}${current.stationCode ? ` (${current.stationCode})` : ''}`
            : status.currentLocation,
        currentStationCode: current?.stationCode || status.currentStationCode,
        nextStation: next?.stationName || status.nextStation,
        nextStationCode: next?.stationCode || status.nextStationCode,
        platform: current?.platform || status.platform,
        statusBanner: timeline.statusBanner || status.statusBanner || null,
        upcomingStation: timeline.upcomingStation || status.upcomingStation || null,
        stopCount: timeline.stopCount || timeline.stops.length
    };
}

module.exports = {
    buildScheduledTimeline,
    buildEndpointTimeline,
    mergeNtesOverlay,
    attachTimeline,
    normalizeCode,
    normalizeName
};
