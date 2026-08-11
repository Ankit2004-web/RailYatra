const fs = require('fs');
const path = require('path');

const MIN_MASTER_BYTES = 5 * 1024 * 1024;
const MIN_MASTER_STATIONS = 500;

function getProjectRoot() {
    return path.join(__dirname, '..');
}

function resolveMasterPath() {
    const projectRoot = getProjectRoot();
    const masterCandidate = process.env.SQLITE_MASTER_PATH || 'backend/data/railyatra-master.db';
    return path.isAbsolute(masterCandidate)
        ? masterCandidate
        : path.join(projectRoot, masterCandidate);
}

function resolveRuntimePath() {
    const projectRoot = getProjectRoot();
    const configured = process.env.SQLITE_PATH;
    if (shouldUseProductionRuntimeCopy()) {
        if (process.env.SQLITE_RUNTIME_PATH) {
            return process.env.SQLITE_RUNTIME_PATH;
        }
        return process.platform === 'win32'
            ? path.join(projectRoot, 'backend/data/railyatra-runtime.db')
            : '/tmp/railyatra-runtime.db';
    }
    if (!configured) {
        return path.join(projectRoot, 'backend/data/railyatra.db');
    }
    if (path.isAbsolute(configured)) {
        return configured;
    }
    return path.join(projectRoot, configured);
}

function fileSizeMb(filePath) {
    if (!fs.existsSync(filePath)) return 0;
    return Math.round((fs.statSync(filePath).size / 1024 / 1024) * 100) / 100;
}

function shouldUseProductionRuntimeCopy() {
    const isSqlite = (process.env.DB_DRIVER || '').toLowerCase() === 'sqlite';
    if (!isSqlite) return false;
    if (process.env.RENDER) return true;
    if (process.env.SQLITE_USE_RUNTIME_COPY === '1') return true;
    if (process.env.SQLITE_RUNTIME_PATH) return true;
    return false;
}

/**
 * Copy bundled master SQLite DB into the ephemeral runtime path on cloud hosts.
 * Re-copy when runtime looks like demo/stale data (much smaller than master).
 */
function ensureRuntimeFromMaster() {
    if (!shouldUseProductionRuntimeCopy()) {
        return { copied: false, masterPath: null, runtimePath: null };
    }

    const masterPath = resolveMasterPath();
    const runtimePath = resolveRuntimePath();
    const masterExists = fs.existsSync(masterPath);
    const runtimeExists = fs.existsSync(runtimePath);
    const masterSize = fileSizeMb(masterPath);
    const runtimeSize = fileSizeMb(runtimePath);

    if (!masterExists) {
        console.warn(`SQLite: master database missing at ${masterPath} — only demo seed data will load.`);
        console.warn('SQLite: run npm run build:sqlite-master during deploy to bundle nationwide trains.');
        return { copied: false, masterPath, runtimePath, masterExists: false };
    }

    console.log(`SQLite: master database ${masterSize} MB at ${masterPath}`);

    let copied = false;
    const runtimeLooksDemo = runtimeExists && masterSize >= MIN_MASTER_BYTES && runtimeSize < masterSize * 0.5;

    if (!runtimeExists || runtimeLooksDemo) {
        fs.mkdirSync(path.dirname(runtimePath), { recursive: true });
        fs.copyFileSync(masterPath, runtimePath);
        copied = true;
        console.log(
            runtimeLooksDemo
                ? `SQLite: refreshed runtime database from master (${fileSizeMb(runtimePath)} MB at ${runtimePath})`
                : `SQLite: initialized runtime database from master (${fileSizeMb(runtimePath)} MB at ${runtimePath})`
        );
    } else {
        console.log(`SQLite: using existing runtime database (${runtimeSize} MB at ${runtimePath})`);
    }

    return { copied, masterPath, runtimePath, masterExists: true, masterSize, runtimeSize };
}

module.exports = {
    MIN_MASTER_STATIONS,
    resolveMasterPath,
    resolveRuntimePath,
    ensureRuntimeFromMaster,
    shouldUseProductionRuntimeCopy
};
