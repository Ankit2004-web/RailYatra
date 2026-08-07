/**
 * Unofficial client for Indian Railways NTES (National Train Enquiry System).
 * Fetches live running status from enquiry.indianrail.gov.in — same source as the official app.
 */

const BASE_URL = 'https://enquiry.indianrail.gov.in/mntes';

const DEFAULT_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
        + '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    ),
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Referer: `${BASE_URL}/`,
    Origin: 'https://enquiry.indianrail.gov.in',
    'X-Requested-With': 'XMLHttpRequest'
};

class NtesError extends Error {
    constructor(message, statusCode = 502) {
        super(message);
        this.name = 'NtesError';
        this.statusCode = statusCode;
    }
}

function todayNtesDate(dateInput) {
    const d = dateInput ? new Date(`${String(dateInput).slice(0, 10)}T00:00:00`) : new Date();
    if (Number.isNaN(d.getTime())) return formatNtesDate(new Date());
    return formatNtesDate(d);
}

function formatNtesDate(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

function collectCookies(response, existing = '') {
    const jar = new Map();
    for (const part of String(existing || '').split(';').filter(Boolean)) {
        const [k, ...rest] = part.trim().split('=');
        if (k) jar.set(k, rest.join('='));
    }

    const setCookies = typeof response.headers.getSetCookie === 'function'
        ? response.headers.getSetCookie()
        : [response.headers.get('set-cookie')].filter(Boolean);

    for (const raw of setCookies) {
        const chunks = Array.isArray(raw) ? raw : String(raw).split(/,(?=[^;]+?=)/);
        for (const chunk of chunks) {
            const pair = chunk.split(';')[0].trim();
            const [k, ...rest] = pair.split('=');
            if (k) jar.set(k, rest.join('='));
        }
    }

    return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

async function bootstrapSession(cookieHeader) {
    const response = await fetch(`${BASE_URL}/`, {
        headers: { ...DEFAULT_HEADERS, ...(cookieHeader ? { Cookie: cookieHeader } : {}) },
        redirect: 'follow'
    });
    if (!response.ok) throw new NtesError(`NTES session bootstrap failed (${response.status})`);
    return collectCookies(response, cookieHeader);
}

async function getCsrfToken(cookieHeader) {
    const ts = Date.now();
    const response = await fetch(`${BASE_URL}/GetCSRFToken?t=${ts}`, {
        headers: { ...DEFAULT_HEADERS, Cookie: cookieHeader }
    });
    if (!response.ok) throw new NtesError(`NTES CSRF request failed (${response.status})`);
    const text = await response.text();
    const match = text.match(/name='([^']+)'\s+value='([^']+)'/);
    if (!match) throw new NtesError('CSRF token not found in NTES response');
    return { key: match[1], value: match[2], cookies: collectCookies(response, cookieHeader) };
}

async function fetchTrainStatusHtml(trainNumber, journeyDate) {
    const normalized = String(trainNumber || '').replace(/\D/g, '');
    if (!/^\d{5}$/.test(normalized)) {
        throw new NtesError('Train number must be exactly 5 digits', 422);
    }

    let cookies = await bootstrapSession('');
    cookies = await bootstrapSession(cookies);
    const csrf = await getCsrfToken(cookies);
    cookies = csrf.cookies;

    const refDate = todayNtesDate(journeyDate);
    const params = new URLSearchParams({
        opt: 'TrainRunning',
        subOpt: 'FindRunningInstance',
        refDate
    });

    const body = new URLSearchParams({
        lan: 'en',
        jDate: refDate,
        trainNo: normalized,
        [csrf.key]: csrf.value
    });

    const response = await fetch(`${BASE_URL}/tr?${params}`, {
        method: 'POST',
        headers: {
            ...DEFAULT_HEADERS,
            Cookie: cookies,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
    });

    if (!response.ok) throw new NtesError(`NTES running status failed (${response.status})`);
    return response.text();
}

function stripHtml(html) {
    return String(html || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{2,}/g, '\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}

function extractStatusLines(html) {
    const text = stripHtml(html);
    const lines = text.split(/[\n\r]+/).map((ln) => ln.trim()).filter(Boolean);
    const keywords = [
        'Arrived', 'Arrive', 'Arriving', 'Departed', 'Depart', 'Departure',
        'On Time', 'Yet to start', 'Reached Destination', 'Current Position',
        'Last Updates On', 'Start Date', 'Next Station', 'running late', 'Train Name', 'Platform'
    ];

    const matches = [];
    for (const ln of lines) {
        const lower = ln.toLowerCase();
        if (keywords.some((kw) => lower.includes(kw.toLowerCase()))) matches.push(ln);
    }

    const seen = new Set();
    return matches.filter((m) => {
        if (seen.has(m)) return false;
        seen.add(m);
        return true;
    });
}

function parseDelayMinutes(value) {
    if (!value) return 0;
    const str = String(value).trim();
    if (/on time/i.test(str)) return 0;
    const hm = str.match(/(\d{1,2}):(\d{2})/);
    if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
    const mins = str.match(/(\d+)\s*min/i);
    if (mins) return Number(mins[1]);
    const num = str.match(/(\d+)/);
    return num ? Number(num[1]) : 0;
}

function parseTrainStatusHtml(html) {
    const lines = extractStatusLines(html);
    let lastUpdate = null;
    let startDate = null;
    let trainName = null;
    let currentPosition = null;
    let nextStation = null;
    let nextStationCode = null;
    let platform = null;
    let delayMinutes = 0;
    const events = [];

    for (const ln of lines) {
        const lastUpdateMatch = ln.match(
            /Last Updates On\s*(\d{1,2}-[A-Za-z]{3}-\d{4})(?:\s+(\d{1,2}:\d{2}))?/i
        );
        if (lastUpdateMatch) {
            const time = lastUpdateMatch[2] || '00:00';
            lastUpdate = new Date(`${lastUpdateMatch[1]} ${time}`);
        }

        const startMatch = ln.match(/Start Date\s*:\s*(\d{1,2}-[A-Za-z]{3}-\d{4})/i);
        if (startMatch) startDate = startMatch[1];

        const nameMatch = ln.match(/Train Name\s*:\s*(.+)$/i);
        if (nameMatch) trainName = nameMatch[1].trim();

        const currentMatch = ln.match(/Current Position\s*:\s*(.+)$/i);
        if (currentMatch) currentPosition = currentMatch[1].trim();

        const nextMatch = ln.match(/Next Station\s*:\s*(.+?)(?:\(([^)]+)\))?$/i);
        if (nextMatch) {
            nextStation = nextMatch[1].trim();
            nextStationCode = nextMatch[2]?.trim() || null;
        }

        const platformMatch = ln.match(/Platform\s*:\s*([A-Za-z0-9\-]+)/i);
        if (platformMatch) platform = platformMatch[1];

        const lateMatch = ln.match(/running late by\s*(\d+)\s*minutes?/i);
        if (lateMatch) delayMinutes = Number(lateMatch[1]);

        const eventMatch = ln.match(
            /\b(Departed|Arrived)\b\s+(?:from|at)\s+([^()]+?)\s*\(\s*([A-Z0-9]{2,6})\s*\)/i
        );
        if (eventMatch) {
            events.push({
                type: eventMatch[1].charAt(0).toUpperCase() + eventMatch[1].slice(1).toLowerCase(),
                station: eventMatch[2].trim(),
                code: eventMatch[3].trim(),
                raw: ln,
                delay: (ln.match(/Delay[:\-\s]*\(?\s*([0-9:]{1,5})\)?/i) || [])[1] || null
            });
            continue;
        }

        const looseEvent = ln.match(/\b(Departed|Arrived)\b\s+(?:from|at)\s+(.+?)(?:\s+at|\s+on|$)/i);
        if (looseEvent) {
            events.push({
                type: looseEvent[1].charAt(0).toUpperCase() + looseEvent[1].slice(1).toLowerCase(),
                station: looseEvent[2].trim(),
                code: null,
                raw: ln,
                delay: (ln.match(/Delay[:\-\s]*\(?\s*([0-9:]{1,5})\)?/i) || [])[1] || null
            });
        }
    }

    if (!delayMinutes && events.length) {
        const lastDelay = events[events.length - 1].delay;
        delayMinutes = parseDelayMinutes(lastDelay);
    }

    return {
        startDate,
        lastUpdate: lastUpdate && !Number.isNaN(lastUpdate.getTime()) ? lastUpdate.toISOString() : null,
        trainName,
        currentPosition,
        nextStation,
        nextStationCode,
        platform,
        delayMinutes,
        events
    };
}

function parseTimeColumn(htmlChunk) {
    if (!htmlChunk) {
        return { scheduled: null, actual: null, delayLabel: null, onTime: null };
    }

    const text = stripHtml(htmlChunk);
    if (!text || text === '&nbsp;') {
        return { scheduled: null, actual: null, delayLabel: null, onTime: null };
    }

    const timeMatches = [...text.matchAll(/(\d{1,2}:\d{2})\s+(\d{1,2}-[A-Za-z]{3})(\*?)/g)]
        .map((match) => `${match[1]} ${match[2]}${match[3] ? '*' : ''}`.trim());

    const scheduled = timeMatches[0]?.replace('*', '') || null;
    const actual = (timeMatches[1] || timeMatches[0] || null)?.replace('*', '') || null;
    const onTime = /on time/i.test(text);
    let delayLabel = null;

    if (onTime) {
        delayLabel = 'On Time';
    } else {
        const delayMatch = text.match(/Delay[^0-9]*(\d{1,2}:\d{2})/i)
            || text.match(/(\d{1,2}:\d{2})/);
        delayLabel = delayMatch?.[1] || null;
    }

    return { scheduled, actual, delayLabel, onTime: onTime || null };
}

function parseTrainRouteHtml(html) {
    const routeHeaderMatch = html.match(/<h5>\s*([A-Z0-9\s.\-/]+)\s*-\s*([A-Z0-9\s.\-/]+)\s*</i);
    const statusBannerMatch = html.match(/<font size="2" color="[^"]*"><b>([^<]+)<\/b>/i)
        || html.match(/Yet to start from its source/i)
        || html.match(/Arrived at [^<]+/i)
        || html.match(/Departed from [^<]+/i);
    const upcomingMatch = stripHtml(html).match(/Upcoming Station\s*:\s*([^\n]+)/i);

    const blocks = html.split(/class=" w3-card-2 stopRow"/i).slice(1);
    const stops = [];

    for (const block of blocks) {
        const chunk = block.slice(0, 5000);
        const nameMatch = chunk.match(/<font size="1"><b>([^<]+)<\/b><br>/i);
        const stationName = nameMatch?.[1]?.trim();
        if (!stationName) continue;

        const codeMatch = chunk.match(/<b>([A-Z]{2,6})\s*<span class="w3-round w3-orange"[^>]*>([^<]+)<\/span>/i)
            || chunk.match(/<b>([A-Z]{2,6})\b/i);
        const platformMatch = codeMatch?.[2]?.match(/PF\s*([^*<]+)/i);
        const distanceMatch = chunk.match(/<br><b>(\d+)<\/b>\s*KMs/i);
        const trackColorMatch = chunk.match(/fa-circle[^>]*color:\s*([^;"']+)/i);

        const leftCol = chunk.match(
            /float:left;width:100px;text-align:right[^>]*>([\s\S]*?)<\/div>\s*<div class="w3-bar-block/i
        );
        const rightCol = chunk.match(
            /float:right;text-align:right;width:100px[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>\s*)*(?:<!-- Modal|<\/div>\s*<\/div>\s*<\/div>)/i
        );

        const arrival = parseTimeColumn(leftCol?.[1] || '');
        const departure = parseTimeColumn(rightCol?.[1] || '');

        stops.push({
            order: stops.length + 1,
            stationName,
            stationCode: codeMatch?.[1] || null,
            platform: platformMatch?.[1]?.trim() || null,
            distanceKm: distanceMatch ? Number(distanceMatch[1]) : null,
            arrival: arrival.scheduled || arrival.actual ? arrival : null,
            departure: departure.scheduled || departure.actual ? departure : null,
            trackColor: (trackColorMatch?.[1] || 'gray').trim(),
            phase: 'upcoming',
            isCurrent: false,
            coachPositionAvailable: /Coach Position/i.test(chunk)
        });
    }

    let currentIdx = stops.findIndex((stop) => /orange/i.test(stop.trackColor));
    if (currentIdx < 0) {
        const passedCount = stops.filter((stop) => /green/i.test(stop.trackColor)).length;
        currentIdx = passedCount > 0 ? passedCount - 1 : 0;
    }

    stops.forEach((stop, idx) => {
        if (/green/i.test(stop.trackColor) || idx < currentIdx) {
            stop.phase = 'passed';
        } else if (idx === currentIdx) {
            stop.phase = 'current';
            stop.isCurrent = true;
        } else {
            stop.phase = 'upcoming';
        }
    });

    if (stops.length) {
        stops[0].phase = stops[0].phase || 'passed';
        const last = stops[stops.length - 1];
        last.trackColor = /red/i.test(last.trackColor) ? last.trackColor : 'red';
        if (last.phase === 'upcoming') last.phase = 'upcoming';
    }

    const currentStop = stops[currentIdx] || stops[0] || null;
    const nextStop = stops[currentIdx + 1] || null;

    let journeyStatus = 'Running';
    const bannerText = statusBannerMatch
        ? (typeof statusBannerMatch === 'string' ? statusBannerMatch : statusBannerMatch[1])
        : '';
    if (/yet to start/i.test(bannerText)) journeyStatus = 'Scheduled';
    if (/reached destination|terminated/i.test(bannerText)) journeyStatus = 'Arrived';

    return {
        source: routeHeaderMatch?.[1]?.trim() || stops[0]?.stationName || null,
        destination: routeHeaderMatch?.[2]?.trim() || stops[stops.length - 1]?.stationName || null,
        journeyStatus,
        statusBanner: bannerText || null,
        upcomingStation: upcomingMatch?.[1]?.trim()
            || (nextStop ? `${nextStop.stationName}${nextStop.stationCode ? ` (${nextStop.stationCode})` : ''}` : null),
        stops
    };
}

function deriveStatus(parsed) {
    const text = (parsed.events[parsed.events.length - 1]?.raw || '').toLowerCase();
    if (/yet to start|not started/.test(text)) return 'Scheduled';
    if (/reached destination|terminated/.test(text)) return 'Arrived';
    if (parsed.delayMinutes > 15) return 'Delayed';
    return 'Running';
}

function mapParsedToLiveStatus(parsed, trainNumber, localMeta = {}, routeTimeline = null) {
    const lastEvent = parsed.events[parsed.events.length - 1] || null;
    const timelineCurrent = routeTimeline?.stops?.find((s) => s.isCurrent)
        || routeTimeline?.stops?.filter((s) => s.phase === 'passed').pop();
    const timelineNext = routeTimeline?.stops?.[
        routeTimeline.stops.findIndex((s) => s.isCurrent) + 1
    ] || routeTimeline?.stops?.find((s) => s.phase === 'upcoming');

    const currentLocation = parsed.currentPosition
        || (timelineCurrent
            ? `${timelineCurrent.stationName}${timelineCurrent.stationCode ? ` (${timelineCurrent.stationCode})` : ''}`
            : null)
        || (lastEvent ? `${lastEvent.station}${lastEvent.code ? ` (${lastEvent.code})` : ''}` : null)
        || localMeta.source
        || '—';

    const currentCode = timelineCurrent?.stationCode || lastEvent?.code || localMeta.fromCode || null;

    return {
        trainId: localMeta.id || null,
        trainNumber: String(trainNumber),
        trainName: parsed.trainName || localMeta.trainName || '—',
        source: routeTimeline?.source || localMeta.source || null,
        destination: routeTimeline?.destination || localMeta.destination || null,
        currentLocation,
        currentStationCode: currentCode,
        nextStation: parsed.nextStation || timelineNext?.stationName || '—',
        nextStationCode: parsed.nextStationCode || timelineNext?.stationCode || null,
        delayMinutes: parsed.delayMinutes || 0,
        speedKmph: null,
        platform: timelineCurrent?.platform || parsed.platform || null,
        status: routeTimeline?.journeyStatus || deriveStatus(parsed),
        lastUpdated: parsed.lastUpdate || new Date().toISOString(),
        provider: 'ntes',
        dataSource: 'ntes',
        startDate: parsed.startDate || null,
        statusBanner: routeTimeline?.statusBanner || null,
        upcomingStation: routeTimeline?.upcomingStation || null,
        events: parsed.events,
        routeTimeline: routeTimeline || null,
        routeStops: routeTimeline?.stops || parsed.events.map((ev, index) => ({
            stationName: ev.station,
            stationCode: ev.code,
            order: index + 1,
            passed: true,
            current: index === parsed.events.length - 1,
            type: ev.type,
            delay: ev.delay
        })),
        expectedArrival: null,
        expectedDeparture: null
    };
}

async function getLiveStatus(trainNumber, journeyDate) {
    const html = await fetchTrainStatusHtml(trainNumber, journeyDate);
    const parsed = parseTrainStatusHtml(html);
    const routeTimeline = parseTrainRouteHtml(html);
    const hasTimeline = routeTimeline?.stops?.length > 0;
    const hasSummary = parsed.events.length || parsed.currentPosition || parsed.trainName;

    if (!hasTimeline && !hasSummary) {
        throw new NtesError('No live running status returned from NTES for this train/date', 404);
    }

    return mapParsedToLiveStatus(parsed, trainNumber, {}, hasTimeline ? routeTimeline : null);
}

module.exports = {
    NtesError,
    todayNtesDate,
    formatNtesDate,
    fetchTrainStatusHtml,
    parseTrainStatusHtml,
    parseTrainRouteHtml,
    parseTimeColumn,
    mapParsedToLiveStatus,
    getLiveStatus
};
