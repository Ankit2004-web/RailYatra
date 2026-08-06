#!/usr/bin/env node
/**
 * Build nationwide SQLite master DB from DataMeet JSON (for Render deploy).
 * Run during build: npm run build:sqlite-master
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '../..');
const masterDb = path.join(projectRoot, 'backend/data/railyatra-master.db');

process.env.DB_DRIVER = 'sqlite';
process.env.SQLITE_PATH = masterDb;

async function main() {
    const { downloadRailwayData } = require('./download-railway-data');
    const syncSqlite = require('../../database/sync-sqlite');
    const { runQuery, setSkipPersist, flushDb, closePool, resetDatabase } = require('../../database/connection');
    const DatameetRailwayImporter = require('../../database/import/DatameetRailwayImporter');

    fs.mkdirSync(path.dirname(masterDb), { recursive: true });

    if (fs.existsSync(masterDb) && process.env.FORCE_REBUILD_MASTER !== '1') {
        await syncSqlite();
        const existing = await runQuery('SELECT COUNT(*) AS c FROM Stations');
        const stationCount = existing[0]?.c || 0;
        if (stationCount > 1000) {
            console.log(`Master DB already built (${stationCount} stations). Skipping import.`);
            await closePool();
            return;
        }
    }

    console.log('=== Building SQLite master database ===');
    console.log(`Target: ${masterDb}`);

    await downloadRailwayData();
    if (fs.existsSync(masterDb)) {
        await resetDatabase();
    }
    await syncSqlite();

    setSkipPersist(true);
    const started = Date.now();
    const importer = new DatameetRailwayImporter();
    const report = await importer.run();
    setSkipPersist(false);
    flushDb();

    try {
        const { backfillTrainClass2S } = require('../../database/backfill-train-class-2s');
        await backfillTrainClass2S();
        flushDb();
    } catch (err) {
        console.warn('2S class backfill skipped:', err.message);
    }

    try {
        const wikiListPath = path.join(projectRoot, 'database/data/railway/raw/wikipedia-trains-list.md');
        if (fs.existsSync(wikiListPath)) {
            const WikipediaRailwayImporter = require('../../database/import/WikipediaRailwayImporter');
            console.log('Enriching trains from Wikipedia list...');
            const wikiImporter = new WikipediaRailwayImporter({ listPath: wikiListPath });
            const wikiReport = await wikiImporter.run();
            flushDb();
            console.log(`Wikipedia: matched ${wikiReport.matchedExisting}, inserted ${wikiReport.inserted}, skipped ${wikiReport.skipped}`);
        } else {
            console.log('Wikipedia list not bundled — skip (add database/data/railway/raw/wikipedia-trains-list.md)');
        }
    } catch (err) {
        console.warn('Wikipedia enrichment skipped:', err.message);
    }

    const stations = await runQuery('SELECT COUNT(*) AS c FROM Stations');
    const trains = await runQuery('SELECT COUNT(*) AS c FROM Trains');
    const stops = await runQuery('SELECT COUNT(*) AS c FROM TrainStops WHERE stationId IS NOT NULL');

    console.log('\n=== Master DB build complete ===');
    console.log(`Stations: ${stations[0]?.c || 0}`);
    console.log(`Trains: ${trains[0]?.c || 0}`);
    console.log(`Linked stops: ${stops[0]?.c || 0}`);
    console.log(`Elapsed: ${Math.round((Date.now() - started) / 1000)}s`);
    console.log(JSON.stringify(report.details, null, 2));

    await closePool();
}

main().catch(async (err) => {
    console.error('Master DB build failed:', err.message);
    try {
        const { closePool } = require('../../database/connection');
        await closePool();
    } catch (_) { /* ignore */ }
    process.exit(1);
});
