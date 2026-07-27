const { getPool } = require('../../database/connection');
const trainClassRepository = require('./trainClassRepository');
const trainSearchService = require('../services/trainSearchService');
const { enrichClassesWithRake } = require('../services/coachCompositionService');

const formatTrain = (train, classes = []) => ({
    ...train,
    id: train.id,
    date: train.journeyDate,
    price: Number(train.price),
    runningDays: train.runningDays || 'Daily',
    runningStatus: train.runningStatus || 'Running',
    classes,
    lowestPrice: classes.length ? Math.min(...classes.map((c) => c.price)) : Number(train.price)
});

const attachClasses = async (trains) => {
    const classesMap = await trainClassRepository.findByTrainIds(trains.map((t) => t.id));
    return trains.map((train) => formatTrain(train, classesMap[train.id] || []));
};

const findAll = async () => {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM Trains ORDER BY journeyDate ASC');
    return attachClasses(result.recordset);
};

const search = async (params) => trainSearchService.search(params);

const findById = async (id) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('id', 'Int', id)
        .query(`
            SELECT t.*,
                   tt.code AS trainTypeCode, tt.name AS trainTypeName,
                   ss.code AS sourceStationCode, ss.name AS sourceStationName,
                   ds.code AS destStationCode, ds.name AS destStationName
            FROM Trains t
            LEFT JOIN TrainTypes tt ON tt.id = t.trainTypeId
            LEFT JOIN Stations ss ON ss.id = t.sourceStationId
            LEFT JOIN Stations ds ON ds.id = t.destinationStationId
            WHERE t.id = @id
        `);
    if (!result.recordset[0]) return null;

    const train = result.recordset[0];
    const classes = await trainClassRepository.findByTrainId(id);
    const enrichedClasses = await enrichClassesWithRake(train.trainNumber, classes, {
        trainName: train.trainName,
        trainTypeCode: train.trainTypeCode
    });

    const runningDaysResult = await pool.request()
        .input('trainId', 'Int', id)
        .query('SELECT dayOfWeek, runs FROM TrainRunningDays WHERE trainId = @trainId AND runs = 1 ORDER BY dayOfWeek');

    const runningDayService = require('../services/runningDayService');
    const runningDaysList = runningDaysResult.recordset.length
        ? runningDaysResult.recordset.map((r) => r.dayOfWeek)
        : runningDayService.parseRunningDaysString(train.runningDays);

    const formatted = formatTrain(train, enrichedClasses);
    return {
        ...formatted,
        trainType: train.trainTypeName || null,
        trainTypeCode: train.trainTypeCode || null,
        sourceStation: train.sourceStationCode ? {
            code: train.sourceStationCode,
            name: train.sourceStationName
        } : null,
        destinationStation: train.destStationCode ? {
            code: train.destStationCode,
            name: train.destStationName
        } : null,
        runningDaysList,
        runningDaysLabel: runningDayService.runningDaysLabel(runningDaysList),
        isActive: train.isActive !== false
    };
};

const findByNumber = async (trainNumber) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('trainNumber', 'NVarChar', trainNumber)
        .query('SELECT * FROM Trains WHERE trainNumber = @trainNumber');
    return result.recordset[0] || null;
};

const create = async (data) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('trainNumber', 'NVarChar', data.trainNumber)
        .input('trainName', 'NVarChar', data.trainName)
        .input('source', 'NVarChar', data.source)
        .input('destination', 'NVarChar', data.destination)
        .input('departureTime', 'NVarChar', data.departureTime)
        .input('arrivalTime', 'NVarChar', data.arrivalTime)
        .input('duration', 'NVarChar', data.duration)
        .input('distance', 'Int', data.distance)
        .input('availableSeats', 'Int', data.availableSeats)
        .input('price', 'Decimal', data.price)
        .input('journeyDate', 'Date', data.date)
        .input('runningDays', 'NVarChar', data.runningDays || 'Daily')
        .input('runningStatus', 'NVarChar', data.runningStatus || 'Running')
        .query(`INSERT INTO Trains (trainNumber, trainName, source, destination, departureTime, arrivalTime, duration, distance, availableSeats, price, journeyDate, runningDays, runningStatus)
                OUTPUT INSERTED.*
                VALUES (@trainNumber, @trainName, @source, @destination, @departureTime, @arrivalTime, @duration, @distance, @availableSeats, @price, @journeyDate, @runningDays, @runningStatus)`);

    return formatTrain(result.recordset[0]);
};

const update = async (id, data) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('id', 'Int', id)
        .input('trainNumber', 'NVarChar', data.trainNumber)
        .input('trainName', 'NVarChar', data.trainName)
        .input('source', 'NVarChar', data.source)
        .input('destination', 'NVarChar', data.destination)
        .input('departureTime', 'NVarChar', data.departureTime)
        .input('arrivalTime', 'NVarChar', data.arrivalTime)
        .input('duration', 'NVarChar', data.duration)
        .input('distance', 'Int', data.distance)
        .input('availableSeats', 'Int', data.availableSeats)
        .input('price', 'Decimal', data.price)
        .input('journeyDate', 'Date', data.date)
        .input('runningDays', 'NVarChar', data.runningDays || 'Daily')
        .input('runningStatus', 'NVarChar', data.runningStatus || 'Running')
        .query(`UPDATE Trains SET
                    trainNumber = @trainNumber,
                    trainName = @trainName,
                    source = @source,
                    destination = @destination,
                    departureTime = @departureTime,
                    arrivalTime = @arrivalTime,
                    duration = @duration,
                    distance = @distance,
                    availableSeats = @availableSeats,
                    price = @price,
                    journeyDate = @journeyDate,
                    runningDays = @runningDays,
                    runningStatus = @runningStatus,
                    updatedAt = SYSUTCDATETIME()
                OUTPUT INSERTED.*
                WHERE id = @id`);

    return result.recordset[0] ? formatTrain(result.recordset[0]) : null;
};

const remove = async (id) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('id', 'Int', id)
        .query('DELETE FROM Trains WHERE id = @id');
    return result.rowsAffected[0] > 0;
};

const findPaginated = async ({ page = 1, pageSize = 25, search = '', trainType, source, destination, status }) => {
    const pool = await getPool();
    const offset = (page - 1) * pageSize;
    const trimmed = search.trim();
    const hasSearch = trimmed.length > 0;

    const countReq = pool.request();
    const dataReq = pool.request()
        .input('offset', 'Int', offset)
        .input('pageSize', 'Int', pageSize);

    let where = 'WHERE t.isActive = 1';
    if (hasSearch) {
        where += ' AND (t.trainNumber LIKE @search OR t.trainName LIKE @search OR t.source LIKE @search OR t.destination LIKE @search)';
        countReq.input('search', 'NVarChar', `%${trimmed}%`);
        dataReq.input('search', 'NVarChar', `%${trimmed}%`);
    }
    if (trainType) {
        where += ' AND tt.code = @trainType';
        countReq.input('trainType', 'NVarChar', trainType);
        dataReq.input('trainType', 'NVarChar', trainType);
    }
    if (source) {
        where += ' AND (ss.code LIKE @source OR t.source LIKE @source)';
        countReq.input('source', 'NVarChar', `%${source}%`);
        dataReq.input('source', 'NVarChar', `%${source}%`);
    }
    if (destination) {
        where += ' AND (ds.code LIKE @destination OR t.destination LIKE @destination)';
        countReq.input('destination', 'NVarChar', `%${destination}%`);
        dataReq.input('destination', 'NVarChar', `%${destination}%`);
    }
    if (status) {
        where += ' AND t.runningStatus = @status';
        countReq.input('status', 'NVarChar', status);
        dataReq.input('status', 'NVarChar', status);
    }

    const fromJoin = `
        FROM Trains t
        LEFT JOIN TrainTypes tt ON tt.id = t.trainTypeId
        LEFT JOIN Stations ss ON ss.id = t.sourceStationId
        LEFT JOIN Stations ds ON ds.id = t.destinationStationId
    `;

    const [countResult, dataResult] = await Promise.all([
        countReq.query(`SELECT COUNT(*) AS total ${fromJoin} ${where}`),
        dataReq.query(`
            SELECT t.*, tt.code AS trainTypeCode, tt.name AS trainTypeName,
                   ss.code AS sourceStationCode, ds.code AS destStationCode,
                   (SELECT COUNT(*) FROM TrainStops ts WHERE ts.trainId = t.id) AS stopCount,
                   dis.sourceName AS dataSourceName, dis.importedAt AS dataImportedAt
            ${fromJoin}
            LEFT JOIN DataImportSources dis ON dis.id = t.dataSourceId
            ${where}
            ORDER BY t.trainNumber ASC
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
        `)
    ]);

    const totalItems = countResult.recordset[0].total;
    const rows = dataResult.recordset;
    const classesMap = await trainClassRepository.findByTrainIds(rows.map((r) => r.id));
    const items = rows.map((row) => ({
        ...formatTrain(row, classesMap[row.id] || []),
        trainType: row.trainTypeName,
        trainTypeCode: row.trainTypeCode,
        sourceStationCode: row.sourceStationCode,
        destStationCode: row.destStationCode,
        stopCount: row.stopCount || 0,
        dataSourceName: row.dataSourceName,
        dataImportedAt: row.dataImportedAt
    }));

    return {
        items,
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize) || 1
    };
};

module.exports = {
    findAll,
    search,
    findById,
    findByNumber,
    create,
    update,
    remove,
    findPaginated
};
