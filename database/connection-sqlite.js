const fs = require('fs');
const path = require('path');
const { requireFromBackend } = require('./bootstrap');

const Database = requireFromBackend('better-sqlite3');

const dbPath = process.env.SQLITE_PATH
    || path.join(__dirname, '../backend/data/railyatra.db');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const dbName = process.env.DB_NAME || 'RailwayReservation';

function normalizeSql(sqlText) {
    let text = sqlText;

    text = text.replace(/\bSELECT\s+TOP\s+\(([^)]+)\)/gi, 'SELECT');
    text = text.replace(/\bSELECT\s+TOP\s+(\d+)/gi, 'SELECT');
    text = text.replace(/\bGETDATE\(\)/gi, "datetime('now')");
    text = text.replace(/\bSYSUTCDATETIME\(\)/gi, "datetime('now')");
    text = text.replace(/\bISNULL\(/gi, 'IFNULL(');
    text = text.replace(/\bdbo\./gi, '');
    text = text.replace(/\[([^\]]+)\]/g, '$1');
    text = text.replace(/\bNVarChar\b/gi, 'TEXT');
    text = text.replace(/\bBit\b/gi, 'INTEGER');
    text = text.replace(/\bOUTPUT INSERTED\.\*/gi, '');
    text = text.replace(/\bOUTPUT INSERTED\.([a-zA-Z0-9_]+)/gi, '');

    if (/^\s*SELECT\b/i.test(text) && !/\bLIMIT\b/i.test(text)) {
        const topMatch = sqlText.match(/\bTOP\s+\(([^)]+)\)/i) || sqlText.match(/\bTOP\s+(\d+)/i);
        if (topMatch) {
            text = `${text.trim()} LIMIT ${topMatch[1]}`;
        }
    }

    return text.trim();
}

const runQuery = (sqlText, params = []) => {
    const text = normalizeSql(sqlText);
    const stmt = db.prepare(text);
    const op = text.split(/\s+/)[0].toUpperCase();

    if (op === 'SELECT' || op === 'WITH') {
        return stmt.all(...params);
    }

    stmt.run(...params);
    if (/INSERT/i.test(text)) {
        const row = db.prepare('SELECT last_insert_rowid() AS id').get();
        return [{ id: row.id }];
    }
    return [];
};

const withTransaction = async (callback) => {
    const query = (sqlText, params = []) => Promise.resolve(runQuery(sqlText, params));
    const tx = db.transaction(() => callback({ query }));
    return tx();
};

class Request {
    constructor() {
        this.params = [];
    }

    input(name, _type, value) {
        this.params.push({ name, value });
        return this;
    }

    async query(sqlText) {
        const values = [];
        const paramLookup = new Map(this.params.map((param) => [param.name, param.value]));

        let text = sqlText;
        text = text.replace(/@([A-Za-z_][A-Za-z0-9_]*)/g, (_match, name) => {
            if (!paramLookup.has(name)) {
                throw new Error(`Missing SQL parameter: @${name}`);
            }
            values.push(paramLookup.get(name));
            return '?';
        });

        const hasOutput = /OUTPUT\s+INSERTED/i.test(text);
        const table = extractInsertTable(text);
        text = normalizeSql(text.replace(/\s*OUTPUT\s+INSERTED\.\*/gi, ''));

        if (/^\s*INSERT/i.test(text)) {
            db.prepare(text).run(...values);
            const row = db.prepare(`SELECT * FROM ${table} ORDER BY id DESC LIMIT 1`).get();
            return { recordset: row ? [row] : [], rowsAffected: [1] };
        }

        const rows = runQuery(text, values);
        if (hasOutput && rows.length === 1 && rows[0].id) {
            const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(rows[0].id);
            return { recordset: row ? [row] : rows, rowsAffected: [1] };
        }

        return { recordset: Array.isArray(rows) ? rows : [rows], rowsAffected: [rows.length || 0] };
    }
}

function extractInsertTable(sqlText) {
    const match = sqlText.match(/INSERT\s+INTO\s+([A-Za-z0-9_]+)/i);
    return match ? match[1] : 'Users';
}

const getPool = async () => ({
    request: () => new Request(),
    close: async () => {}
});

const closePool = async () => {
    // Keep SQLite open for the app lifetime (sync/seed also call closePool).
};

const buildConnectionString = () => `sqlite://${dbPath}`;

const loadDriver = () => Database;

module.exports = {
    sql: {},
    getPool,
    getMasterPool: getPool,
    closePool,
    buildConnectionString,
    dbName,
    runQuery,
    withTransaction,
    loadDriver
};
