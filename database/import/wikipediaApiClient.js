/**
 * MediaWiki API client for fetching individual train article pages.
 * Caches responses under database/data/railway/raw/wiki-pages/
 */
const fs = require('fs');
const path = require('path');

const API_BASE = 'https://en.wikipedia.org/w/api.php';
const USER_AGENT = 'RailYatra/1.0 (https://github.com/Ankit2004-web/RailYatra; railway data enrichment)';
const CACHE_DIR = path.join(__dirname, '../data/railway/raw/wiki-pages');

function cachePath(pageTitle) {
    const safe = String(pageTitle).replace(/[^\w.-]+/g, '_').slice(0, 120);
    return path.join(CACHE_DIR, `${safe}.json`);
}

async function fetchJson(url) {
    const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }
    });
    if (!res.ok) throw new Error(`Wikipedia API HTTP ${res.status}: ${url}`);
    return res.json();
}

async function searchPageTitle(query) {
    const params = new URLSearchParams({
        action: 'query',
        list: 'search',
        srsearch: query,
        srlimit: '5',
        format: 'json',
        origin: '*'
    });
    const data = await fetchJson(`${API_BASE}?${params}`);
    return data?.query?.search?.[0]?.title || null;
}

async function fetchPageByTitle(pageTitle, options = {}) {
    const useCache = options.useCache !== false;
    const file = cachePath(pageTitle);

    if (useCache && fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    }

    const params = new URLSearchParams({
        action: 'parse',
        page: pageTitle,
        prop: 'wikitext|text',
        format: 'json',
        origin: '*'
    });
    const data = await fetchJson(`${API_BASE}?${params}`);
    if (data?.error) {
        throw new Error(data.error.info || `Page not found: ${pageTitle}`);
    }

    const payload = {
        title: data.parse.title,
        pageid: data.parse.pageid,
        wikitext: data.parse.wikitext['*'],
        html: data.parse.text['*'],
        fetchedAt: new Date().toISOString()
    };

    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(payload, null, 2));
    return payload;
}

async function fetchTrainPage({ pageTitle, trainNumber, searchQuery }) {
    if (pageTitle) {
        return fetchPageByTitle(pageTitle);
    }
    const query = searchQuery || `${trainNumber} Indian Railways express`;
    const title = await searchPageTitle(query);
    if (!title) throw new Error(`No Wikipedia page found for: ${query}`);
    return fetchPageByTitle(title);
}

module.exports = {
    API_BASE,
    CACHE_DIR,
    cachePath,
    fetchPageByTitle,
    fetchTrainPage,
    searchPageTitle
};
