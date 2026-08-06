#!/usr/bin/env node
/**
 * Import individual Wikipedia train pages (routes + exact coach counts).
 * Usage: npm run import:wikipedia-pages
 */
const path = require('path');
const { closePool } = require('../connection');
const WikipediaTrainPageImporter = require('./WikipediaTrainPageImporter');

async function main() {
    const manifestPath = process.env.WIKI_PAGES_MANIFEST
        || path.join(__dirname, '../data/railway/wiki-train-pages.manifest.json');

    console.log('Starting Wikipedia train page import...');
    console.log(`Manifest: ${manifestPath}`);

    const importer = new WikipediaTrainPageImporter({ manifestPath });
    const report = await importer.run();

    console.log('\n=== Wikipedia Train Page Import ===');
    console.log(`Pages fetched: ${report.pagesFetched}`);
    console.log(`Trains processed: ${report.trainsProcessed}`);
    console.log(`Inserted: ${report.inserted}, Updated: ${report.updated}`);
    console.log(`Stops imported: ${report.stopsImported}`);
    console.log(`Classes updated: ${report.classesUpdated}`);
    console.log(`Rake counts saved: ${report.rakeCountsSaved}`);
    if (report.warnings.length) console.log('Warnings:', report.warnings.slice(0, 10));
    if (report.errors.length) console.log('Errors:', report.errors);

    await closePool();
    process.exit(report.errors.length > 0 ? 1 : 0);
}

main().catch(async (err) => {
    console.error('Wikipedia page import failed:', err);
    try { await closePool(); } catch (_) { /* ignore */ }
    process.exit(1);
});
