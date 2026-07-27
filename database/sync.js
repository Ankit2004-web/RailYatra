const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { runQuery, closePool } = require('./connection');

function ensureLocalDbRunning() {
    try {
        execSync('sqllocaldb start MSSQLLocalDB', { stdio: 'ignore' });
    } catch (error) {
        // Instance may already be running or sqllocaldb unavailable.
    }
}

async function syncDatabase() {
    try {
        ensureLocalDbRunning();

        console.log('Ensuring database exists...');
        await runQuery(
            `IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'RailwayReservation')
             BEGIN
               CREATE DATABASE RailwayReservation;
             END`,
            [],
            'master'
        );

        console.log('Connecting to application database...');
        await runQuery('SELECT 1 AS ok');
        console.log('SQL Server connected.');

        console.log('Syncing tables...');
        const schemaFiles = ['schema.sql', 'schema-railway-master.sql', 'schema-railway-etl.sql', 'schema-railway-coaches.sql'];
        for (const file of schemaFiles) {
            const schemaPath = path.join(__dirname, file);
            if (!fs.existsSync(schemaPath)) continue;
            const schema = fs.readFileSync(schemaPath, 'utf8');
            const batches = schema
                .split(/^\s*GO\s*$/gim)
                .map((batch) => batch.trim())
                .filter((batch) => batch && !batch.startsWith('USE RailwayReservation'));

            for (const batch of batches) {
                await runQuery(batch);
            }
            console.log(`Applied ${file}`);
        }

        console.log('Database schema is up to date.');
    } catch (error) {
        console.error('Database sync failed:', error.message);
        process.exit(1);
    } finally {
        await closePool();
    }
}

if (require.main === module) {
    syncDatabase();
}

module.exports = syncDatabase;
