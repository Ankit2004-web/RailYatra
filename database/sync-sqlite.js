const fs = require('fs');
const path = require('path');
const { runQuery, closePool, resetDatabase } = require('./connection');

const CORE_TABLES = ['Users', 'Stations', 'Trains', 'TrainClasses', 'Bookings', 'Passengers', 'Seats', 'TrainStops'];

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
    ]
};

function loadSchemaStatements() {
    const schemaPath = path.join(__dirname, 'schema-sqlite.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    return schema
        .split(';')
        .map((stmt) => stmt.trim())
        .filter((stmt) => stmt && !stmt.startsWith('--'));
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
