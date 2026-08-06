const fs = require('fs');
const path = require('path');
const { runQuery, closePool, resetDatabase } = require('./connection');

const CORE_TABLES = ['Users', 'Stations', 'Trains', 'TrainClasses', 'Bookings', 'Passengers', 'Seats', 'TrainStops', 'BookingSeatAllocations'];

const BOOKING_SEAT_ALLOCATIONS_DDL = `CREATE TABLE IF NOT EXISTS BookingSeatAllocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    passengerId INTEGER NOT NULL,
    journeySeatId INTEGER,
    fromStopSequence INTEGER NOT NULL,
    toStopSequence INTEGER NOT NULL,
    bookingStatus TEXT NOT NULL DEFAULT 'Confirmed',
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (passengerId) REFERENCES Passengers(id) ON DELETE CASCADE
)`;

const TRAIN_STOPS_DDL = `CREATE TABLE IF NOT EXISTS TrainStops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trainId INTEGER NOT NULL,
    stationId INTEGER,
    stationCode TEXT,
    stationName TEXT NOT NULL,
    stopOrder INTEGER NOT NULL,
    arrivalTime TEXT,
    departureTime TEXT,
    arrivalDayOffset INTEGER NOT NULL DEFAULT 0,
    departureDayOffset INTEGER NOT NULL DEFAULT 0,
    haltMinutes INTEGER NOT NULL DEFAULT 0,
    distanceKm INTEGER,
    platformHint TEXT,
    isTechnicalStop INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (trainId, stopOrder)
)`;

const COLUMN_PATCHES = {
    Stations: [
        ['normalizedName', 'TEXT'],
        ['isActive', 'INTEGER DEFAULT 1'],
        ['stateId', 'INTEGER'],
        ['zoneId', 'INTEGER'],
        ['latitude', 'REAL'],
        ['longitude', 'REAL'],
        ['dataSourceId', 'INTEGER']
    ],
    Trains: [
        ['normalizedName', 'TEXT'],
        ['isActive', 'INTEGER DEFAULT 1'],
        ['trainTypeId', 'INTEGER'],
        ['sourceStationId', 'INTEGER'],
        ['destinationStationId', 'INTEGER'],
        ['dataSourceId', 'INTEGER']
    ],
    TrainClasses: [
        ['travelClassId', 'INTEGER'],
        ['isAvailable', 'INTEGER DEFAULT 1']
    ],
    TrainStops: [
        ['stationId', 'INTEGER'],
        ['haltMinutes', 'INTEGER DEFAULT 0'],
        ['arrivalDayOffset', 'INTEGER DEFAULT 0'],
        ['departureDayOffset', 'INTEGER DEFAULT 0'],
        ['platformHint', 'TEXT'],
        ['isTechnicalStop', 'INTEGER DEFAULT 0']
    ],
    Bookings: [
        ['grandTotal', 'REAL'],
        ['paymentBreakdown', 'TEXT'],
        ['fromStationId', 'INTEGER'],
        ['toStationId', 'INTEGER'],
        ['paymentHoldExpiresAt', 'TEXT']
    ],
    Passengers: [
        ['nationality', "TEXT DEFAULT 'Indian'"],
        ['mobile', 'TEXT'],
        ['email', 'TEXT'],
        ['idType', 'TEXT'],
        ['idNumber', 'TEXT'],
        ['foodPreference', 'TEXT'],
        ['insuranceOptIn', 'INTEGER NOT NULL DEFAULT 0'],
        ['isSeniorCitizen', 'INTEGER NOT NULL DEFAULT 0'],
        ['isDivyang', 'INTEGER NOT NULL DEFAULT 0']
    ]
};

function loadSchemaStatements() {
    const files = ['schema-sqlite.sql', 'schema-sqlite-master.sql'];
    const statements = [];
    for (const file of files) {
        const schemaPath = path.join(__dirname, file);
        if (!fs.existsSync(schemaPath)) continue;
        const schema = fs.readFileSync(schemaPath, 'utf8').replace(/--[^\n]*/g, '');
        statements.push(...schema
            .split(';')
            .map((stmt) => stmt.trim())
            .filter(Boolean));
    }
    return statements;
}

async function tableExists(table) {
    const rows = await runQuery(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        [table]
    );
    return rows.length > 0;
}

async function tableColumns(table) {
    const info = await runQuery(`PRAGMA table_info(${table})`);
    return new Set(info.map((col) => col.name));
}

async function applySchema(statements) {
    for (const statement of statements) {
        await runQuery(`${statement};`);
    }
}

async function ensureColumns() {
    for (const [table, columns] of Object.entries(COLUMN_PATCHES)) {
        if (!(await tableExists(table))) {
            console.log(`Skipping column patches — table missing: ${table}`);
            continue;
        }
        const existing = await tableColumns(table);
        for (const [name, definition] of columns) {
            if (!existing.has(name)) {
                await runQuery(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
                console.log(`Added column ${table}.${name}`);
            }
        }
    }
}

async function ensureIndexes() {
    const indexes = [
        'CREATE INDEX IF NOT EXISTS IX_TrainRunningDays_TrainId ON TrainRunningDays(trainId)',
        'CREATE INDEX IF NOT EXISTS IX_Stations_NormalizedName ON Stations(normalizedName)',
        'CREATE INDEX IF NOT EXISTS IX_Trains_SourceStationId ON Trains(sourceStationId)',
        'CREATE INDEX IF NOT EXISTS IX_Trains_DestinationStationId ON Trains(destinationStationId)',
        'CREATE INDEX IF NOT EXISTS IX_TrainStops_StationId ON TrainStops(stationId)',
        'CREATE INDEX IF NOT EXISTS IX_TrainStops_Train_Station ON TrainStops(trainId, stationId)',
        'CREATE INDEX IF NOT EXISTS IX_BSA_Seat_Stops ON BookingSeatAllocations(journeySeatId, fromStopSequence, toStopSequence)'
    ];
    for (const ddl of indexes) {
        try {
            await runQuery(ddl);
        } catch (error) {
            console.warn(`Index skipped: ${error.message}`);
        }
    }
}

async function repairTrainStopsTable() {
    if (!(await tableExists('TrainStops'))) {
        await runQuery(TRAIN_STOPS_DDL);
        console.log('Created TrainStops table.');
        return;
    }

    const columns = await tableColumns('TrainStops');
    if (columns.has('haltMinutes')) return;

    console.log('Recreating TrainStops table (missing haltMinutes)...');
    await runQuery('DROP TABLE IF EXISTS TrainStops');
    await runQuery(TRAIN_STOPS_DDL);
    console.log('TrainStops table recreated.');
}

async function ensureBookingSeatAllocationsTable() {
    if (await tableExists('BookingSeatAllocations')) return;
    await runQuery(BOOKING_SEAT_ALLOCATIONS_DDL);
    console.log('Created BookingSeatAllocations table.');
}

async function verifyCoreTables() {
    for (const table of CORE_TABLES) {
        if (!(await tableExists(table))) return false;
    }
    return true;
}

async function syncSqliteDatabase() {
    try {
        console.log('Using SQLite (free cloud demo mode)...');
        console.log(`Database file: ${process.env.SQLITE_PATH || 'backend/data/railyatra.db'}`);

        await runQuery('SELECT 1 AS ok');
        console.log('SQLite connected.');

        const statements = loadSchemaStatements();

        console.log('Syncing tables...');
        await applySchema(statements);

        if (!(await verifyCoreTables())) {
            console.log('Core tables missing — rebuilding SQLite database from scratch...');
            await resetDatabase();
            await runQuery('SELECT 1 AS ok');
            await applySchema(statements);
            if (!(await verifyCoreTables())) {
                throw new Error('SQLite rebuild failed — core tables still missing (check schema-sqlite.sql)');
            }
        }

        await ensureColumns();
        await ensureBookingSeatAllocationsTable();
        await ensureIndexes();
        await repairTrainStopsTable();

        try {
            const { backfillTrainClass2S } = require('../database/backfill-train-class-2s');
            await backfillTrainClass2S();
        } catch (err) {
            console.warn('2S class backfill skipped:', err.message);
        }

        console.log('Database schema is up to date.');
    } catch (error) {
        console.error('SQLite sync failed:', error.message);
        process.exit(1);
    } finally {
        await closePool();
    }
}

module.exports = syncSqliteDatabase;
