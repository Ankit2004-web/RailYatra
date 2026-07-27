const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getPool, withTransaction } = require('../connection');
const { readCsvFile, fileHashSimple } = require('./csvParser');
const {
    normalizeCode, normalizeName, normalizeTrainNumber, normalizeTime,
    parseBool, parseIntSafe, parseFloatSafe, inferTrainTypeCode, parseRunningDaysField
} = require('./normalizers');
const { getClassCapacity } = require('../../backend/utils/coachCapacity');

const BATCH_SIZE = 200;

class RailwayDataImporter {
    constructor(options = {}) {
        this.dataDir = options.dataDir || path.join(__dirname, '../data/railway/processed');
        this.sourceName = options.sourceName || 'Development Dataset';
        this.sourceUrl = options.sourceUrl || null;
        this.publisher = options.publisher || 'RailYatra (Development)';
        this.licenseNotes = options.licenseNotes || 'DEVELOPMENT / TEST DATA — NOT official Indian Railways data';
        this.report = {
            source: this.sourceName,
            importedAt: new Date().toISOString(),
            counts: { inserted: 0, updated: 0, skipped: 0, failed: 0 },
            details: {},
            errors: [],
            warnings: []
        };
    }

    async run() {
        const pool = await getPool();
        const hash = this.computeDirectoryHash();
        const sourceId = await this.recordImportSource(hash);

        await this.importStates(path.join(this.dataDir, 'states.csv'));
        await this.importStations(path.join(this.dataDir, 'stations.csv'), sourceId);
        await this.importTrains(path.join(this.dataDir, 'trains.csv'), sourceId);
        await this.importRunningDays(path.join(this.dataDir, 'train_running_days.csv'));
        await this.importStops(path.join(this.dataDir, 'train_stops.csv'));
        await this.importTrainClasses(path.join(this.dataDir, 'train_classes.csv'));

        await this.validateReferentialIntegrity();
        await this.writeReport();
        return this.report;
    }

    computeDirectoryHash() {
        const files = ['states.csv', 'stations.csv', 'trains.csv', 'train_stops.csv', 'train_running_days.csv', 'train_classes.csv'];
        const parts = files.map((f) => {
            const p = path.join(this.dataDir, f);
            return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
        });
        return crypto.createHash('sha256').update(parts.join('\n')).digest('hex').slice(0, 32);
    }

    async recordImportSource(fileHash) {
        const pool = await getPool();
        const result = await pool.request()
            .input('sourceName', 'NVarChar', this.sourceName)
            .input('sourceUrl', 'NVarChar', this.sourceUrl)
            .input('publisher', 'NVarChar', this.publisher)
            .input('licenseNotes', 'NVarChar', this.licenseNotes)
            .input('fileHash', 'NVarChar', fileHash)
            .query(`INSERT INTO DataImportSources (sourceName, sourceUrl, publisher, licenseNotes, fileHash, status, notes)
                    OUTPUT INSERTED.id
                    VALUES (@sourceName, @sourceUrl, @publisher, @licenseNotes, @fileHash, 'InProgress',
                    'DEVELOPMENT/OPEN DATA import — not official IRCTC data')`);
        return result.recordset[0].id;
    }

    track(entity, action) {
        if (!this.report.details[entity]) {
            this.report.details[entity] = { inserted: 0, updated: 0, skipped: 0, failed: 0 };
        }
        this.report.details[entity][action] += 1;
        this.report.counts[action] += 1;
    }

    async importStates(filePath) {
        if (!fs.existsSync(filePath)) return;
        const rows = readCsvFile(filePath);
        const pool = await getPool();

        for (const row of rows) {
            try {
                const name = normalizeName(row.name);
                const code = normalizeCode(row.code) || null;
                const isUT = parseBool(row.isUnionTerritory);

                const existing = await pool.request()
                    .input('name', 'NVarChar', name)
                    .query('SELECT id FROM States WHERE name = @name');

                if (existing.recordset[0]) {
                    await pool.request()
                        .input('id', 'Int', existing.recordset[0].id)
                        .input('code', 'NVarChar', code)
                        .input('isUT', 'Bit', isUT)
                        .query('UPDATE States SET code = @code, isUnionTerritory = @isUT, updatedAt = SYSUTCDATETIME() WHERE id = @id');
                    this.track('states', 'updated');
                } else {
                    await pool.request()
                        .input('code', 'NVarChar', code)
                        .input('name', 'NVarChar', name)
                        .input('isUT', 'Bit', isUT)
                        .query('INSERT INTO States (code, name, isUnionTerritory) VALUES (@code, @name, @isUT)');
                    this.track('states', 'inserted');
                }
            } catch (err) {
                this.report.errors.push({ entity: 'states', row, msg: err.message });
                this.track('states', 'failed');
            }
        }
    }

    async loadStateMap() {
        const pool = await getPool();
        const result = await pool.request().query('SELECT id, name FROM States');
        const map = new Map();
        for (const row of result.recordset) map.set(row.name.toLowerCase(), row.id);
        return map;
    }

    async importStations(filePath, sourceId) {
        if (!fs.existsSync(filePath)) return;
        const rows = readCsvFile(filePath);
        const pool = await getPool();
        const stateMap = await this.loadStateMap();

        for (const row of rows) {
            try {
                const code = normalizeCode(row.code);
                const name = normalizeName(row.name);
                const city = normalizeName(row.city || name);
                const state = normalizeName(row.state);
                const stateId = stateMap.get(state.toLowerCase()) || null;

                if (!code || !name) throw new Error('Missing code or name');

                const existing = await pool.request()
                    .input('code', 'NVarChar', code)
                    .query('SELECT id FROM Stations WHERE code = @code');

                if (existing.recordset[0]) {
                    await pool.request()
                        .input('id', 'Int', existing.recordset[0].id)
                        .input('name', 'NVarChar', name)
                        .input('city', 'NVarChar', city)
                        .input('state', 'NVarChar', state)
                        .input('normalizedName', 'NVarChar', name.toLowerCase())
                        .input('stateId', 'Int', stateId)
                        .input('lat', 'Decimal', parseFloatSafe(row.latitude))
                        .input('lng', 'Decimal', parseFloatSafe(row.longitude))
                        .input('isJunction', 'Bit', parseBool(row.isJunction))
                        .input('dataSourceId', 'Int', sourceId)
                        .query(`UPDATE Stations SET name=@name, city=@city, state=@state, normalizedName=@normalizedName,
                                stateId=@stateId, latitude=@lat, longitude=@lng, isJunction=@isJunction,
                                dataSourceId=@dataSourceId, isActive=1, updatedAt=SYSUTCDATETIME() WHERE id=@id`);
                    this.track('stations', 'updated');
                } else {
                    await pool.request()
                        .input('code', 'NVarChar', code)
                        .input('name', 'NVarChar', name)
                        .input('city', 'NVarChar', city)
                        .input('state', 'NVarChar', state)
                        .input('normalizedName', 'NVarChar', name.toLowerCase())
                        .input('stateId', 'Int', stateId)
                        .input('lat', 'Decimal', parseFloatSafe(row.latitude))
                        .input('lng', 'Decimal', parseFloatSafe(row.longitude))
                        .input('isJunction', 'Bit', parseBool(row.isJunction))
                        .input('dataSourceId', 'Int', sourceId)
                        .query(`INSERT INTO Stations (code, name, city, state, normalizedName, stateId, latitude, longitude, isJunction, dataSourceId, isActive)
                                VALUES (@code, @name, @city, @state, @normalizedName, @stateId, @lat, @lng, @isJunction, @dataSourceId, 1)`);
                    this.track('stations', 'inserted');
                }
            } catch (err) {
                this.report.errors.push({ entity: 'stations', row, msg: err.message });
                this.track('stations', 'failed');
            }
        }
    }

    async loadStationCodeMap() {
        const pool = await getPool();
        const result = await pool.request().query('SELECT id, code, name FROM Stations WHERE isActive = 1');
        const map = new Map();
        for (const row of result.recordset) map.set(row.code, row);
        return map;
    }

    async loadTrainTypeMap() {
        const pool = await getPool();
        const result = await pool.request().query('SELECT id, code FROM TrainTypes');
        const map = new Map();
        for (const row of result.recordset) map.set(row.code, row.id);
        return map;
    }

    async importTrains(filePath, sourceId) {
        if (!fs.existsSync(filePath)) return;
        const rows = readCsvFile(filePath);
        const pool = await getPool();
        const stationMap = await this.loadStationCodeMap();
        const typeMap = await this.loadTrainTypeMap();

        for (const row of rows) {
            try {
                const trainNumber = normalizeTrainNumber(row.trainNumber);
                const trainName = normalizeName(row.trainName);
                const sourceCode = normalizeCode(row.sourceCode);
                const destCode = normalizeCode(row.destCode);
                const sourceStation = stationMap.get(sourceCode);
                const destStation = stationMap.get(destCode);
                if (!sourceStation || !destStation) {
                    throw new Error(`Unknown station code: ${sourceCode} or ${destCode}`);
                }

                const typeCode = normalizeCode(row.trainTypeCode) || inferTrainTypeCode(trainName);
                const trainTypeId = typeMap.get(typeCode) || null;
                const runningDays = row.runningDays || 'Daily';

                const existing = await pool.request()
                    .input('trainNumber', 'NVarChar', trainNumber)
                    .query('SELECT id FROM Trains WHERE trainNumber = @trainNumber');

                if (existing.recordset[0]) {
                    await pool.request()
                        .input('id', 'Int', existing.recordset[0].id)
                        .input('trainName', 'NVarChar', trainName)
                        .input('normalizedName', 'NVarChar', trainName.toLowerCase())
                        .input('source', 'NVarChar', sourceStation.name)
                        .input('destination', 'NVarChar', destStation.name)
                        .input('sourceStationId', 'Int', sourceStation.id)
                        .input('destinationStationId', 'Int', destStation.id)
                        .input('trainTypeId', 'Int', trainTypeId)
                        .input('runningDays', 'NVarChar', runningDays)
                        .input('dataSourceId', 'Int', sourceId)
                        .query(`UPDATE Trains SET trainName=@trainName, normalizedName=@normalizedName,
                                source=@source, destination=@destination, sourceStationId=@sourceStationId,
                                destinationStationId=@destinationStationId, trainTypeId=@trainTypeId,
                                runningDays=@runningDays, dataSourceId=@dataSourceId, isActive=1,
                                updatedAt=SYSUTCDATETIME() WHERE id=@id`);
                    this.track('trains', 'updated');
                } else {
                    await pool.request()
                        .input('trainNumber', 'NVarChar', trainNumber)
                        .input('trainName', 'NVarChar', trainName)
                        .input('normalizedName', 'NVarChar', trainName.toLowerCase())
                        .input('source', 'NVarChar', sourceStation.name)
                        .input('destination', 'NVarChar', destStation.name)
                        .input('departureTime', 'NVarChar', row.departureTime || '06:00')
                        .input('arrivalTime', 'NVarChar', row.arrivalTime || '18:00')
                        .input('duration', 'NVarChar', row.duration || '12h 0m')
                        .input('distance', 'Int', parseIntSafe(row.distance, 500))
                        .input('availableSeats', 'Int', parseIntSafe(row.availableSeats, 100))
                        .input('price', 'Decimal', parseFloatSafe(row.basePrice, 1000))
                        .input('journeyDate', 'Date', new Date().toISOString().split('T')[0])
                        .input('runningDays', 'NVarChar', runningDays)
                        .input('sourceStationId', 'Int', sourceStation.id)
                        .input('destinationStationId', 'Int', destStation.id)
                        .input('trainTypeId', 'Int', trainTypeId)
                        .input('dataSourceId', 'Int', sourceId)
                        .query(`INSERT INTO Trains (trainNumber, trainName, normalizedName, source, destination,
                                departureTime, arrivalTime, duration, distance, availableSeats, price, journeyDate,
                                runningDays, sourceStationId, destinationStationId, trainTypeId, dataSourceId, isActive)
                                VALUES (@trainNumber, @trainName, @normalizedName, @source, @destination,
                                @departureTime, @arrivalTime, @duration, @distance, @availableSeats, @price, @journeyDate,
                                @runningDays, @sourceStationId, @destinationStationId, @trainTypeId, @dataSourceId, 1)`);
                    this.track('trains', 'inserted');
                }
            } catch (err) {
                this.report.errors.push({ entity: 'trains', row, msg: err.message });
                this.track('trains', 'failed');
            }
        }
    }

    async loadTrainNumberMap() {
        const pool = await getPool();
        const result = await pool.request().query('SELECT id, trainNumber FROM Trains');
        const map = new Map();
        for (const row of result.recordset) map.set(row.trainNumber, row.id);
        return map;
    }

    async importRunningDays(filePath) {
        const pool = await getPool();
        const trainMap = await this.loadTrainNumberMap();

        let rows = [];
        if (fs.existsSync(filePath)) {
            rows = readCsvFile(filePath);
        }

        if (!rows.length) {
            const trains = await pool.request().query('SELECT id, runningDays FROM Trains');
            for (const t of trains.recordset) {
                const days = parseRunningDaysField(t.runningDays);
                for (const dow of days) {
                    rows.push({ trainNumber: null, trainId: t.id, dayOfWeek: dow, runs: '1' });
                }
            }
        }

        for (const row of rows) {
            try {
                const trainId = row.trainId || trainMap.get(normalizeTrainNumber(row.trainNumber));
                if (!trainId) throw new Error('Unknown train');
                const dow = parseIntSafe(row.dayOfWeek);
                const runs = parseBool(row.runs, true);

                const existing = await pool.request()
                    .input('trainId', 'Int', trainId)
                    .input('dow', 'TinyInt', dow)
                    .query('SELECT id FROM TrainRunningDays WHERE trainId=@trainId AND dayOfWeek=@dow');

                if (existing.recordset[0]) {
                    await pool.request()
                        .input('id', 'Int', existing.recordset[0].id)
                        .input('runs', 'Bit', runs)
                        .query('UPDATE TrainRunningDays SET runs=@runs WHERE id=@id');
                    this.track('runningDays', 'updated');
                } else {
                    await pool.request()
                        .input('trainId', 'Int', trainId)
                        .input('dow', 'TinyInt', dow)
                        .input('runs', 'Bit', runs)
                        .query('INSERT INTO TrainRunningDays (trainId, dayOfWeek, runs) VALUES (@trainId, @dow, @runs)');
                    this.track('runningDays', 'inserted');
                }
            } catch (err) {
                this.report.errors.push({ entity: 'runningDays', row, msg: err.message });
                this.track('runningDays', 'failed');
            }
        }
    }

    async importStops(filePath) {
        if (!fs.existsSync(filePath)) return;
        const rows = readCsvFile(filePath);
        const pool = await getPool();
        const trainMap = await this.loadTrainNumberMap();
        const stationMap = await this.loadStationCodeMap();

        const byTrain = new Map();
        for (const row of rows) {
            const tn = normalizeTrainNumber(row.trainNumber);
            if (!byTrain.has(tn)) byTrain.set(tn, []);
            byTrain.get(tn).push(row);
        }

        for (const [trainNumber, stops] of byTrain) {
            const trainId = trainMap.get(trainNumber);
            if (!trainId) {
                this.report.errors.push({ entity: 'stops', trainNumber, msg: 'Train not found' });
                continue;
            }

            stops.sort((a, b) => parseIntSafe(a.stopSequence) - parseIntSafe(b.stopSequence));

            await pool.request().input('trainId', 'Int', trainId)
                .query('DELETE FROM TrainStops WHERE trainId = @trainId');

            for (const row of stops) {
                try {
                    const station = stationMap.get(normalizeCode(row.stationCode));
                    if (!station) throw new Error(`Unknown station ${row.stationCode}`);

                    await pool.request()
                        .input('trainId', 'Int', trainId)
                        .input('stationId', 'Int', station.id)
                        .input('stationCode', 'NVarChar', station.code)
                        .input('stationName', 'NVarChar', station.name)
                        .input('stopOrder', 'Int', parseIntSafe(row.stopSequence))
                        .input('arrivalTime', 'NVarChar', normalizeTime(row.arrivalTime))
                        .input('departureTime', 'NVarChar', normalizeTime(row.departureTime))
                        .input('arrivalDayOffset', 'Int', parseIntSafe(row.arrivalDayOffset, 0))
                        .input('departureDayOffset', 'Int', parseIntSafe(row.departureDayOffset, 0))
                        .input('haltMinutes', 'Int', parseIntSafe(row.haltMinutes, 0))
                        .input('distanceKm', 'Int', parseIntSafe(row.distanceKm, null))
                        .input('isTechnical', 'Bit', parseBool(row.isTechnicalStop))
                        .query(`INSERT INTO TrainStops (trainId, stationId, stationCode, stationName, stopOrder,
                                arrivalTime, departureTime, arrivalDayOffset, departureDayOffset, haltMinutes, distanceKm, isTechnicalStop)
                                VALUES (@trainId, @stationId, @stationCode, @stationName, @stopOrder,
                                @arrivalTime, @departureTime, @arrivalDayOffset, @departureDayOffset, @haltMinutes, @distanceKm, @isTechnical)`);
                    this.track('stops', 'inserted');
                } catch (err) {
                    this.report.errors.push({ entity: 'stops', row, msg: err.message });
                    this.track('stops', 'failed');
                }
            }
        }
    }

    async importTrainClasses(filePath) {
        if (!fs.existsSync(filePath)) return;
        const rows = readCsvFile(filePath);
        const pool = await getPool();
        const trainMap = await this.loadTrainNumberMap();

        const travelClasses = await pool.request().query('SELECT id, code FROM TravelClasses');
        const classMap = new Map(travelClasses.recordset.map((r) => [r.code, r.id]));

        for (const row of rows) {
            try {
                const trainId = trainMap.get(normalizeTrainNumber(row.trainNumber));
                if (!trainId) throw new Error('Unknown train');
                const classCode = normalizeCode(row.classCode);
                const travelClassId = classMap.get(classCode) || null;
                const defaultCap = getClassCapacity(classCode, row.trainName || '', row.trainTypeCode || '');

                const existing = await pool.request()
                    .input('trainId', 'Int', trainId)
                    .input('classCode', 'NVarChar', classCode)
                    .query('SELECT id FROM TrainClasses WHERE trainId=@trainId AND classCode=@classCode');

                if (existing.recordset[0]) {
                    await pool.request()
                        .input('id', 'Int', existing.recordset[0].id)
                        .input('price', 'Decimal', parseFloatSafe(row.price, 1000))
                        .input('totalSeats', 'Int', parseIntSafe(row.totalSeats, defaultCap))
                        .input('availableSeats', 'Int', parseIntSafe(row.availableSeats, parseIntSafe(row.totalSeats, defaultCap)))
                        .input('travelClassId', 'Int', travelClassId)
                        .query(`UPDATE TrainClasses SET price=@price, totalSeats=@totalSeats, availableSeats=@availableSeats,
                                travelClassId=@travelClassId, isAvailable=1, updatedAt=SYSUTCDATETIME() WHERE id=@id`);
                    this.track('trainClasses', 'updated');
                } else {
                    await pool.request()
                        .input('trainId', 'Int', trainId)
                        .input('classCode', 'NVarChar', classCode)
                        .input('className', 'NVarChar', row.className || classCode)
                        .input('price', 'Decimal', parseFloatSafe(row.price, 1000))
                        .input('totalSeats', 'Int', parseIntSafe(row.totalSeats, defaultCap))
                        .input('availableSeats', 'Int', parseIntSafe(row.availableSeats, parseIntSafe(row.totalSeats, defaultCap)))
                        .input('travelClassId', 'Int', travelClassId)
                        .query(`INSERT INTO TrainClasses (trainId, classCode, className, price, totalSeats, availableSeats, travelClassId, isAvailable)
                                VALUES (@trainId, @classCode, @className, @price, @totalSeats, @availableSeats, @travelClassId, 1)`);
                    this.track('trainClasses', 'inserted');
                }
            } catch (err) {
                this.report.errors.push({ entity: 'trainClasses', row, msg: err.message });
                this.track('trainClasses', 'failed');
            }
        }
    }

    async validateReferentialIntegrity() {
        const pool = await getPool();
        const orphanStops = await pool.request().query(
            'SELECT COUNT(*) AS c FROM TrainStops WHERE stationId IS NULL'
        );
        if (orphanStops.recordset[0].c > 0) {
            this.report.warnings.push(`${orphanStops.recordset[0].c} train stops missing stationId`);
        }

        const dupStops = await pool.request().query(`
            SELECT trainId, stopOrder, COUNT(*) AS c FROM TrainStops
            GROUP BY trainId, stopOrder HAVING COUNT(*) > 1
        `);
        if (dupStops.recordset.length) {
            this.report.errors.push({ entity: 'validation', msg: 'Duplicate stop sequences detected', rows: dupStops.recordset });
        }
    }

    async writeReport() {
        const reportPath = path.join(this.dataDir, '..', 'RailwayDataImportReport.json');
        fs.writeFileSync(reportPath, JSON.stringify(this.report, null, 2), 'utf8');
        console.log(`Import report written to ${reportPath}`);
    }
}

module.exports = RailwayDataImporter;
