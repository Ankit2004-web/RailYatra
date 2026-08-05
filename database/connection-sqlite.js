const fs = require('fs');
const path = require('path');
const { requireFromBackend } = require('./bootstrap');

const dbPath = process.env.SQLITE_PATH
    || path.join(__dirname, '../backend/data/railyatra.db');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const dbName = process.env.DB_NAME || 'RailwayReservation';

let db = null;
let initPromise = null;
let skipPersist = false;

function setSkipPersist(value) {
    skipPersist = !!value;
}

async function getDb() {
    if (db) return db;
    if (!initPromise) {
        initPromise = (async () => {
            const initSqlJs = requireFromBackend('sql.js');
            const wasmDir = path.join(__dirname, '../backend/node_modules/sql.js/dist');
            const SQL = await initSqlJs({
                locateFile: (file) => path.join(wasmDir, file)
            });

            if (fs.existsSync(dbPath)) {
                db = new SQL.Database(fs.readFileSync(dbPath));
            } else {
                db = new SQL.Database();
            }

            db.run('PRAGMA foreign_keys = ON');
            return db;
        })();
    }
    db = await initPromise;
    return db;
}

function persistDb() {
    if (!db || skipPersist) return;
    fs.writeFileSync(dbPath, Buffer.from(db.export()));
}

function flushDb() {
    skipPersist = false;
    persistDb();
}

function normalizeSql(sqlText) {
    let text = sqlText;

    text = text.replace(/\bSELECT\s+TOP\s+\(([^)]+)\)/gi, 'SELECT');
    text = text.replace(/\bSELECT\s+TOP\s+(\d+)/gi, 'SELECT');
    text = text.replace(/\bGETDATE\(\)/gi, "datetime('now')");
    text = text.replace(/\bSYSUTCDATETIME\(\)/gi, "datetime('now')");
    text = text.replace(/\bDATEADD\(MINUTE,\s*(\d+),\s*(?:SYSUTCDATETIME\(\)|GETDATE\(\))\)/gi, "datetime('now', '+$1 minutes')");
    text = text.replace(/\bLTRIM\s*\(\s*RTRIM\s*\(([^)]+)\)\s*\)/gi, 'TRIM($1)');
    text = text.replace(/\bLTRIM\s*\(\s*RTRIM\s*\(([^)]+)\)\)/gi, 'TRIM($1)');
    text = text.replace(/\bISNULL\(/gi, 'IFNULL(');
    text = text.replace(/\bLEN\s*\(/gi, 'LENGTH(');
    text = text.replace(/\bOFFSET\s+(\?)\s+ROWS\s+FETCH\s+NEXT\s+(\?)\s+ROWS\s+ONLY/gi, 'LIMIT $2 OFFSET $1');
    text = text.replace(/\bdbo\./gi, '');
    text = text.replace(/\[([^\]]+)\]/g, '$1');
    text = text.replace(/\bNVarChar\b/gi, 'TEXT');
    text = text.replace(/\bBit\b/gi, 'INTEGER');
    text = text.replace(/\bTinyInt\b/gi, 'INTEGER');
    text = text.replace(/\bDecimal\b/gi, 'REAL');
    text = text.replace(/\bOUTPUT INSERTED\.\*/gi, '');
    text = text.replace(/\bOUTPUT INSERTED\.([a-zA-Z0-9_]+)/gi, '');
    text = text.replace(/\s+WITH\s*\([^)]*\)/gi, '');

    if (/^\s*SELECT\b/i.test(text) && !/\bLIMIT\b/i.test(text)) {
        const topMatch = sqlText.match(/\bTOP\s+\(([^)]+)\)/i) || sqlText.match(/\bTOP\s+(\d+)/i);
        if (topMatch) {
            text = `${text.trim()} LIMIT ${topMatch[1]}`;
        }
    }

    return text.trim();
}

function rowsFromExec(result) {
    if (!result?.length) return [];
    const { columns, values } = result[0];
    return values.map((row) => Object.fromEntries(columns.map((col, idx) => [col, row[idx]])));
}

async function runQuery(sqlText, params = []) {
    const database = await getDb();
    const text = normalizeSql(sqlText);
    const op = text.split(/\s+/)[0].toUpperCase();

    if (op === 'SELECT' || op === 'WITH' || op === 'PRAGMA') {
        const stmt = database.prepare(text);
        try {
            if (params.length) stmt.bind(params);
            const rows = [];
            while (stmt.step()) rows.push(stmt.getAsObject());
            return rows;
        } finally {
            stmt.free();
        }
    }

    if (params.length) {
        database.run(text, params);
    } else {
        database.run(text);
    }

    persistDb();

    if (/INSERT/i.test(text)) {
        const idRows = rowsFromExec(database.exec('SELECT last_insert_rowid() AS id'));
        return idRows.length ? idRows : [{ id: database.exec('SELECT last_insert_rowid()')[0]?.values?.[0]?.[0] }];
    }

    return [];
}

const withTransaction = async (callback) => {
    const database = await getDb();
    database.run('BEGIN TRANSACTION');
    try {
        const result = await callback({
            query: (sqlText, params = []) => runQuery(sqlText, params)
        });
        database.run('COMMIT');
        persistDb();
        return result;
    } catch (error) {
        try {
            database.run('ROLLBACK');
        } catch (rollbackError) {
            console.error('Rollback failed:', rollbackError.message);
        }
        throw error;
    }
};

class Request {
    constructor() {
        this.params = [];
    }

    input(name, _type, value) {
        let normalized = value;
        if (typeof normalized === 'boolean') normalized = normalized ? 1 : 0;
        this.params.push({ name, value: normalized });
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
        const updateTable = /^\s*UPDATE/i.test(text)
            ? (text.match(/UPDATE\s+([A-Za-z0-9_]+)/i)?.[1] || table)
            : table;

        if (/^\s*INSERT/i.test(text)) {
            await runQuery(text, values);
            const inserted = await runQuery(`SELECT * FROM ${table} ORDER BY id DESC LIMIT 1`);
            return { recordset: inserted, rowsAffected: [1] };
        }

        if (/^\s*UPDATE/i.test(text) && hasOutput) {
            await runQuery(text, values);
            const idParam = paramLookup.get('id');
            const updated = idParam != null
                ? await runQuery(`SELECT * FROM ${updateTable} WHERE id = ?`, [idParam])
                : [];
            return { recordset: updated, rowsAffected: [1] };
        }

        const rows = await runQuery(text, values);
        if (hasOutput && rows.length) {
            return { recordset: rows, rowsAffected: [1] };
        }

        return { recordset: Array.isArray(rows) ? rows : [rows], rowsAffected: [rows.length || 0] };
    }
}

function extractInsertTable(sqlText) {
    const match = sqlText.match(/INSERT\s+INTO\s+([A-Za-z0-9_]+)/i);
    return match ? match[1] : 'Users';
}

const getPool = async () => {
    await getDb();
    return {
        request: () => new Request(),
        close: async () => {}
    };
};

const closePool = async () => {};

const buildConnectionString = () => `sqlite://${dbPath}`;

const loadDriver = () => getDb;

const resetDatabase = async () => {
    if (db) {
        try { db.close(); } catch (_) { /* ignore */ }
        db = null;
        initPromise = null;
    }
    if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
    }
};

module.exports = {
    sql: {},
    getPool,
    getMasterPool: getPool,
    closePool,
    buildConnectionString,
    dbName,
    runQuery,
    withTransaction,
    loadDriver,
    resetDatabase,
    setSkipPersist,
    flushDb,
    persistDb
};
