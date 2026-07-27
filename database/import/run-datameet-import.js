#!/usr/bin/env node
/**
 * Download datameet/railways JSON (CC0) and import into SQL Server.
 * Usage: npm run import:datameet
 */
const path = require('path');
const { execSync } = require('child_process');
const syncDatabase = require('../sync');
const { closePool } = require('../connection');
const DatameetRailwayImporter = require('./DatameetRailwayImporter');

const rawDir = path.join(__dirname, '../data/railway/raw');

async function downloadIfMissing() {
    const files = ['datameet-stations.json', 'datameet-trains.json', 'datameet-schedules.json'];
    const missing = files.filter((f) => !require('fs').existsSync(path.join(rawDir, f)));
    if (!missing.length) return;

    console.log('Downloading datameet/railways datasets...');
    const script = path.join(__dirname, '../../backend/scripts/download-railway-data.ps1');
    execSync(`powershell -ExecutionPolicy Bypass -File "${script}" -Target datameet`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '../..')
    });
}

async function main() {
    await downloadIfMissing();
    console.log('Syncing database schema...');
    await syncDatabase();

    console.log('Starting datameet bulk import...');
    const importer = new DatameetRailwayImporter({ rawDir });
    const report = await importer.run();

    console.log('\n=== Import Complete ===');
    console.log(JSON.stringify(report.details, null, 2));
    await closePool();
    process.exit(0);
}

main().catch((err) => {
    console.error('Import failed:', err);
    process.exit(1);
});
