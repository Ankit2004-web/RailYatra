#!/usr/bin/env node
/**
 * Download datameet/railways JSON (CC0) and import into SQL Server.
 * Usage: npm run import:datameet
 */
const path = require('path');
const syncDatabase = require('../sync');
const { closePool } = require('../connection');
const DatameetRailwayImporter = require('./DatameetRailwayImporter');
const { downloadRailwayData, rawDir } = require('../../backend/scripts/download-railway-data');

async function downloadIfMissing() {
    const files = ['datameet-stations.json', 'datameet-trains.json', 'datameet-schedules.json'];
    const missing = files.filter((f) => !require('fs').existsSync(path.join(rawDir, f)));
    if (!missing.length) return;
    console.log('Downloading datameet/railways datasets...');
    await downloadRailwayData();
}

async function main() {
    await downloadIfMissing();
    console.log('Syncing database schema...');
    await syncDatabase();

    console.log('Starting datameet bulk import...');
    const { setSkipPersist, flushDb } = require('../connection');
    setSkipPersist(true);
    const importer = new DatameetRailwayImporter({ rawDir });
    const report = await importer.run();
    setSkipPersist(false);
    flushDb();

    console.log('\n=== Import Complete ===');
    console.log(JSON.stringify(report.details, null, 2));
    await closePool();
    process.exit(0);
}

if (require.main === module) {
    main().catch((err) => {
        console.error('Import failed:', err);
        process.exit(1);
    });
}

module.exports = main;
