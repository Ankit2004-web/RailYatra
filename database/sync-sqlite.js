const fs = require('fs');
const path = require('path');
const { runQuery, closePool } = require('./connection');

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

        console.log('Database schema is up to date.');
    } catch (error) {
        console.error('SQLite sync failed:', error.message);
        process.exit(1);
    } finally {
        await closePool();
    }
}

module.exports = syncSqliteDatabase;
