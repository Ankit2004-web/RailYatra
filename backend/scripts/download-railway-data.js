#!/usr/bin/env node
/**
 * Cross-platform download of DataMeet Indian Railways JSON (CC0).
 * Source: https://github.com/datameet/railways
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const rawDir = path.join(__dirname, '../../database/data/railway/raw');

const FILES = {
    'datameet-stations.json': 'https://raw.githubusercontent.com/datameet/railways/master/stations.json',
    'datameet-trains.json': 'https://raw.githubusercontent.com/datameet/railways/master/trains.json',
    'datameet-schedules.json': 'https://raw.githubusercontent.com/datameet/railways/master/schedules.json'
};

function download(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const client = url.startsWith('https') ? https : http;

        const request = client.get(url, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                file.close();
                fs.unlink(dest, () => {});
                download(response.headers.location, dest).then(resolve).catch(reject);
                return;
            }
            if (response.statusCode !== 200) {
                file.close();
                fs.unlink(dest, () => {});
                reject(new Error(`HTTP ${response.statusCode} for ${url}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => file.close(resolve));
        });

        request.on('error', (err) => {
            file.close();
            fs.unlink(dest, () => {});
            reject(err);
        });
        request.setTimeout(600000, () => {
            request.destroy(new Error(`Timeout downloading ${url}`));
        });
    });
}

async function downloadRailwayData({ force = false } = {}) {
    fs.mkdirSync(rawDir, { recursive: true });
    for (const [name, url] of Object.entries(FILES)) {
        const dest = path.join(rawDir, name);
        if (!force && fs.existsSync(dest) && fs.statSync(dest).size > 0) {
            console.log(`  Skip (exists): ${name}`);
            continue;
        }
        console.log(`  Downloading ${name}...`);
        await download(url, dest);
        console.log(`  Saved ${name} (${Math.round(fs.statSync(dest).size / 1024 / 1024)} MB)`);
    }
}

if (require.main === module) {
    downloadRailwayData()
        .then(() => {
            console.log('Download complete.');
            process.exit(0);
        })
        .catch((err) => {
            console.error('Download failed:', err.message);
            process.exit(1);
        });
}

module.exports = { downloadRailwayData, rawDir };
