#!/usr/bin/env node
/**
 * Fail Render build if nationwide master DB was not produced.
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '../..');
const masterDb = path.join(projectRoot, 'backend/data/railyatra-master.db');
const MIN_BYTES = 5 * 1024 * 1024;
const MIN_STATIONS = 1000;

async function main() {
    if (!fs.existsSync(masterDb)) {
        console.error(`Master DB missing: ${masterDb}`);
        process.exit(1);
    }

    const sizeMb = Math.round((fs.statSync(masterDb).size / 1024 / 1024) * 100) / 100;
    if (fs.statSync(masterDb).size < MIN_BYTES) {
        console.error(`Master DB too small (${sizeMb} MB) — expected full DataMeet import.`);
        process.exit(1);
    }

    process.env.DB_DRIVER = 'sqlite';
    process.env.SQLITE_PATH = masterDb;
    process.env.NODE_ENV = 'development';

    const { runQuery, closePool } = require('../../database/connection');
    const stations = await runQuery('SELECT COUNT(*) AS c FROM Stations');
    const trains = await runQuery('SELECT COUNT(*) AS c FROM Trains WHERE isActive = 1');
    const stationCount = Number(stations[0]?.c || 0);
    const trainCount = Number(trains[0]?.c || 0);

    console.log(`Master DB verify: ${sizeMb} MB, ${stationCount} stations, ${trainCount} trains`);

    await closePool();

    if (stationCount < MIN_STATIONS || trainCount < 100) {
        console.error('Master DB does not contain nationwide railway catalog.');
        process.exit(1);
    }

    console.log('Master DB verification passed.');
}

main().catch((err) => {
    console.error('Master DB verification failed:', err.message);
    process.exit(1);
});
