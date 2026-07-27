#!/usr/bin/env node
/**
 * CLI: Import railway master data from CSV files.
 * Usage: npm run import:railway
 *        node database/import/run-import.js --dir data/railway/processed
 */
const path = require('path');
const syncDatabase = require('../sync');
const { closePool } = require('../connection');
const RailwayDataImporter = require('./RailwayDataImporter');
const fareSimulationService = require('../../backend/services/fareSimulationService');

async function main() {
    const args = process.argv.slice(2);
    const dirIdx = args.indexOf('--dir');
    const dataDir = dirIdx >= 0 ? path.resolve(args[dirIdx + 1]) : path.join(__dirname, '../data/railway/processed');

    console.log('Syncing database schema...');
    await syncDatabase();

    console.log(`Importing railway data from: ${dataDir}`);
    const importer = new RailwayDataImporter({
        dataDir,
        sourceName: 'Development Representative Dataset',
        licenseNotes: 'DEVELOPMENT / TEST DATA — NOT official Indian Railways timetable data'
    });

    const report = await importer.run();
    await fareSimulationService.seedDefaultFareRulesIfEmpty();

    console.log('\n=== Import Summary ===');
    console.log(JSON.stringify(report.counts, null, 2));
    console.log(`Errors: ${report.errors.length}, Warnings: ${report.warnings.length}`);

    await closePool();
    process.exit(report.errors.length ? 1 : 0);
}

main().catch((err) => {
    console.error('Import failed:', err);
    process.exit(1);
});
