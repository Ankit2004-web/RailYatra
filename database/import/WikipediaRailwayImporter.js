/**
 * Enriches / adds trains from Wikipedia's list page.
 * https://en.wikipedia.org/wiki/List_of_trains_run_by_Indian_Railways
 *
 * Strategy:
 * 1. Match Wikipedia names to existing DataMeet trains (by normalized name) → update metadata
 * 2. Insert new wiki-only trains (97xxx numbers) when route + stations resolve
 * 3. Infer coach classes from train category (Rajdhani, Shatabdi, Express, etc.)
 * 4. Create boarding/drop stops for wiki-only trains; keep DataMeet schedules when matched
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getPool } = require('../connection');
const { parseWikipediaTrainListFile, normalizeMatchKey } = require('./wikipediaTrainParser');
const { buildStationLookup, resolveStationName } = require('./wikipediaStationResolver');
const {
    normalizeName, normalizeTrainNumber, inferTrainTypeCode, parseRunningDaysField
} = require('./normalizers');
const { inferTrainCategory, getClassCapacity } = require('../../backend/utils/coachCapacity');

const SOURCE = {
    name: 'Wikipedia — List of trains run by Indian Railways',
    url: 'https://en.wikipedia.org/wiki/List_of_trains_run_by_Indian_Railways',
    publisher: 'Wikipedia contributors (CC BY-SA 4.0)',
    licenseNotes: 'Name list only — routes parsed from titles; coach counts inferred from IR conventions; NOT official IRCTC timetable.',
    completeness: 'PARTIAL — no train numbers/schedules on list page; matched to existing DB where possible'
};

const WIKI_TRAIN_NUMBER_START = 97001;

class WikipediaRailwayImporter {
    constructor(options = {}) {
        this.listPath = options.listPath || path.join(__dirname, '../data/railway/raw/wikipedia-trains-list.md');
        this.deactivateOthers = false;
        this.nextWikiTrainNumber = WIKI_TRAIN_NUMBER_START;
        this.report = {
            source: SOURCE.name,
            importedAt: new Date().toISOString(),
            sourceMeta: SOURCE,
            parsed: 0,
            matchedExisting: 0,
            inserted: 0,
            updated: 0,
            skipped: 0,
            failed: 0,
            classesUpserted: 0,
            stopsCreated: 0,
            runningDaysUpserted: 0,
            errors: [],
            warnings: [
                'Wikipedia list has names only — train numbers/schedules come from DataMeet match or wiki 97xxx stubs',
                'Coach composition is inferred from train category (Rajdhani/Shatabdi/Express etc.), not official COA'
            ]
        };
    }

    track(field) {
        this.report[field] = (this.report[field] || 0) + 1;
    }

    inferClasses(trainName, trainTypeCode) {
        const category = inferTrainCategory(trainName, trainTypeCode);
        const templates = {
            rajdhani: ['1A', '2A', '3A'],
            duronto: ['1A', '2A', '3A'],
            shatabdi: ['CC', 'EC'],
            vandeBharat: ['CC', 'EC'],
            garibRath: ['3E'],
            anubhuthi: ['EA', 'CC'],
            passenger: ['2S', 'SL'],
            superfast: ['SL', '3A', '2A', '2S'],
            express: ['SL', '3A', '2A', '2S'],
            default: ['SL', '3A', '2A']
        };
        return templates[category] || templates.default;
    }

    async recordImportSource(fileHash) {
        const pool = await getPool();
        const result = await pool.request()
            .input('sourceName', 'NVarChar', SOURCE.name)
            .input('sourceUrl', 'NVarChar', SOURCE.url)
            .input('publisher', 'NVarChar', SOURCE.publisher)
            .input('licenseNotes', 'NVarChar', SOURCE.licenseNotes)
            .input('fileHash', 'NVarChar', fileHash)
            .query(`INSERT INTO DataImportSources (sourceName, sourceUrl, publisher, licenseNotes, fileHash, status, notes)
                    OUTPUT INSERTED.id
                    VALUES (@sourceName, @sourceUrl, @publisher, @licenseNotes, @fileHash, 'InProgress',
                    'Wikipedia name list enrichment — CC BY-SA')`);
        return result.recordset[0].id;
    }

    async loadExistingTrains() {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT id, trainNumber, trainName, source, destination, sourceStationId, destinationStationId, runningDays
            FROM Trains WHERE isActive = 1
        `);
        const byMatchKey = new Map();
        const byNumber = new Map();
        for (const row of result.recordset) {
            byNumber.set(normalizeTrainNumber(row.trainNumber), row);
            const keys = [
                normalizeMatchKey(row.trainName),
                normalizeMatchKey(`${row.source}-${row.destination}`),
                normalizeMatchKey(`${row.source} ${row.destination}`)
            ].filter(Boolean);
            for (const key of keys) {
                if (!byMatchKey.has(key)) byMatchKey.set(key, row);
            }
        }
        return { rows: result.recordset, byMatchKey, byNumber };
    }

    async loadStations() {
        const pool = await getPool();
        const result = await pool.request().query('SELECT id, code, name, city FROM Stations WHERE isActive = 1');
        return buildStationLookup(result.recordset);
    }

    async loadTrainTypeMap() {
        const pool = await getPool();
        const result = await pool.request().query('SELECT id, code FROM TrainTypes');
        const map = new Map();
        for (const row of result.recordset) map.set(row.code, row.id);
        return map;
    }

    allocateWikiTrainNumber(usedNumbers) {
        while (usedNumbers.has(String(this.nextWikiTrainNumber))) {
            this.nextWikiTrainNumber += 1;
        }
        const num = String(this.nextWikiTrainNumber);
        usedNumbers.add(num);
        this.nextWikiTrainNumber += 1;
        return num;
    }

    findExistingMatch(wikiTrain, existing) {
        const keys = [
            wikiTrain.matchKey,
            normalizeMatchKey(wikiTrain.trainName)
        ];
        for (const key of keys) {
            if (key && existing.byMatchKey.has(key)) {
                return existing.byMatchKey.get(key);
            }
        }
        return null;
    }

    async upsertRunningDays(trainId, runningDaysLabel) {
        if (!runningDaysLabel) return;
        const days = parseRunningDaysField(runningDaysLabel);
        if (!days.length) return;

        const pool = await getPool();
        for (const dayOfWeek of days) {
            const existing = await pool.request()
                .input('trainId', 'Int', trainId)
                .input('dayOfWeek', 'Int', dayOfWeek)
                .query('SELECT id FROM TrainRunningDays WHERE trainId = @trainId AND dayOfWeek = @dayOfWeek');

            if (existing.recordset[0]) {
                await pool.request()
                    .input('id', 'Int', existing.recordset[0].id)
                    .query('UPDATE TrainRunningDays SET runs = 1 WHERE id = @id');
            } else {
                await pool.request()
                    .input('trainId', 'Int', trainId)
                    .input('dayOfWeek', 'Int', dayOfWeek)
                    .query('INSERT INTO TrainRunningDays (trainId, dayOfWeek, runs) VALUES (@trainId, @dayOfWeek, 1)');
            }
        }
        this.track('runningDaysUpserted');
    }

    async upsertTrainClasses(trainId, trainName, trainTypeCode) {
        const pool = await getPool();
        const classCodes = this.inferClasses(trainName, trainTypeCode);

        for (const classCode of classCodes) {
            const totalSeats = getClassCapacity(classCode, trainName, trainTypeCode);
            const classNames = {
                '1A': 'AC First Class', '2A': 'AC 2 Tier', '3A': 'AC 3 Tier', '3E': 'AC 3 Economy',
                CC: 'Chair Car', EC: 'Executive Chair Car', SL: 'Sleeper', '2S': 'Second Sitting', EA: 'Anubhuthi Executive'
            };

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
            this.track('classesUpserted');
        }
    }

    async ensureBoardingDropStops(trainId, sourceStation, destStation) {
        const pool = await getPool();
        const countResult = await pool.request()
            .input('trainId', 'Int', trainId)
            .query('SELECT COUNT(*) AS cnt FROM TrainStops WHERE trainId = @trainId');

        if (Number(countResult.recordset[0]?.cnt) > 0) return;

        await pool.request()
            .input('trainId', 'Int', trainId)
            .query('DELETE FROM TrainStops WHERE trainId = @trainId');

        await pool.request()
            .input('trainId', 'Int', trainId)
            .input('stationId', 'Int', sourceStation.id)
            .input('stationCode', 'NVarChar', sourceStation.code)
            .input('stationName', 'NVarChar', sourceStation.name)
            .input('stopOrder', 'Int', 1)
            .input('departureTime', 'NVarChar', '06:00')
            .query(`INSERT INTO TrainStops (trainId, stationId, stationCode, stationName, stopOrder, departureTime, departureDayOffset, haltMinutes)
                    VALUES (@trainId, @stationId, @stationCode, @stationName, @stopOrder, @departureTime, 0, 0)`);

        await pool.request()
            .input('trainId', 'Int', trainId)
            .input('stationId', 'Int', destStation.id)
            .input('stationCode', 'NVarChar', destStation.code)
            .input('stationName', 'NVarChar', destStation.name)
            .input('stopOrder', 'Int', 2)
            .input('arrivalTime', 'NVarChar', '18:00')
            .input('arrivalDayOffset', 'Int', 0)
            .query(`INSERT INTO TrainStops (trainId, stationId, stationCode, stationName, stopOrder, arrivalTime, arrivalDayOffset, haltMinutes)
                    VALUES (@trainId, @stationId, @stationCode, @stationName, @stopOrder, @arrivalTime, @arrivalDayOffset, 0)`);

        this.track('stopsCreated');
    }

    async updateExistingTrain(existing, wikiTrain, sourceId, sourceStation, destStation) {
        const pool = await getPool();
        const trainName = normalizeName(wikiTrain.trainName);
        const typeCode = inferTrainTypeCode(trainName);
        const runningDays = wikiTrain.runningDays || existing.runningDays || 'Daily';

        await pool.request()
            .input('id', 'Int', existing.id)
            .input('trainName', 'NVarChar', trainName)
            .input('normalizedName', 'NVarChar', trainName.toLowerCase())
            .input('runningDays', 'NVarChar', runningDays)
            .input('dataSourceId', 'Int', sourceId)
            .input('source', 'NVarChar', sourceStation?.name || existing.source)
            .input('destination', 'NVarChar', destStation?.name || existing.destination)
            .input('sourceStationId', 'Int', sourceStation?.id || existing.sourceStationId || null)
            .input('destinationStationId', 'Int', destStation?.id || existing.destinationStationId || null)
            .query(`UPDATE Trains SET trainName = @trainName, normalizedName = @normalizedName, runningDays = @runningDays,
                    dataSourceId = @dataSourceId, source = @source, destination = @destination,
                    sourceStationId = @sourceStationId, destinationStationId = @destinationStationId,
                    isActive = 1, updatedAt = SYSUTCDATETIME() WHERE id = @id`);

        await this.upsertTrainClasses(existing.id, trainName, typeCode);
        if (sourceStation && destStation) {
            await this.ensureBoardingDropStops(existing.id, sourceStation, destStation);
        }
        await this.upsertRunningDays(existing.id, runningDays);
        this.track('matchedExisting');
        this.track('updated');
    }

    async insertWikiTrain(wikiTrain, sourceId, sourceStation, destStation, trainNumber, typeMap) {
        const pool = await getPool();
        const trainName = normalizeName(wikiTrain.trainName);
        const typeCode = inferTrainTypeCode(trainName);
        const trainTypeId = typeMap.get(typeCode) || null;
        const runningDays = wikiTrain.runningDays || 'Daily';

        const inserted = await pool.request()
            .input('trainNumber', 'NVarChar', trainNumber)
            .input('trainName', 'NVarChar', trainName)
            .input('normalizedName', 'NVarChar', trainName.toLowerCase())
            .input('source', 'NVarChar', sourceStation.name)
            .input('destination', 'NVarChar', destStation.name)
            .input('departureTime', 'NVarChar', '06:00')
            .input('arrivalTime', 'NVarChar', '18:00')
            .input('duration', 'NVarChar', '12h 0m')
            .input('distance', 'Int', 500)
            .input('availableSeats', 'Int', 800)
            .input('price', 'Decimal', 800)
            .input('journeyDate', 'Date', new Date().toISOString().split('T')[0])
            .input('runningDays', 'NVarChar', runningDays)
            .input('sourceStationId', 'Int', sourceStation.id)
            .input('destinationStationId', 'Int', destStation.id)
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
        await this.upsertTrainClasses(trainId, trainName, typeCode);
        await this.ensureBoardingDropStops(trainId, sourceStation, destStation);
        await this.upsertRunningDays(trainId, runningDays);
        this.track('inserted');
    }

    async run() {
        const wikiTrains = parseWikipediaTrainListFile(this.listPath);
        this.report.parsed = wikiTrains.length;

        const fileHash = crypto.createHash('sha256')
            .update(fs.readFileSync(this.listPath))
            .digest('hex')
            .slice(0, 32);

        const sourceId = await this.recordImportSource(fileHash);
        const stationLookup = await this.loadStations();
        const existing = await this.loadExistingTrains();
        const typeMap = await this.loadTrainTypeMap();
        const usedNumbers = new Set([...existing.byNumber.keys()]);

        for (const wikiTrain of wikiTrains) {
            try {
                if (!wikiTrain.hasExplicitRoute && wikiTrain.isNotableAlias) {
                    this.track('skipped');
                    continue;
                }

                const sourceStation = wikiTrain.sourceName
                    ? resolveStationName(wikiTrain.sourceName, stationLookup)
                    : null;
                const destStation = wikiTrain.destinationName
                    ? resolveStationName(wikiTrain.destinationName, stationLookup)
                    : null;

                const matched = this.findExistingMatch(wikiTrain, existing);

                if (matched) {
                    await this.updateExistingTrain(matched, wikiTrain, sourceId, sourceStation, destStation);
                    continue;
                }

                if (!sourceStation || !destStation) {
                    this.track('skipped');
                    continue;
                }

                const trainNumber = this.allocateWikiTrainNumber(usedNumbers);
                await this.insertWikiTrain(wikiTrain, sourceId, sourceStation, destStation, trainNumber, typeMap);
            } catch (err) {
                this.report.errors.push({ train: wikiTrain.trainName, msg: err.message });
                this.track('failed');
            }
        }

        const pool = await getPool();
        await pool.request()
            .input('id', 'Int', sourceId)
            .input('recordCount', 'Int', this.report.parsed)
            .query(`UPDATE DataImportSources SET status = 'Success', recordCount = @recordCount, importedAt = SYSUTCDATETIME()
                    WHERE id = @id`);

        const reportPath = path.join(__dirname, '../data/railway/WikipediaImportReport.json');
        fs.writeFileSync(reportPath, JSON.stringify(this.report, null, 2));
        return this.report;
    }
}

module.exports = WikipediaRailwayImporter;
