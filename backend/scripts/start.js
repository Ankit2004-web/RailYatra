const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { assertSupportedNodeVersion } = require('../utils/nodeVersion');

const projectRoot = path.join(__dirname, '..', '..');
const portableNode = path.join(projectRoot, '.tools', 'node-v22.14.0-win-x64', 'node.exe');
const serverEntry = path.join(projectRoot, 'backend', 'server.js');
const frontendDist = path.join(projectRoot, 'frontend', 'dist');

const nodeExecutable = fs.existsSync(portableNode) ? portableNode : process.execPath;

if (nodeExecutable === process.execPath) {
    assertSupportedNodeVersion();
}

const isSqliteProduction = (process.env.DB_DRIVER || '').toLowerCase() === 'sqlite'
    && (process.env.RENDER || process.env.SQLITE_USE_RUNTIME_COPY === '1');

if (isSqliteProduction) {
    const { resolveMasterPath } = require('../../database/sqlite-production-bootstrap');
    const masterPath = resolveMasterPath();
    const minBytes = 5 * 1024 * 1024;
    if (!fs.existsSync(masterPath) || fs.statSync(masterPath).size < minBytes) {
        console.log('SQLite master database missing or incomplete — building before server start...');
        execSync('node scripts/build-sqlite-master.js', {
            cwd: path.join(projectRoot, 'backend'),
            stdio: 'inherit',
            env: process.env
        });
    }
}

if (!fs.existsSync(path.join(frontendDist, 'index.html'))) {
    console.log('React frontend not built — building now...');
    execSync('npm run build --prefix frontend', { cwd: projectRoot, stdio: 'inherit' });
}

const child = spawn(nodeExecutable, [serverEntry], {
    cwd: path.join(projectRoot, 'backend'),
    stdio: 'inherit',
    env: process.env
});

child.on('exit', (code) => process.exit(code ?? 0));
