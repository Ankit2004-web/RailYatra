const fs = require('fs');
const path = require('path');
const { runQuery, closePool } = require('./connection');

const COLUMN_PATCHES = {
    TrainStops: [
        ['stationId', 'INTEGER'],
        ['haltMinutes', 'INTEGER NOT NULL DEFAULT 0'],
        ['arrivalDayOffset', 'INTEGER NOT NULL DEFAULT 0'],
        ['departureDayOffset', 'INTEGER NOT NULL DEFAULT 0'],
        ['platformHint', 'TEXT'],
        ['isTechnicalStop', 'INTEGER NOT NULL DEFAULT 0']
    ],
    Bookings: [
        ['grandTotal', 'REAL'],
        ['paymentBreakdown', 'TEXT'],
        ['fromStationId', 'INTEGER'],
        ['toStationId', 'INTEGER']
    ],
    Passengers: [
        ['berthPreference', 'TEXT'],
        ['passengerStatus', "TEXT NOT NULL DEFAULT 'Confirmed'"]
    ],
    Users: [
        ['mfaEnabled', 'INTEGER NOT NULL DEFAULT 0'],
        ['mfaSecret', 'TEXT']
    ]
};

async function ensureColumns() {
    for (const [table, columns] of Object.entries(COLUMN_PATCHES)) {
        const info = await runQuery(`PRAGMA table_info(${table})`);
        const existing = new Set(info.map((col) => col.name));
        for (const [name, definition] of columns) {
            if (!existing.has(name)) {
                await runQuery(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
                console.log(`Added column ${table}.${name}`);
            }
        }
    }
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
        console.log('Database schema is up to date.');
    } catch (error) {
        console.error('SQLite sync failed:', error.message);
        process.exit(1);
    } finally {
        await closePool();
    }
}

module.exports = syncSqliteDatabase;
