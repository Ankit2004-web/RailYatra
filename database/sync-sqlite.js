const fs = require('fs');
const path = require('path');
const { runQuery, closePool } = require('./connection');

const TRAIN_STOPS_DDL = `CREATE TABLE TrainStops (
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
        ['toStationId', 'INTEGER']
    ],
    Passengers: [
        ['berthPreference', 'TEXT'],
        ['passengerStatus', "TEXT DEFAULT 'Confirmed'"]
    ],
    Users: [
        ['mfaEnabled', 'INTEGER DEFAULT 0'],
        ['mfaSecret', 'TEXT']
    ]
};

async function tableColumns(table) {
    const info = await runQuery(`PRAGMA table_info(${table})`);
    return new Set(info.map((col) => col.name));
}

async function ensureColumns() {
    for (const [table, columns] of Object.entries(COLUMN_PATCHES)) {
        const existing = await tableColumns(table);
        for (const [name, definition] of columns) {
            if (!existing.has(name)) {
                await runQuery(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
                console.log(`Added column ${table}.${name}`);
            }
        }
    }
}

async function repairTrainStopsTable() {
    const tables = await runQuery("SELECT name FROM sqlite_master WHERE type='table' AND name='TrainStops'");
    if (!tables.length) {
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

async function syncSqliteDatabase() {
    try {
        console.log('Using SQLite (free cloud demo mode)...');
        console.log(`Database file: ${process.env.SQLITE_PATH || 'backend/data/railyatra.db'}`);

        await runQuery('SELECT 1 AS ok');
        console.log('SQLite connected.');

        const schemaPath = path.join(__dirname, 'schema-sqlite.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        const statements = schema
            .split(';')
            .map((stmt) => stmt.trim())
            .filter((stmt) => stmt && !stmt.startsWith('--'));

        console.log('Syncing tables...');
        for (const statement of statements) {
            await runQuery(`${statement};`);
        }

        await ensureColumns();
        await repairTrainStopsTable();
        console.log('Database schema is up to date.');
    } catch (error) {
        console.error('SQLite sync failed:', error.message);
        process.exit(1);
    } finally {
        await closePool();
    }
}

module.exports = syncSqliteDatabase;
