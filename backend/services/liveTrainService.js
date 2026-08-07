const trainRepository = require('../repositories/trainRepository');
const ntesClient = require('./ntesClient');
const liveRouteService = require('./liveRouteService');
const runningDayService = require('./runningDayService');

const CACHE_TTL_MS = Number(process.env.NTES_CACHE_TTL_MS || 120000);
const NTES_OVERLAY_TIMEOUT_MS = Number(process.env.NTES_OVERLAY_TIMEOUT_MS || 8000);
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

async function resolveAppTrain(trainNumber) {
    const train = await trainRepository.findByNumber(trainNumber);
    if (!train) {
        const err = new Error(`Train ${trainNumber} is not in the RailYatra catalog`);
        err.status = 404;
        throw err;
    }
    return trainRepository.findById(train.id) || train;
}

async function buildAppRouteTimeline(train, journeyDate) {
    let timeline = await liveRouteService.buildScheduledTimeline(train, journeyDate);
    if (!timeline?.stops?.length) {
        timeline = await liveRouteService.buildEndpointTimeline(train, journeyDate);
    }
    return timeline;
}

async function buildAppTrainStatus(trainNumber, journeyDate) {
    const train = await resolveAppTrain(trainNumber);
    const routeTimeline = await buildAppRouteTimeline(train, journeyDate);

    const currentStop = routeTimeline?.stops?.find((s) => s.isCurrent) || routeTimeline?.stops?.[0];
    const nextStop = routeTimeline?.stops?.[
        (routeTimeline?.stops?.findIndex((s) => s.isCurrent) ?? -1) + 1
    ];

    const base = {
        trainId: train.id,
        trainNumber: String(trainNumber),
        trainName: train.trainName || '—',
        source: routeTimeline?.source || train.source || '—',
        destination: routeTimeline?.destination || train.destination || '—',
        currentLocation: currentStop
            ? `${currentStop.stationName}${currentStop.stationCode ? ` (${currentStop.stationCode})` : ''}`
            : train.source || '—',
        currentStationCode: currentStop?.stationCode || null,
        nextStation: nextStop?.stationName || train.destination || '—',
        nextStationCode: nextStop?.stationCode || null,
        delayMinutes: 0,
        speedKmph: null,
        platform: currentStop?.platform || null,
        status: routeTimeline?.journeyStatus || 'Scheduled',
        lastUpdated: new Date().toISOString(),
        provider: 'railyatra',
        dataSource: 'railyatra-stations',
        journeyDate: journeyDate || null,
        statusBanner: routeTimeline?.statusBanner || null,
        upcomingStation: routeTimeline?.upcomingStation || null,
        stopCount: routeTimeline?.stopCount || routeTimeline?.stops?.length || 0,
        notice: routeTimeline?.stops?.length
            ? `Route uses ${routeTimeline.stops.length} verified station(s) from the RailYatra catalog.`
            : 'This train has no linked app stations yet.',
        events: [],
        routeTimeline: routeTimeline || null,
        routeStops: routeTimeline?.stops || []
    };

    return liveRouteService.attachTimeline(base, routeTimeline);
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

    let status = await buildAppTrainStatus(normalized, date);

    try {
        const ntesStatus = await Promise.race([
            ntesClient.getLiveStatus(normalized, date),
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error('NTES overlay timeout')), NTES_OVERLAY_TIMEOUT_MS);
            })
        ]);
        const { timeline, delayMinutes, merged } = liveRouteService.mergeNtesOverlay(
            status.routeTimeline,
            ntesStatus
        );
        if (merged && timeline) {
            status = liveRouteService.attachTimeline({
                ...status,
                delayMinutes,
                provider: 'railyatra+ntes',
                dataSource: 'railyatra-stations+ntes',
                notice: `Route shows ${timeline.stops.length} RailYatra station(s) with live NTES delay overlay.`,
                lastUpdated: ntesStatus.lastUpdated || status.lastUpdated,
                events: ntesStatus.events || []
            }, timeline);
        }
    } catch (_) {
        /* Keep RailYatra-only route for every app train */
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

    const term = String(query || '').trim();
    if (!term) {
        const stats = await browseCatalog({ page: 1, pageSize: 1 });
        return {
            mode: 'suggestions',
            message: 'Browse all trains below or search by number, name, or route.',
            totalTrains: stats.totalItems,
            suggestions: (await browseCatalog({ page: 1, pageSize: 12 })).items.map(mapCatalogItem)
        };
    }

    const catalog = await browseCatalog({ search: term, page: 1, pageSize: 20 });
    return {
        mode: 'suggestions',
        message: `${catalog.totalItems} train(s) matched. Select one to track live.`,
        totalTrains: catalog.totalItems,
        suggestions: catalog.items.map(mapCatalogItem)
    };
};

function mapCatalogItem(t) {
    return {
        trainId: t.trainId,
        trainNumber: t.trainNumber,
        trainName: t.trainName,
        route: t.route,
        source: t.source,
        destination: t.destination,
        departureTime: t.departureTime,
        stopCount: t.stopCount
    };
}

async function browseCatalog({
    search = '',
    page = 1,
    pageSize = 24,
    source = '',
    destination = '',
    trainType = ''
} = {}) {
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeSize = Math.min(Math.max(parseInt(pageSize, 10) || 24, 1), 100);

    const result = await trainRepository.findPaginated({
        page: safePage,
        pageSize: safeSize,
        search,
        source,
        destination,
        trainType
    });

    return {
        mode: 'catalog',
        page: result.page,
        pageSize: result.pageSize,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
        items: result.items.map((t) => ({
            trainId: t.id,
            trainNumber: t.trainNumber,
            trainName: t.trainName,
            source: t.source,
            destination: t.destination,
            sourceCode: t.sourceStationCode || null,
            destCode: t.destStationCode || null,
            departureTime: t.departureTime,
            arrivalTime: t.arrivalTime,
            duration: t.duration,
            runningStatus: t.runningStatus || 'Running',
            trainTypeCode: t.trainTypeCode || null,
            stopCount: t.stopCount || 0,
            route: `${t.source || '—'} → ${t.destination || '—'}`
        }))
    };
}

/** Fast scheduled snapshot for catalog cards (RailYatra stations only). */
async function getScheduledPreview(trainNumber, journeyDate) {
    const normalized = normalizeTrainNumber(trainNumber);
    if (!normalized) {
        const err = new Error('Train number must be exactly 5 digits');
        err.status = 422;
        throw err;
    }
    const date = normalizeJourneyDate(journeyDate) || runningDayService.formatDateOnly(new Date());
    return buildAppTrainStatus(normalized, date);
}

module.exports = {
    getLiveStatusByTrainNumber,
    searchLiveTrains,
    browseCatalog,
    getScheduledPreview,
    mapCatalogItem
};
