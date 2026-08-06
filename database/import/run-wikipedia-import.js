#!/usr/bin/env node
/**
 * Import / enrich trains from Wikipedia list page.
 * Usage: npm run import:wikipedia
 */
const path = require('path');
const fs = require('fs');
const syncDatabase = require('../sync');
const { closePool } = require('../connection');
const WikipediaRailwayImporter = require('./WikipediaRailwayImporter');

const defaultListPath = path.join(__dirname, '../data/railway/raw/wikipedia-trains-list.md');
const uploadFallback = path.join(__dirname, '../../uploads/List_of_trains_run_by_Indian_Railways-0.md');

async function ensureListFile(listPath) {
    if (fs.existsSync(listPath)) return listPath;
    if (fs.existsSync(uploadFallback)) {
        fs.mkdirSync(path.dirname(listPath), { recursive: true });
        fs.copyFileSync(uploadFallback, listPath);
        console.log(`Copied Wikipedia list to ${listPath}`);
        return listPath;
    }
    throw new Error(
        `Wikipedia list not found. Save the page markdown to:\n  ${listPath}\n`
        + 'Source: https://en.wikipedia.org/wiki/List_of_trains_run_by_Indian_Railways'
    );
}

async function main() {
    const listPath = await ensureListFile(
        process.argv.find((arg) => arg.startsWith('--file='))?.slice(7) || defaultListPath
    );

    console.log('Syncing database schema...');
    await syncDatabase();

    console.log('Starting Wikipedia train list import...');
    const { setSkipPersist, flushDb } = require('../connection');
    setSkipPersist(true);
    const importer = new WikipediaRailwayImporter({ listPath });
    const report = await importer.run();
    setSkipPersist(false);
    flushDb();

    console.log('\n=== Wikipedia Import Complete ===');
    console.log(`Parsed: ${report.parsed}`);
    console.log(`Matched existing: ${report.matchedExisting}`);
    console.log(`Inserted (new wiki stubs): ${report.inserted}`);
    console.log(`Updated: ${report.updated}`);
    console.log(`Skipped: ${report.skipped}`);
    console.log(`Failed: ${report.failed}`);
    console.log(`Classes upserted: ${report.classesUpserted}`);
    console.log(`Boarding/drop stops created: ${report.stopsCreated}`);

    await closePool();
    process.exit(0);
}

if (require.main === module) {
    main().catch((err) => {
        console.error('Wikipedia import failed:', err);
        process.exit(1);
    });
}

module.exports = main;
