/**
 * Parse Wikipedia "List of trains run by Indian Railways" markdown export.
 * https://en.wikipedia.org/wiki/List_of_trains_run_by_Indian_Railways
 *
 * Note: the list page has train names only — no official train numbers, schedules,
 * or per-coach rake sheets. Routes are parsed from "Source–Destination" titles;
 * classes/coaches are inferred from IR naming conventions.
 */
const fs = require('fs');

const TRAIN_TYPE_SUFFIX = /\s+(AC\s+)?(Superfast\s+)?(Express|Mail|Passenger|Intercity\s+Express|DEMU|MEMU|Special|Fast\s+Passenger|Teerth\s+Express|Humsafar\s+Express|Garib\s+Rath\s+Express|Garib\s+Nawaz\s+Express|Shatabdi\s+Express|Rajdhani\s+Express|Duronto\s+Express|Yuva\s+Express|Double\s+Decker\s+Express|SF\s+Express|Weekly\s+Express|Daily\s+Express|Superfast\s+Express|Super\s+Fast\s+Express|Superfast|Express)$/i;

function normalizeMatchKey(name) {
    return String(name || '')
        .toLowerCase()
        .replace(/[\u2013\u2014–—]/g, '-')
        .replace(/[^\w\s-]/g, ' ')
        .replace(/\b(via|weekly|daily|superfast|express|mail|passenger|intercity|special|demux|memu)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function parseRouteFromName(name) {
    const dashMatch = String(name).match(/^(.+?)\s*[\u2013\u2014–—\-]\s*(.+)$/);
    if (!dashMatch) return null;

    let source = dashMatch[1].trim().replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
    let destination = dashMatch[2].trim();

    destination = destination.replace(TRAIN_TYPE_SUFFIX, '').trim();
    destination = destination.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();

    if (!source || !destination || source.length < 3 || destination.length < 3) {
        return null;
    }

    return { source, destination };
}

function inferRunningDaysLabel(name) {
    const text = String(name);
    if (/weekly/i.test(text)) return null;
    if (/daily/i.test(text)) return 'Daily';
    if (/rajdhani|shatabdi|mail|intercity|passenger|demux|memu/i.test(text)) return 'Daily';
    if (/express|superfast|humsafar|duronto|garib rath|tejas|vande bharat/i.test(text)) return 'Daily';
    return null;
}

function parseWikipediaTrainList(markdown) {
    const lines = String(markdown).split(/\r?\n/);
    const trains = [];
    const seen = new Set();
    let inNotableSection = false;

    for (const line of lines) {
        if (/^###\s+Notable Names/i.test(line)) {
            inNotableSection = true;
            continue;
        }
        if (/^##\s+[A-Z#]/i.test(line)) {
            inNotableSection = false;
        }

        const bullet = line.match(/^\*\s+(.+?)\s*$/);
        if (!bullet) continue;

        const rawName = bullet[1].replace(/\[[^\]]*\]/g, '').trim();
        if (!rawName || rawName.length < 4) continue;

        const matchKey = normalizeMatchKey(rawName);
        if (!matchKey || seen.has(matchKey)) continue;
        seen.add(matchKey);

        const route = parseRouteFromName(rawName);
        trains.push({
            trainName: rawName,
            matchKey,
            sourceName: route?.source || null,
            destinationName: route?.destination || null,
            hasExplicitRoute: Boolean(route),
            isNotableAlias: inNotableSection,
            runningDays: inferRunningDaysLabel(rawName),
            source: 'wikipedia_list'
        });
    }

    return trains;
}

function parseWikipediaTrainListFile(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Wikipedia list file not found: ${filePath}`);
    }
    return parseWikipediaTrainList(fs.readFileSync(filePath, 'utf8'));
}

module.exports = {
    parseWikipediaTrainList,
    parseWikipediaTrainListFile,
    parseRouteFromName,
    normalizeMatchKey,
    inferRunningDaysLabel
};
