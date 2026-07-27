const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..', '..');
const portableNode = path.join(projectRoot, '.tools', 'node-v22.14.0-win-x64', 'node.exe');
const nodeExecutable = fs.existsSync(portableNode) ? portableNode : process.execPath;
const scriptPath = process.argv[2];

if (!scriptPath) {
    console.error('Usage: node backend/scripts/run.js <script-path>');
    process.exit(1);
}

const result = spawnSync(nodeExecutable, [scriptPath], {
    cwd: path.join(projectRoot, 'backend'),
    stdio: 'inherit',
    env: process.env
});

process.exit(result.status ?? 1);
