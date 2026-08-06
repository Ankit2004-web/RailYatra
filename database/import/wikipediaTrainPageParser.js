/**
 * Parse individual Wikipedia train article wikitext (infobox, coaches, routing, service).
 */
const { normalizeName, normalizeTime, normalizeTrainNumber } = require('./normalizers');

const CLASS_LINE_PATTERNS = [
    { re: /ac\s*first\s*class|first\s*ac|\b1a\b/i, code: '1A' },
    { re: /ac\s*2\s*tier|second\s*ac|\b2a\b/i, code: '2A' },
    { re: /ac\s*3\s*tier\s*econ|3\s*tier\s*econ|\b3e\b/i, code: '3E' },
    { re: /ac\s*3\s*tier|third\s*ac|\b3a\b/i, code: '3A' },
    { re: /anubhuti|\bea\b/i, code: 'EA' },
    { re: /executive\s*chair|\bec\b/i, code: 'EC' },
    { re: /ac\s*chair|\bchair\s*car\b|\bcc\b/i, code: 'CC' },
    { re: /sleeper\s*class|\bsleeper\b|\bsl\b/i, code: 'SL' },
    { re: /second\s*sitt|\b2s\b/i, code: '2S' },
    { re: /unreserved|general|\bgs\b|\bur\b/i, code: 'GS' }
];

const UTILITY_COACH = /^(slr|generator|pantry|eog|guard|parcel|power)/i;

function extractInfoboxField(wikitext, field) {
    const re = new RegExp(`\\|\\s*${field}\\s*=\\s*(.+?)(?:\\n\\||\\n\\}\\})`, 'is');
    const match = wikitext.match(re);
    return match ? match[1].trim() : null;
}

function parseStnlnk(value) {
    if (!value) return null;
    const m = value.match(/\{\{stnlnk\|([^}|]+)/i);
    return m ? normalizeName(m[1]) : normalizeName(value.replace(/\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g, '$1'));
}

function parseTrainNumbers(raw) {
    if (!raw) return [];
    return [...raw.matchAll(/\b(\d{5})\b/g)].map((m) => normalizeTrainNumber(m[1]));
}

function parseDistanceKm(raw) {
    if (!raw) return null;
    const m = raw.match(/\{\{convert\|(\d+)/i) || raw.match(/(\d+)\s*km/i);
    return m ? parseInt(m[1], 10) : null;
}

function parseDuration(raw) {
    if (!raw) return null;
    const h = raw.match(/(\d+)\s*hours?\s*(\d+)?\s*mins?/i);
    if (h) return `${h[1]}h ${h[2] || '0'}m`;
    const hm = raw.match(/(\d{1,2}):(\d{2})/);
    if (hm) return `${hm[1]}h ${hm[2]}m`;
    return null;
}

function parseClassesFromInfobox(raw) {
    if (!raw) return [];
    const found = new Set();
    for (const { re, code } of CLASS_LINE_PATTERNS) {
        if (re.test(raw)) found.add(code);
    }
    return [...found];
}

function mapCoachLineToClass(description) {
    const text = description.toLowerCase();
    for (const { re, code } of CLASS_LINE_PATTERNS) {
        if (re.test(text)) return code;
    }
    return null;
}

function parseCoachComposition(wikitext) {
    const section = wikitext.match(/==\s*Coaches\s*==([\s\S]*?)(?:==|$)/i);
    if (!section) return { coachCounts: {}, classes: [] };

    const coachCounts = {};
    const lines = section[1].split('\n');
    for (const line of lines) {
        const bullet = line.match(/^\*\s*(\d+)\s+(.+)$/i);
        if (!bullet) continue;
        const count = parseInt(bullet[1], 10);
        const desc = bullet[2].replace(/\([^)]*\)/g, '').trim();
        if (UTILITY_COACH.test(desc)) continue;
        const classCode = mapCoachLineToClass(desc);
        if (!classCode) continue;
        coachCounts[classCode] = (coachCounts[classCode] || 0) + count;
    }

    return { coachCounts, classes: Object.keys(coachCounts) };
}

function parseRoutingStations(wikitext) {
    const section = wikitext.match(/==\s*Route(?:ing| and schedule)?\s*==([\s\S]*?)(?:==|$)/i);
    const text = section ? section[1] : wikitext;
    const stations = [];
    const seen = new Set();

    const add = (name) => {
        const n = normalizeName(name);
        if (!n) return;
        const key = n.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        stations.push(n);
    };

    const prose = text.match(/\bfrom\s+([^,\n]+?)\s+via\s+([^.\n]+?)\s+to\s+([^.\n\[]+)/i);
    if (prose) {
        add(prose[1]);
        for (const m of prose[2].matchAll(/\{\{stnlnk\|([^}|]+)/gi)) add(m[1]);
        prose[2].split(/,\s*/).forEach((part) => {
            if (!part.includes('stnlnk')) add(part.replace(/\[\[([^|\]]+).*/, '$1'));
        });
        add(prose[3]);
        return stations;
    }

    for (const m of text.matchAll(/\{\{stnlnk\|([^}|]+)/gi)) add(m[1]);
    return stations;
}

function stationMatches(a, b) {
    const x = aliasKey(a);
    const y = aliasKey(b);
    return x.includes(y) || y.includes(x);
}

function aliasKey(name) {
    return normalizeName(name).toLowerCase();
}

function parse12HourTime(raw) {
    if (!raw) return null;
    const m = raw.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!m) return normalizeTime(raw);
    let hour = parseInt(m[1], 10);
    const min = m[2];
    const ampm = (m[3] || '').toUpperCase();
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${min}`;
}

function parseServiceForTrain(wikitext, trainNumber) {
    const section = wikitext.match(/==\s*Service\s*==([\s\S]*?)(?:==|$)/i);
    const text = section ? section[1] : wikitext;
    const tn = normalizeTrainNumber(trainNumber);
    const re = new RegExp(
        `${tn}\\s+departs\\s+([^\\d]+?)\\s+at\\s+([\\d:]+\\s*(?:AM|PM)?)\\s+and\\s+arrives\\s+([^\\d]+?)\\s+at\\s+([\\d:]+\\s*(?:AM|PM)?)`,
        'i'
    );
    const m = text.match(re);
    if (!m) return null;

    const dep = parse12HourTime(m[2]);
    const arr = parse12HourTime(m[4]);
    const depHour = dep ? parseInt(dep.split(':')[0], 10) : 0;
    const arrHour = arr ? parseInt(arr.split(':')[0], 10) : 0;
    let arrivalDayOffset = 0;
    if (/next day|following day/i.test(text.slice(m.index, m.index + 200))) {
        arrivalDayOffset = 1;
    } else if (dep && arr && arrHour < depHour) {
        arrivalDayOffset = 1;
    }

    return {
        originName: normalizeName(m[1]),
        destinationName: normalizeName(m[3]),
        departureTime: dep,
        arrivalTime: arr,
        departureDayOffset: 0,
        arrivalDayOffset
    };
}

function inferCoachBuild(stockText, trainName) {
    const combined = `${stockText || ''} ${trainName || ''}`;
    if (/lhb|linke hofmann/i.test(combined)) return 'LHB';
    if (/icf/i.test(combined)) return 'ICF';
    return 'LHB';
}

function buildRouteStations({ routingStations, service, trainNumbers, primaryTrainNumber }) {
    const numbers = trainNumbers.length ? trainNumbers : [primaryTrainNumber].filter(Boolean);
    const tn = normalizeTrainNumber(primaryTrainNumber);
    const idx = numbers.indexOf(tn);
    const isReverse = idx > 0;

    let stops = routingStations.length
        ? [...routingStations]
        : [service?.originName, service?.destinationName].filter(Boolean);

    if (service?.originName && !stops.some((s) => stationMatches(s, service.originName))) {
        stops.unshift(service.originName);
    }
    if (service?.destinationName && !stops.some((s) => stationMatches(s, service.destinationName))) {
        stops.push(service.destinationName);
    }

    if (isReverse && stops.length > 1) {
        stops = [...stops].reverse();
    }

    const deduped = [];
    const seen = new Set();
    for (const stop of stops) {
        const key = aliasKey(stop);
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(stop);
    }
    return deduped;
}

function distributeStopTimes(stops, service) {
    if (!service?.departureTime || !service?.arrivalTime || stops.length < 2) {
        return stops.map((name, i) => ({
            stationName: name,
            stopOrder: i + 1,
            arrivalTime: i === 0 ? null : service?.arrivalTime || null,
            departureTime: i === stops.length - 1 ? null : service?.departureTime || null,
            arrivalDayOffset: i === 0 ? 0 : service?.arrivalDayOffset || 0,
            departureDayOffset: 0,
            haltMinutes: i === 0 || i === stops.length - 1 ? 0 : 5
        }));
    }

    const depParts = service.departureTime.split(':').map(Number);
    const arrParts = service.arrivalTime.split(':').map(Number);
    let depMin = depParts[0] * 60 + depParts[1];
    let arrMin = arrParts[0] * 60 + arrParts[1] + (service.arrivalDayOffset || 0) * 24 * 60;
    if (arrMin <= depMin) arrMin += 24 * 60;

    const total = arrMin - depMin;
    const step = total / Math.max(stops.length - 1, 1);

    return stops.map((name, i) => {
        const tMin = depMin + step * i;
        const dayOffset = Math.floor(tMin / (24 * 60));
        const mins = tMin % (24 * 60);
        const time = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
        return {
            stationName: name,
            stopOrder: i + 1,
            arrivalTime: i === 0 ? null : time,
            departureTime: i === stops.length - 1 ? null : (i === 0 ? service.departureTime : time),
            arrivalDayOffset: i === 0 ? 0 : dayOffset,
            departureDayOffset: i === 0 ? 0 : dayOffset,
            haltMinutes: i === 0 || i === stops.length - 1 ? 0 : 5
        };
    });
}

function parseWikipediaTrainPage(wikitext, options = {}) {
    const primaryTrainNumber = normalizeTrainNumber(options.trainNumber);
    const infobox = {
        name: extractInfoboxField(wikitext, 'name'),
        trainNumbers: parseTrainNumbers(extractInfoboxField(wikitext, 'trainnumber')),
        start: parseStnlnk(extractInfoboxField(wikitext, 'start')),
        end: parseStnlnk(extractInfoboxField(wikitext, 'end')),
        distanceKm: parseDistanceKm(extractInfoboxField(wikitext, 'distance')),
        duration: parseDuration(extractInfoboxField(wikitext, 'journeytime')),
        frequency: extractInfoboxField(wikitext, 'frequency'),
        stock: extractInfoboxField(wikitext, 'stock'),
        stopCount: parseInt(extractInfoboxField(wikitext, 'stops') || '0', 10) || null,
        classes: parseClassesFromInfobox(extractInfoboxField(wikitext, 'class'))
    };

    const { coachCounts, classes: coachClasses } = parseCoachComposition(wikitext);
    const routingStations = parseRoutingStations(wikitext);
    const trainNumbers = infobox.trainNumbers.length
        ? infobox.trainNumbers
        : [primaryTrainNumber].filter(Boolean);

    const trains = trainNumbers.map((tn) => {
        const service = parseServiceForTrain(wikitext, tn);
        const routeStations = buildRouteStations({
            routingStations,
            service,
            trainNumbers,
            primaryTrainNumber: tn
        });
        const stops = distributeStopTimes(routeStations, service);
        const origin = service?.originName || routeStations[0] || infobox.start;
        const destination = service?.destinationName || routeStations[routeStations.length - 1] || infobox.end;

        return {
            trainNumber: tn,
            trainName: infobox.name || options.fallbackName || `${origin} ${destination} Express`,
            originName: origin,
            destinationName: destination,
            distanceKm: infobox.distanceKm,
            duration: infobox.duration,
            runningDays: infobox.frequency || 'Daily',
            coachBuild: inferCoachBuild(infobox.stock, infobox.name),
            coachCounts,
            classes: [...new Set([...infobox.classes, ...coachClasses])],
            stops,
            service
        };
    });

    return { infobox, trains, coachCounts, source: 'wikipedia_train_page' };
}

module.exports = {
    parseWikipediaTrainPage,
    parseCoachComposition,
    parseRoutingStations,
    parseServiceForTrain,
    mapCoachLineToClass
};
