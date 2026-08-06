/**
 * Import individual Wikipedia train pages for full routes + exact coach counts.
 * Seat totals = Wikipedia coach count × IR per-coach capacity (LHB/ICF).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getPool } = require('../connection');
const { fetchTrainPage } = require('./wikipediaApiClient');
const { parseWikipediaTrainPage } = require('./wikipediaTrainPageParser');
const { buildStationLookup, resolveStationName } = require('./wikipediaStationResolver');
const {
    normalizeName, normalizeTrainNumber, inferTrainTypeCode, parseRunningDaysField
} = require('./normalizers');
const {
    getBerthsPerCoach, inferCoachBuild, setWikiRakeCounts, saveWikiRakeCounts
} = require('../../backend/utils/coachCapacity');

const SOURCE = {
    name: 'Wikipedia — Individual train articles',
    url: 'https://en.wikipedia.org/wiki/Puri%E2%80%93Howrah_Express',
    publisher: 'Wikipedia contributors (CC BY-SA 4.0)',
    licenseNotes: 'Route/coach prose from Wikipedia articles — NOT official IRCTC timetable. Coach seat totals use IR per-coach capacity × wiki coach counts.',
    completeness: 'PARTIAL — major stops from routing section; times interpolated between origin/destination'
};

const WIKI_RAKE_PATH = path.join(__dirname, '../data/railway/processed/wiki-rake-counts.json');
const DEFAULT_MANIFEST = path.join(__dirname, '../data/railway/wiki-train-pages.manifest.json');

class WikipediaTrainPageImporter {
    constructor(options = {}) {
        this.manifestPath = options.manifestPath || DEFAULT_MANIFEST;
        this.useCache = options.useCache !== false;
        this.overwriteStops = options.overwriteStops !== false;
        this.report = {
            source: SOURCE.name,
            importedAt: new Date().toISOString(),
            pagesFetched: 0,
            trainsProcessed: 0,
            inserted: 0,
            updated: 0,
            skipped: 0,
            stopsImported: 0,
            classesUpdated: 0,
            rakeCountsSaved: 0,
            errors: [],
            warnings: []
        };
        this.wikiRakeCounts = this.loadExistingRakeCounts();
    }

    loadExistingRakeCounts() {
        if (fs.existsSync(WIKI_RAKE_PATH)) {
            try {
                return JSON.parse(fs.readFileSync(WIKI_RAKE_PATH, 'utf8'));
            } catch {
                return {};
            }
        }
        return {};
    }

    loadManifest() {
        if (!fs.existsSync(this.manifestPath)) {
            return { pages: [{ pageTitle: 'Puri–Howrah Express', trainNumbers: ['12837', '12838'] }] };
        }
        return JSON.parse(fs.readFileSync(this.manifestPath, 'utf8'));
    }

    track(field) {
        this.report[field] = (this.report[field] || 0) + 1;
    }

    computeClassCapacity(classCode, coachCount, trainName, trainTypeCode, coachBuild) {
        const build = coachBuild || inferCoachBuild(trainName, trainTypeCode);
        return coachCount * getBerthsPerCoach(classCode, build);
    }

    async recordImportSource() {
        const pool = await getPool();
        const hash = crypto.createHash('sha256').update(SOURCE.name).digest('hex').slice(0, 32);
        const result = await pool.request()
            .input('sourceName', 'NVarChar', SOURCE.name)
            .input('sourceUrl', 'NVarChar', SOURCE.url)
            .input('publisher', 'NVarChar', SOURCE.publisher)
            .input('licenseNotes', 'NVarChar', SOURCE.licenseNotes)
            .input('fileHash', 'NVarChar', hash)
            .query(`INSERT INTO DataImportSources (sourceName, sourceUrl, publisher, licenseNotes, fileHash, status, notes)
                    OUTPUT INSERTED.id VALUES (@sourceName, @sourceUrl, @publisher, @licenseNotes, @fileHash, 'InProgress',
                    'Wikipedia individual train pages — CC BY-SA')`);
        return result.recordset[0].id;
    }

    async loadTrainTypeMap() {
        const pool = await getPool();
        const result = await pool.request().query('SELECT id, code FROM TrainTypes');
        const map = new Map();
        for (const row of result.recordset) map.set(row.code, row.id);
        return map;
    }

    async findTrainByNumber(trainNumber) {
        const pool = await getPool();
        const tn = normalizeTrainNumber(trainNumber);
        const result = await pool.request()
            .input('trainNumber', 'NVarChar', tn)
            .query('SELECT id, trainNumber, trainName, source, destination FROM Trains WHERE trainNumber = @trainNumber');
        return result.recordset[0] || null;
    }

    async upsertRunningDays(trainId, runningDaysLabel) {
        const days = parseRunningDaysField(runningDaysLabel);
        if (!days.length) return;
        const pool = await getPool();
        for (const dayOfWeek of days) {
            const existing = await pool.request()
                .input('trainId', 'Int', trainId)
                .input('dayOfWeek', 'Int', dayOfWeek)
                .query('SELECT id FROM TrainRunningDays WHERE trainId = @trainId AND dayOfWeek = @dayOfWeek');
            if (existing.recordset[0]) {
                await pool.request().input('id', 'Int', existing.recordset[0].id)
                    .query('UPDATE TrainRunningDays SET runs = 1 WHERE id = @id');
            } else {
                await pool.request()
                    .input('trainId', 'Int', trainId)
                    .input('dayOfWeek', 'Int', dayOfWeek)
                    .query('INSERT INTO TrainRunningDays (trainId, dayOfWeek, runs) VALUES (@trainId, @dayOfWeek, 1)');
            }
        }
    }

    async upsertTrainClasses(trainId, parsedTrain) {
        const pool = await getPool();
        const trainName = normalizeName(parsedTrain.trainName);
        const typeCode = inferTrainTypeCode(trainName);
        const classNames = {
            '1A': 'AC First Class', '2A': 'AC 2 Tier', '3A': 'AC 3 Tier', '3E': 'AC 3 Economy',
            CC: 'Chair Car', EC: 'Executive Chair Car', SL: 'Sleeper', '2S': 'Second Sitting',
            EA: 'Anubhuti Executive', GS: 'General Unreserved'
        };

        const classCodes = parsedTrain.classes?.length
            ? parsedTrain.classes
            : Object.keys(parsedTrain.coachCounts || {});

        for (const classCode of classCodes) {
            const coachCount = parsedTrain.coachCounts?.[classCode];
            if (!coachCount) continue;

            const totalSeats = this.computeClassCapacity(
                classCode,
                coachCount,
                trainName,
                typeCode,
                parsedTrain.coachBuild
            );

            const existing = await pool.request()
                .input('trainId', 'Int', trainId)
                .input('classCode', 'NVarChar', classCode)
                .query('SELECT id FROM TrainClasses WHERE trainId = @trainId AND classCode = @classCode');

            if (existing.recordset[0]) {
                await pool.request()
                    .input('id', 'Int', existing.recordset[0].id)
                    .input('totalSeats', 'Int', totalSeats)
                    .input('availableSeats', 'Int', totalSeats)
                    .query(`UPDATE TrainClasses SET totalSeats = @totalSeats, availableSeats = @availableSeats,
                            isAvailable = 1, updatedAt = SYSUTCDATETIME() WHERE id = @id`);
            } else {
                await pool.request()
                    .input('trainId', 'Int', trainId)
                    .input('classCode', 'NVarChar', classCode)
                    .input('className', 'NVarChar', classNames[classCode] || classCode)
                    .input('price', 'Decimal', 500)
                    .input('totalSeats', 'Int', totalSeats)
                    .input('availableSeats', 'Int', totalSeats)
                    .query(`INSERT INTO TrainClasses (trainId, classCode, className, price, totalSeats, availableSeats, isAvailable)
                            VALUES (@trainId, @classCode, @className, @price, @totalSeats, @availableSeats, 1)`);
            }
            this.track('classesUpdated');
        }

        this.wikiRakeCounts[normalizeTrainNumber(parsedTrain.trainNumber)] = {
            ...parsedTrain.coachCounts,
            _coachBuild: parsedTrain.coachBuild,
            _source: 'wikipedia'
        };
        this.track('rakeCountsSaved');
    }

    async importStops(trainId, parsedTrain, stationLookup) {
        if (!parsedTrain.stops?.length) return;

        const pool = await getPool();
        const existing = await pool.request()
            .input('trainId', 'Int', trainId)
            .query('SELECT COUNT(*) AS cnt FROM TrainStops WHERE trainId = @trainId');
        const existingCount = Number(existing.recordset[0]?.cnt || 0);

        if (existingCount > parsedTrain.stops.length && !this.overwriteStops) {
            this.report.warnings.push(`${parsedTrain.trainNumber}: kept ${existingCount} existing stops (DataMeet)`);
            return;
        }

        await pool.request().input('trainId', 'Int', trainId)
            .query('DELETE FROM TrainStops WHERE trainId = @trainId');

        let imported = 0;
        for (const stop of parsedTrain.stops) {
            const station = resolveStationName(stop.stationName, stationLookup);
            if (!station) {
                this.report.warnings.push(`${parsedTrain.trainNumber}: unresolved stop "${stop.stationName}"`);
                continue;
            }

            await pool.request()
                .input('trainId', 'Int', trainId)
                .input('stationId', 'Int', station.id)
                .input('stationCode', 'NVarChar', station.code)
                .input('stationName', 'NVarChar', station.name)
                .input('stopOrder', 'Int', stop.stopOrder)
                .input('arrivalTime', 'NVarChar', stop.arrivalTime)
                .input('departureTime', 'NVarChar', stop.departureTime)
                .input('arrivalDayOffset', 'Int', stop.arrivalDayOffset || 0)
                .input('departureDayOffset', 'Int', stop.departureDayOffset || 0)
                .input('haltMinutes', 'Int', stop.haltMinutes || 0)
                .query(`INSERT INTO TrainStops (trainId, stationId, stationCode, stationName, stopOrder,
                        arrivalTime, departureTime, arrivalDayOffset, departureDayOffset, haltMinutes)
                        VALUES (@trainId, @stationId, @stationCode, @stationName, @stopOrder,
                        @arrivalTime, @departureTime, @arrivalDayOffset, @departureDayOffset, @haltMinutes)`);
            imported += 1;
        }
        this.report.stopsImported += imported;
    }

    async upsertTrain(parsedTrain, sourceId, stationLookup, typeMap) {
        const pool = await getPool();
        const trainNumber = normalizeTrainNumber(parsedTrain.trainNumber);
        const trainName = normalizeName(parsedTrain.trainName);
        const typeCode = inferTrainTypeCode(trainName);
        const trainTypeId = typeMap.get(typeCode) || null;

        const origin = resolveStationName(parsedTrain.originName, stationLookup);
        const destination = resolveStationName(parsedTrain.destinationName, stationLookup);
        const firstStop = parsedTrain.stops?.[0];
        const lastStop = parsedTrain.stops?.[parsedTrain.stops.length - 1];

        const departureTime = firstStop?.departureTime || parsedTrain.service?.departureTime || '06:00';
        const arrivalTime = lastStop?.arrivalTime || parsedTrain.service?.arrivalTime || '18:00';
        const runningDays = parsedTrain.runningDays || 'Daily';

        const existing = await this.findTrainByNumber(trainNumber);

        if (existing) {
            await pool.request()
                .input('id', 'Int', existing.id)
                .input('trainName', 'NVarChar', trainName)
                .input('normalizedName', 'NVarChar', trainName.toLowerCase())
                .input('source', 'NVarChar', origin?.name || parsedTrain.originName)
                .input('destination', 'NVarChar', destination?.name || parsedTrain.destinationName)
                .input('departureTime', 'NVarChar', departureTime)
                .input('arrivalTime', 'NVarChar', arrivalTime)
                .input('duration', 'NVarChar', parsedTrain.duration || existing.duration)
                .input('distance', 'Int', parsedTrain.distanceKm || existing.distance || 500)
                .input('runningDays', 'NVarChar', runningDays)
                .input('sourceStationId', 'Int', origin?.id || null)
                .input('destinationStationId', 'Int', destination?.id || null)
                .input('trainTypeId', 'Int', trainTypeId)
                .input('dataSourceId', 'Int', sourceId)
                .query(`UPDATE Trains SET trainName = @trainName, normalizedName = @normalizedName,
                        source = @source, destination = @destination, departureTime = @departureTime,
                        arrivalTime = @arrivalTime, duration = @duration, distance = @distance,
                        runningDays = @runningDays, sourceStationId = @sourceStationId,
                        destinationStationId = @destinationStationId, trainTypeId = @trainTypeId,
                        dataSourceId = @dataSourceId, isActive = 1, updatedAt = SYSUTCDATETIME()
                        WHERE id = @id`);
            await this.importStops(existing.id, parsedTrain, stationLookup);
            await this.upsertTrainClasses(existing.id, parsedTrain);
            await this.upsertRunningDays(existing.id, runningDays);
            this.track('updated');
            return existing.id;
        }

        const inserted = await pool.request()
            .input('trainNumber', 'NVarChar', trainNumber)
            .input('trainName', 'NVarChar', trainName)
            .input('normalizedName', 'NVarChar', trainName.toLowerCase())
            .input('source', 'NVarChar', origin?.name || parsedTrain.originName)
            .input('destination', 'NVarChar', destination?.name || parsedTrain.destinationName)
            .input('departureTime', 'NVarChar', departureTime)
            .input('arrivalTime', 'NVarChar', arrivalTime)
            .input('duration', 'NVarChar', parsedTrain.duration || '8h 30m')
            .input('distance', 'Int', parsedTrain.distanceKm || 502)
            .input('availableSeats', 'Int', 1400)
            .input('price', 'Decimal', 800)
            .input('journeyDate', 'Date', new Date().toISOString().split('T')[0])
            .input('runningDays', 'NVarChar', runningDays)
            .input('sourceStationId', 'Int', origin?.id || null)
            .input('destinationStationId', 'Int', destination?.id || null)
            .input('trainTypeId', 'Int', trainTypeId)
            .input('dataSourceId', 'Int', sourceId)
            .query(`INSERT INTO Trains (trainNumber, trainName, normalizedName, source, destination,
                    departureTime, arrivalTime, duration, distance, availableSeats, price, journeyDate,
                    runningDays, sourceStationId, destinationStationId, trainTypeId, dataSourceId, isActive)
                    OUTPUT INSERTED.id
                    VALUES (@trainNumber, @trainName, @normalizedName, @source, @destination,
                    @departureTime, @arrivalTime, @duration, @distance, @availableSeats, @price, @journeyDate,
                    @runningDays, @sourceStationId, @destinationStationId, @trainTypeId, @dataSourceId, 1)`);

        const trainId = inserted.recordset[0].id;
        await this.importStops(trainId, parsedTrain, stationLookup);
        await this.upsertTrainClasses(trainId, parsedTrain);
        await this.upsertRunningDays(trainId, runningDays);
        this.track('inserted');
        return trainId;
    }

    async importPage(entry) {
        const page = await fetchTrainPage({
            pageTitle: entry.pageTitle,
            trainNumber: entry.trainNumbers?.[0],
            searchQuery: entry.searchQuery
        });
        this.track('pagesFetched');

        const parsed = parseWikipediaTrainPage(page.wikitext, {
            trainNumber: entry.trainNumbers?.[0],
            fallbackName: entry.pageTitle
        });

        const pool = await getPool();
        const stations = await pool.request().query('SELECT id, code, name, city FROM Stations WHERE isActive = 1');
        const stationLookup = buildStationLookup(stations.recordset);
        const typeMap = await this.loadTrainTypeMap();
        const sourceId = await this.recordImportSource();

        const targetNumbers = new Set((entry.trainNumbers || []).map(normalizeTrainNumber));
        const trains = parsed.trains.filter((t) => !targetNumbers.size || targetNumbers.has(normalizeTrainNumber(t.trainNumber)));

        for (const train of trains) {
            try {
                await this.upsertTrain(train, sourceId, stationLookup, typeMap);
                this.track('trainsProcessed');
            } catch (err) {
                this.report.errors.push({ train: train.trainNumber, msg: err.message });
            }
        }

        await pool.request()
            .input('id', 'Int', sourceId)
            .input('recordCount', 'Int', trains.length)
            .query(`UPDATE DataImportSources SET status = 'Success', recordCount = @recordCount, importedAt = SYSUTCDATETIME()
                    WHERE id = @id`);
    }

    persistRakeCounts() {
        fs.mkdirSync(path.dirname(WIKI_RAKE_PATH), { recursive: true });
        fs.writeFileSync(WIKI_RAKE_PATH, JSON.stringify(this.wikiRakeCounts, null, 2));
        setWikiRakeCounts(this.wikiRakeCounts);
        saveWikiRakeCounts(this.wikiRakeCounts);
    }

    async run() {
        const manifest = this.loadManifest();
        const pages = manifest.pages || [];

        for (const entry of pages) {
            try {
                await this.importPage(entry);
            } catch (err) {
                this.report.errors.push({ page: entry.pageTitle || entry.searchQuery, msg: err.message });
            }
        }

        this.persistRakeCounts();

        const reportPath = path.join(__dirname, '../data/railway/WikipediaTrainPageImportReport.json');
        fs.writeFileSync(reportPath, JSON.stringify(this.report, null, 2));
        return this.report;
    }
}

module.exports = WikipediaTrainPageImporter;
