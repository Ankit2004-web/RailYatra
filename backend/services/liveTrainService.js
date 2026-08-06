const trainRepository = require('../repositories/trainRepository');
const ntesClient = require('./ntesClient');

const CACHE_TTL_MS = Number(process.env.NTES_CACHE_TTL_MS || 120000);
const cache = new Map();

function cacheKey(trainNumber, journeyDate) {
    return `${trainNumber}:${journeyDate || 'today'}`;
}

function readCache(key) {
    const hit = cache.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) {
        cache.delete(key);
        return null;
    }
    return hit.value;
}

function writeCache(key, value) {
    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function normalizeTrainNumber(value) {
    const digits = String(value || '').replace(/\D/g, '');
    return /^\d{5}$/.test(digits) ? digits : null;
}

function normalizeJourneyDate(value) {
    if (!value) return null;
    const str = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const parsed = new Date(str);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
}

async function enrichWithLocalMeta(status, trainNumber) {
    const train = await trainRepository.findByNumber(trainNumber);
    if (!train) return status;

    return {
        ...status,
        trainId: train.id,
        trainName: status.trainName && status.trainName !== '—' ? status.trainName : train.trainName,
        source: train.source,
        destination: train.destination
    };
}

async function buildLocalScheduledStatus(trainNumber, journeyDate) {
    const train = await trainRepository.findByNumber(trainNumber);
    if (!train) {
        const err = new Error(`Train ${trainNumber} not found in RailYatra database`);
        err.status = 404;
        throw err;
    }

    return {
        trainId: train.id,
        trainNumber: String(trainNumber),
        trainName: train.trainName || '—',
        source: train.source || '—',
        destination: train.destination || '—',
        currentLocation: train.source || '—',
        currentStationCode: null,
        nextStation: train.destination || '—',
        nextStationCode: null,
        delayMinutes: 0,
        speedKmph: null,
        platform: null,
        status: 'Scheduled',
        lastUpdated: new Date().toISOString(),
        provider: 'local',
        dataSource: 'scheduled',
        journeyDate: journeyDate || null,
        notice: 'Live NTES feed is unavailable from this server. Showing scheduled route from RailYatra.',
        events: [],
        routeStops: []
    };
}

const getLiveStatusByTrainNumber = async (trainNumber, journeyDate) => {
    const normalized = normalizeTrainNumber(trainNumber);
    if (!normalized) {
        const err = new Error('Train number must be exactly 5 digits');
        err.status = 422;
        throw err;
    }

    const date = normalizeJourneyDate(journeyDate);
    const key = cacheKey(normalized, date);
    const cached = readCache(key);
    if (cached) return cached;

    let status;
    try {
        status = await ntesClient.getLiveStatus(normalized, date);
        status = await enrichWithLocalMeta(status, normalized);
    } catch (err) {
        status = await buildLocalScheduledStatus(normalized, date);
    }

    writeCache(key, status);
    return status;
};

const searchLiveTrains = async (query, journeyDate) => {
    const normalizedNumber = normalizeTrainNumber(query);
    if (normalizedNumber) {
        const status = await getLiveStatusByTrainNumber(normalizedNumber, journeyDate);
        return [status];
    }

    const term = String(query || '').trim().toLowerCase();
    if (!term) {
        const trains = await trainRepository.findAll();
        return {
            mode: 'suggestions',
            message: 'Enter a 5-digit train number for live NTES status.',
            suggestions: trains.slice(0, 12).map((t) => ({
                trainNumber: t.trainNumber,
                trainName: t.trainName,
                route: `${t.source} → ${t.destination}`
            }))
        };
    }

    const trains = await trainRepository.findAll();
    const matches = trains
        .filter((t) => t.trainNumber.includes(term) || t.trainName.toLowerCase().includes(term))
        .slice(0, 12);

    return {
        mode: 'suggestions',
        message: 'Select a train number to fetch live NTES running status.',
        suggestions: matches.map((t) => ({
            trainNumber: t.trainNumber,
            trainName: t.trainName,
            route: `${t.source} → ${t.destination}`
        }))
    };
};

module.exports = {
    getLiveStatusByTrainNumber,
    searchLiveTrains
};
