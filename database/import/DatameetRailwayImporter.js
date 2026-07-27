/**
 * Imports Indian Railways master data from datameet/railways JSON (CC0).
 * Source: https://github.com/datameet/railways
 * NOTE: Community-compiled dataset (~2016 era). NOT current official IRCTC timetable.
 * Running days and per-stop distance are NOT in source — left null/unverified.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getPool, closePool } = require('../connection');
const {
    normalizeCode, normalizeName, normalizeTrainNumber, normalizeTime,
    parseIntSafe, inferTrainTypeCode
} = require('./normalizers');
const { getClassCapacity } = require('../../backend/utils/coachCapacity');

const SOURCE = {
    name: 'DataMeet Indian Railways JSON (CC0)',
    url: 'https://github.com/datameet/railways',
    publisher: 'DataMeet Community (compiled from public railway sources)',
    licenseNotes: 'CC0 — NOT official Ministry of Railways current timetable. Potentially outdated (~2016). Running days not included in source.',
    datasetDate: '2016-08 (approx, see datameet blog)',
    potentiallyOutdated: true,
    completeness: 'PARTIAL — reservation-style trains; no platforms; no running days; no per-stop distance'
};

const TYPE_MAP = {
    exp: 'EXP', sf: 'SF', pass: 'PASS', raj: 'RAJ', shat: 'SHAT', dur: 'DUR', mail: 'EXP', passgr: 'PASS'
};

const STOP_BATCH = 12;

function parseDatameetTime(value) {
    if (!value || String(value).toLowerCase() === 'none') return null;
    return normalizeTime(String(value).slice(0, 5));
}

function haltMinutes(arrival, departure) {
    if (!arrival || !departure) return null;
    const [ah, am] = arrival.split(':').map(Number);
    const [dh, dm] = departure.split(':').map(Number);
    if ([ah, am, dh, dm].some(Number.isNaN)) return null;
    let diff = (dh * 60 + dm) - (ah * 60 + am);
    if (diff < 0) diff += 1440;
    return diff > 0 ? diff : 0;
}

class DatameetRailwayImporter {
    constructor(options = {}) {
        this.rawDir = options.rawDir || path.join(__dirname, '../data/railway/raw');
        this.deactivateOthers = options.deactivateOthers !== false;
        this.report = {
            source: SOURCE.name,
            importedAt: new Date().toISOString(),
            sourceMeta: SOURCE,
            counts: { inserted: 0, updated: 0, skipped: 0, failed: 0 },
            details: {},
            errors: [],
            warnings: [
                'Running days NOT present in datameet source — day-of-week filter disabled for these trains',
                'Per-stop distance NOT in source — distanceKm left null on stops',
                'Platform numbers NOT in source — platformHint null',
                'Dataset is PARTIAL and POTENTIALLY OUTDATED (~2016 compilation)'
            ],
            platformsAvailable: 0,
            platformsMissing: 0
        };
    }

    track(entity, action) {
        if (!this.report.details[entity]) {
            this.report.details[entity] = { inserted: 0, updated: 0, skipped: 0, failed: 0 };
        }
        this.report.details[entity][action] += 1;
        this.report.counts[action] += 1;
    }

    async run() {
        const stationsPath = path.join(this.rawDir, 'datameet-stations.json');
        const trainsPath = path.join(this.rawDir, 'datameet-trains.json');
        const schedulesPath = path.join(this.rawDir, 'datameet-schedules.json');

        for (const p of [stationsPath, trainsPath, schedulesPath]) {
            if (!fs.existsSync(p)) {
                throw new Error(`Missing required file: ${p}. Run download script first.`);
            }
        }

        const hash = crypto.createHash('sha256')
            .update(fs.readFileSync(stationsPath))
            .update(fs.readFileSync(trainsPath))
            .update(fs.readFileSync(schedulesPath))
            .digest('hex')
            .slice(0, 32);

        const sourceId = await this.recordImportSource(hash);
        await this.ensureReferenceData();

        const stationMap = await this.importStations(stationsPath, sourceId);
        const trainMap = await this.importTrains(trainsPath, stationMap, sourceId);
        await this.importSchedules(schedulesPath, stationMap, trainMap);

        if (this.deactivateOthers) {
            await this.deactivateNonImportedTrains(sourceId);
        }

        await this.validateIntegrity();
        await this.finalizeImportSource(sourceId);
        await this.writeReport();
        return this.report;
    }

    async recordImportSource(fileHash) {
        const pool = await getPool();
        const result = await pool.request()
            .input('sourceName', 'NVarChar', SOURCE.name)
            .input('sourceUrl', 'NVarChar', SOURCE.url)
            .input('publisher', 'NVarChar', SOURCE.publisher)
            .input('licenseNotes', 'NVarChar', SOURCE.licenseNotes)
            .input('fileHash', 'NVarChar', fileHash)
            .query(`INSERT INTO DataImportSources (sourceName, sourceUrl, publisher, licenseNotes, fileHash, status, notes, datasetVersion)
                    OUTPUT INSERTED.id
                    VALUES (@sourceName, @sourceUrl, @publisher, @licenseNotes, @fileHash, 'InProgress',
                    @licenseNotes, '${SOURCE.datasetDate}')`);
        return result.recordset[0].id;
    }

    async finalizeImportSource(sourceId) {
        const pool = await getPool();
        const total = this.report.counts.inserted + this.report.counts.updated;
        await pool.request()
            .input('id', 'Int', sourceId)
            .input('count', 'Int', total)
            .query(`UPDATE DataImportSources SET status='Completed', recordCount=@count, importedAt=SYSUTCDATETIME() WHERE id=@id`);
    }

    async ensureReferenceData() {
        const pool = await getPool();
        const types = await pool.request().query('SELECT COUNT(*) AS c FROM TrainTypes');
        if (types.recordset[0].c === 0) {
            await pool.request().query(`INSERT INTO TrainTypes (code, name) VALUES
                ('RAJ','Rajdhani'),('SHAT','Shatabdi'),('DUR','Duronto'),('VB','Vande Bharat'),
                ('SF','Superfast'),('EXP','Express'),('PASS','Passenger')`);
        }
    }

    async importStations(filePath, sourceId) {
        const geo = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const features = geo.features || [];
        const pool = await getPool();
        const stateMap = new Map();
        const zoneMap = new Map();
        const stationMap = new Map();

        for (const feature of features) {
            const props = feature.properties || {};
            const coords = feature.geometry?.coordinates || [];
            const code = normalizeCode(props.code);
            const name = normalizeName(props.name);
            const state = normalizeName(props.state);
            const zone = normalizeCode(props.zone);

            if (!code || !name) {
                this.track('stations', 'failed');
                continue;
            }

            try {
                if (state && !stateMap.has(state.toLowerCase())) {
                    const ex = await pool.request().input('name', 'NVarChar', state)
                        .query('SELECT id FROM States WHERE name=@name');
                    if (ex.recordset[0]) {
                        stateMap.set(state.toLowerCase(), ex.recordset[0].id);
                    } else {
                        const ins = await pool.request().input('name', 'NVarChar', state)
                            .query('INSERT INTO States (name) OUTPUT INSERTED.id VALUES (@name)');
                        stateMap.set(state.toLowerCase(), ins.recordset[0].id);
                    }
                }

                if (zone && !zoneMap.has(zone)) {
                    const ex = await pool.request().input('code', 'NVarChar', zone)
                        .query('SELECT id FROM RailwayZones WHERE code=@code');
                    if (!ex.recordset[0]) {
                        await pool.request().input('code', 'NVarChar', zone).input('name', 'NVarChar', zone)
                            .query('INSERT INTO RailwayZones (code, name) VALUES (@code, @name)');
                    }
                    zoneMap.set(zone, zone);
                }

                const stateId = state ? stateMap.get(state.toLowerCase()) : null;
                let zoneId = null;
                if (zone) {
                    const zr = await pool.request().input('code', 'NVarChar', zone)
                        .query('SELECT id FROM RailwayZones WHERE code=@code');
                    zoneId = zr.recordset[0]?.id || null;
                }

                const lat = coords[1] != null ? coords[1] : null;
                const lng = coords[0] != null ? coords[0] : null;
                const city = props.address ? normalizeName(String(props.address).split(',')[0]).slice(0, 100) : name.slice(0, 100);

                const existing = await pool.request().input('code', 'NVarChar', code)
                    .query('SELECT id FROM Stations WHERE code=@code');

                if (existing.recordset[0]) {
                    await pool.request()
                        .input('id', 'Int', existing.recordset[0].id)
                        .input('name', 'NVarChar', name)
                        .input('city', 'NVarChar', city)
                        .input('state', 'NVarChar', state || '')
                        .input('normalizedName', 'NVarChar', name.toLowerCase())
                        .input('stateId', 'Int', stateId)
                        .input('zoneId', 'Int', zoneId)
                        .input('lat', 'Decimal', lat)
                        .input('lng', 'Decimal', lng)
                        .input('dataSourceId', 'Int', sourceId)
                        .query(`UPDATE Stations SET name=@name, city=@city, state=@state, normalizedName=@normalizedName,
                                stateId=@stateId, zoneId=@zoneId, latitude=@lat, longitude=@lng,
                                dataSourceId=@dataSourceId, isActive=1, updatedAt=SYSUTCDATETIME() WHERE id=@id`);
                    stationMap.set(code, existing.recordset[0].id);
                    this.track('stations', 'updated');
                } else {
                    const ins = await pool.request()
                        .input('code', 'NVarChar', code)
                        .input('name', 'NVarChar', name)
                        .input('city', 'NVarChar', city)
                        .input('state', 'NVarChar', state || '')
                        .input('normalizedName', 'NVarChar', name.toLowerCase())
                        .input('stateId', 'Int', stateId)
                        .input('zoneId', 'Int', zoneId)
                        .input('lat', 'Decimal', lat)
                        .input('lng', 'Decimal', lng)
                        .input('dataSourceId', 'Int', sourceId)
                        .query(`INSERT INTO Stations (code, name, city, state, normalizedName, stateId, zoneId, latitude, longitude, dataSourceId, isActive)
                                OUTPUT INSERTED.id VALUES (@code,@name,@city,@state,@normalizedName,@stateId,@zoneId,@lat,@lng,@dataSourceId,1)`);
                    stationMap.set(code, ins.recordset[0].id);
                    this.track('stations', 'inserted');
                }
            } catch (err) {
                this.report.errors.push({ entity: 'stations', code, msg: err.message });
                this.track('stations', 'failed');
            }
        }
        return stationMap;
    }

    mapTrainType(raw) {
        const key = String(raw || '').toLowerCase().replace(/[^a-z]/g, '');
        return TYPE_MAP[key] || inferTrainTypeCode(raw) || 'EXP';
    }

    async importTrains(filePath, stationMap, sourceId) {
        const geo = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const features = geo.features || [];
        const pool = await getPool();
        const typeRows = await pool.request().query('SELECT id, code FROM TrainTypes');
        const typeMap = new Map(typeRows.recordset.map((r) => [r.code, r.id]));
        const trainMap = new Map();

        for (const feature of features) {
            const p = feature.properties || {};
            const trainNumber = normalizeTrainNumber(p.number);
            const trainName = normalizeName(p.name);
            const srcCode = normalizeCode(p.from_station_code);
            const dstCode = normalizeCode(p.to_station_code);
            const srcId = stationMap.get(srcCode);
            const dstId = stationMap.get(dstCode);

            if (!trainNumber || !trainName) {
                this.track('trains', 'failed');
                continue;
            }
            if (!srcId || !dstId) {
                this.report.errors.push({ entity: 'trains', trainNumber, msg: `Unknown station ${srcCode} or ${dstCode}` });
                this.track('trains', 'failed');
                continue;
            }

            const typeCode = this.mapTrainType(p.type);
            const trainTypeId = typeMap.get(typeCode) || null;
            const dep = parseDatameetTime(p.departure);
            const arr = parseDatameetTime(p.arrival);
            const durationH = parseIntSafe(p.duration_h, 0);
            const durationM = parseIntSafe(p.duration_m, 0);
            const duration = durationH || durationM ? `${durationH}h ${durationM}m` : '—';
            const distance = parseIntSafe(p.distance, null);
            const runningDays = 'Not in source dataset';

            try {
                const srcName = await pool.request().input('id', 'Int', srcId).query('SELECT name FROM Stations WHERE id=@id');
                const dstName = await pool.request().input('id', 'Int', dstId).query('SELECT name FROM Stations WHERE id=@id');

                const existing = await pool.request().input('trainNumber', 'NVarChar', trainNumber)
                    .query('SELECT id FROM Trains WHERE trainNumber=@trainNumber');

                let trainId;
                if (existing.recordset[0]) {
                    trainId = existing.recordset[0].id;
                    await pool.request()
                        .input('id', 'Int', trainId)
                        .input('trainName', 'NVarChar', trainName)
                        .input('normalizedName', 'NVarChar', trainName.toLowerCase())
                        .input('source', 'NVarChar', srcName.recordset[0].name)
                        .input('destination', 'NVarChar', dstName.recordset[0].name)
                        .input('departureTime', 'NVarChar', dep || '00:00')
                        .input('arrivalTime', 'NVarChar', arr || '00:00')
                        .input('duration', 'NVarChar', duration)
                        .input('distance', 'Int', distance || 0)
                        .input('runningDays', 'NVarChar', runningDays)
                        .input('sourceStationId', 'Int', srcId)
                        .input('destinationStationId', 'Int', dstId)
                        .input('trainTypeId', 'Int', trainTypeId)
                        .input('dataSourceId', 'Int', sourceId)
                        .query(`UPDATE Trains SET trainName=@trainName, normalizedName=@normalizedName, source=@source,
                                destination=@destination, departureTime=@departureTime, arrivalTime=@arrivalTime,
                                duration=@duration, distance=@distance, runningDays=@runningDays,
                                sourceStationId=@sourceStationId, destinationStationId=@destinationStationId,
                                trainTypeId=@trainTypeId, dataSourceId=@dataSourceId, isActive=1, runningStatus='Running',
                                updatedAt=SYSUTCDATETIME() WHERE id=@id`);
                    this.track('trains', 'updated');
                } else {
                    const ins = await pool.request()
                        .input('trainNumber', 'NVarChar', trainNumber)
                        .input('trainName', 'NVarChar', trainName)
                        .input('normalizedName', 'NVarChar', trainName.toLowerCase())
                        .input('source', 'NVarChar', srcName.recordset[0].name)
                        .input('destination', 'NVarChar', dstName.recordset[0].name)
                        .input('departureTime', 'NVarChar', dep || '00:00')
                        .input('arrivalTime', 'NVarChar', arr || '00:00')
                        .input('duration', 'NVarChar', duration)
                        .input('distance', 'Int', distance || 0)
                        .input('availableSeats', 'Int', 100)
                        .input('price', 'Decimal', 1000)
                        .input('journeyDate', 'Date', new Date().toISOString().split('T')[0])
                        .input('runningDays', 'NVarChar', runningDays)
                        .input('sourceStationId', 'Int', srcId)
                        .input('destinationStationId', 'Int', dstId)
                        .input('trainTypeId', 'Int', trainTypeId)
                        .input('dataSourceId', 'Int', sourceId)
                        .query(`INSERT INTO Trains (trainNumber, trainName, normalizedName, source, destination,
                                departureTime, arrivalTime, duration, distance, availableSeats, price, journeyDate,
                                runningDays, sourceStationId, destinationStationId, trainTypeId, dataSourceId, isActive, runningStatus)
                                OUTPUT INSERTED.id VALUES (@trainNumber,@trainName,@normalizedName,@source,@destination,
                                @departureTime,@arrivalTime,@duration,@distance,@availableSeats,@price,@journeyDate,
                                @runningDays,@sourceStationId,@destinationStationId,@trainTypeId,@dataSourceId,1,'Running')`);
                    trainId = ins.recordset[0].id;
                    this.track('trains', 'inserted');
                }

                trainMap.set(trainNumber, trainId);
                await this.importTrainClassesFromProps(trainId, p);
            } catch (err) {
                this.report.errors.push({ entity: 'trains', trainNumber, msg: err.message });
                this.track('trains', 'failed');
            }
        }
        return trainMap;
    }

    async importTrainClassesFromProps(trainId, props) {
        const pool = await getPool();
        const trainName = props.name || '';
        const trainTypeCode = this.mapTrainType(props.type);
        const isPremiumRake = /rajdhani|shatabdi|duronto|vande bharat|garib rath|tejas|humsafar|anubhuthi/i.test(trainName);

        const classFlags = [
            ['1A', 'AC First Class', props.first_ac],
            ['2A', 'AC 2 Tier', props.second_ac],
            ['3A', 'AC 3 Tier', props.third_ac],
            ['SL', 'Sleeper', props.sleeper],
            ['CC', 'Chair Car', props.chair_car]
        ].filter(([, , flag]) => flag === true || flag === 'true' || flag === 1);

        const hasSleeper = classFlags.some(([code]) => code === 'SL');
        const has2S = classFlags.some(([code]) => code === '2S');
        if (!has2S && !isPremiumRake && (hasSleeper || /passenger|pass\b|memu|demu/i.test(trainName))) {
            classFlags.push(['2S', 'Second Sitting', true]);
        }

        if (!classFlags.length) return;

        const tc = await pool.request().query('SELECT id, code FROM TravelClasses');
        const classMap = new Map(tc.recordset.map((r) => [r.code, r.id]));

        for (const [code, name] of classFlags) {
            const travelClassId = classMap.get(code === 'FC' ? 'FC' : code) || classMap.get(code) || null;
            const capacity = getClassCapacity(code, props.name || '', this.mapTrainType(props.type));
            const existing = await pool.request()
                .input('trainId', 'Int', trainId)
                .input('classCode', 'NVarChar', code)
                .query('SELECT id FROM TrainClasses WHERE trainId=@trainId AND classCode=@classCode');

            if (existing.recordset[0]) {
                await pool.request().input('id', 'Int', existing.recordset[0].id)
                    .input('travelClassId', 'Int', travelClassId)
                    .input('totalSeats', 'Int', capacity)
                    .input('availableSeats', 'Int', capacity)
                    .query('UPDATE TrainClasses SET isAvailable=1, travelClassId=@travelClassId, totalSeats=@totalSeats, availableSeats=@availableSeats WHERE id=@id');
                this.track('trainClasses', 'updated');
            } else {
                await pool.request()
                    .input('trainId', 'Int', trainId)
                    .input('classCode', 'NVarChar', code)
                    .input('className', 'NVarChar', name)
                    .input('travelClassId', 'Int', travelClassId)
                    .input('totalSeats', 'Int', capacity)
                    .input('availableSeats', 'Int', capacity)
                    .query(`INSERT INTO TrainClasses (trainId, classCode, className, price, totalSeats, availableSeats, travelClassId, isAvailable)
                            VALUES (@trainId, @classCode, @className, 1000, @totalSeats, @availableSeats, @travelClassId, 1)`);
                this.track('trainClasses', 'inserted');
            }
        }
    }

    async importSchedules(filePath, stationMap, trainMap) {
        console.log('Loading schedules JSON (this may take a moment)...');
        const schedules = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        console.log(`Loaded ${schedules.length} schedule rows for ${trainMap.size} trains`);

        const byTrain = new Map();
        for (const row of schedules) {
            const tn = normalizeTrainNumber(row.train_number);
            if (!trainMap.has(tn)) continue;
            if (!byTrain.has(tn)) byTrain.set(tn, []);
            byTrain.get(tn).push(row);
        }

        const pool = await getPool();
        let trainIdx = 0;
        const totalTrains = byTrain.size;

        for (const [trainNumber, rows] of byTrain) {
            trainIdx += 1;
            if (trainIdx % 200 === 0) {
                console.log(`  Stops import progress: ${trainIdx}/${totalTrains} trains...`);
            }

            const trainId = trainMap.get(trainNumber);
            rows.sort((a, b) => a.id - b.id);

            try {
                await pool.request().input('trainId', 'Int', trainId)
                    .query('DELETE FROM TrainStops WHERE trainId=@trainId');

                const trainRow = await pool.request().input('id', 'Int', trainId)
                    .query('SELECT distance FROM Trains WHERE id=@id');
                const totalDistance = trainRow.recordset[0]?.distance || null;

                for (let i = 0; i < rows.length; i += STOP_BATCH) {
                    const batch = rows.slice(i, i + STOP_BATCH);
                    const values = [];
                    const request = pool.request().input('trainId', 'Int', trainId);

                    batch.forEach((row, bi) => {
                        const code = normalizeCode(row.station_code);
                        const stationId = stationMap.get(code);
                        if (!stationId) {
                            this.report.errors.push({ entity: 'stops', trainNumber, stationCode: code, msg: 'Unknown station' });
                            this.track('stops', 'failed');
                            return;
                        }

                        const seq = i + bi + 1;
                        const arr = parseDatameetTime(row.arrival);
                        const dep = parseDatameetTime(row.departure);
                        const dayOffset = Math.max(0, parseIntSafe(row.day, 1) - 1);
                        const halt = haltMinutes(arr, dep);
                        const isLast = seq === rows.length;
                        const distanceKm = isLast && totalDistance ? totalDistance : null;
                        const stName = normalizeName(row.station_name);

                        const prefix = `s${bi}`;
                        request.input(`${prefix}_sid`, 'Int', stationId);
                        request.input(`${prefix}_code`, 'NVarChar', code);
                        request.input(`${prefix}_name`, 'NVarChar', stName);
                        request.input(`${prefix}_ord`, 'Int', seq);
                        request.input(`${prefix}_arr`, 'NVarChar', arr);
                        request.input(`${prefix}_dep`, 'NVarChar', dep);
                        request.input(`${prefix}_aoff`, 'Int', dayOffset);
                        request.input(`${prefix}_doff`, 'Int', dayOffset);
                        request.input(`${prefix}_halt`, 'Int', halt ?? 0);
                        request.input(`${prefix}_dist`, 'Int', distanceKm);

                        values.push(`(@trainId, @${prefix}_sid, @${prefix}_code, @${prefix}_name, @${prefix}_ord,
                            @${prefix}_arr, @${prefix}_dep, @${prefix}_aoff, @${prefix}_doff, @${prefix}_halt, @${prefix}_dist, NULL, 0)`);
                        this.track('stops', 'inserted');
                    });

                    if (values.length) {
                        await request.query(`INSERT INTO TrainStops (trainId, stationId, stationCode, stationName, stopOrder,
                            arrivalTime, departureTime, arrivalDayOffset, departureDayOffset, haltMinutes, distanceKm, platformHint, isTechnicalStop)
                            VALUES ${values.join(',')}`);
                    }
                }
            } catch (err) {
                this.report.errors.push({ entity: 'stops', trainNumber, msg: err.message });
            }
        }

        this.report.platformsMissing = schedules.length;
    }

    async deactivateNonImportedTrains(sourceId) {
        const pool = await getPool();
        const result = await pool.request()
            .input('sourceId', 'Int', sourceId)
            .query(`UPDATE Trains SET isActive=0, updatedAt=SYSUTCDATETIME()
                    WHERE dataSourceId IS NULL OR dataSourceId <> @sourceId`);
        this.report.warnings.push(`Deactivated ${result.rowsAffected[0]} trains not from this import source`);
    }

    async validateIntegrity() {
        const pool = await getPool();
        const orphan = await pool.request().query('SELECT COUNT(*) AS c FROM TrainStops WHERE stationId IS NULL');
        if (orphan.recordset[0].c > 0) {
            this.report.warnings.push(`${orphan.recordset[0].c} stops missing stationId`);
        }
    }

    async writeReport() {
        const reportPath = path.join(this.rawDir, '..', 'RailwayDataImportReport.json');
        fs.writeFileSync(reportPath, JSON.stringify(this.report, null, 2), 'utf8');
        console.log(`Import report: ${reportPath}`);
    }
}

async function main() {
    const importer = new DatameetRailwayImporter();
    const report = await importer.run();
    console.log('\n=== Datameet Import Summary ===');
    console.log(JSON.stringify(report.details, null, 2));
    console.log(`Errors: ${report.errors.length}, Warnings: ${report.warnings.length}`);
    await closePool();
    process.exit(report.errors.length > 100 ? 1 : 0);
}

if (require.main === module) {
    main().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = DatameetRailwayImporter;
