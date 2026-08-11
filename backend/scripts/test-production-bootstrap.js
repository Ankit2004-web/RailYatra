#!/usr/bin/env node
/** Quick test for production SQLite bootstrap (master → runtime copy). */
const fs = require('fs');
const path = require('path');

process.env.DB_DRIVER = 'sqlite';
process.env.RENDER = '1';
process.env.SQLITE_RUNTIME_PATH = path.join(__dirname, '../data/railyatra-runtime-test.db');
process.env.SQLITE_MASTER_PATH = path.join(__dirname, '../data/railyatra-master.db');

const runtimePath = process.env.SQLITE_RUNTIME_PATH;
if (fs.existsSync(runtimePath)) fs.unlinkSync(runtimePath);

delete require.cache[require.resolve('../../database/connection-sqlite')];
delete require.cache[require.resolve('../../database/connection')];

const sync = require('../../database/sync-sqlite');
const { runQuery, closePool } = require('../../database/connection');

(async () => {
    await sync();
    const s = await runQuery('SELECT COUNT(*) AS c FROM Stations');
    const t = await runQuery('SELECT COUNT(*) AS c FROM Trains');
    console.log('After bootstrap+sync — stations:', s[0]?.c, 'trains:', t[0]?.c);
    await closePool();
    if (fs.existsSync(runtimePath)) fs.unlinkSync(runtimePath);
})();
