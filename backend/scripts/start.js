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
