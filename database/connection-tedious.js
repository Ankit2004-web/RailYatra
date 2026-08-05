const { requireFromBackend } = require('./bootstrap');

const sql = requireFromBackend('mssql');

const dbServer = process.env.DB_SERVER;
const dbName = process.env.DB_NAME || 'RailwayReservation';

if (!dbServer) {
    throw new Error('DB_SERVER is required for cloud deployment (e.g. your-server.database.windows.net)');
}

const buildConfig = (database = dbName) => ({
    server: dbServer,
    database,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
        encrypt: process.env.DB_ENCRYPT !== 'false',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== 'false'
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
});

const pools = new Map();

const getSqlPool = async (database = dbName) => {
    if (!pools.has(database)) {
        pools.set(database, sql.connect(buildConfig(database)));
    }
    return pools.get(database);
};

const buildConnectionString = (database = dbName) => {
    const cfg = buildConfig(database);
    return `Server=${cfg.server};Database=${cfg.database};User Id=${cfg.user};Password=***;Encrypt=${cfg.options.encrypt}`;
};

const runQuery = async (sqlText, params = [], database = dbName) => {
    const pool = await getSqlPool(database);
    const request = pool.request();
    params.forEach((value, index) => {
        request.input(`p${index}`, value);
    });

    let text = sqlText;
    params.forEach((_value, index) => {
        text = text.replace('?', `@p${index}`);
    });

    const result = await request.query(text);
    return result.recordset || [];
};

const withTransaction = async (callback) => {
    const pool = await getSqlPool(dbName);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    const query = (sqlText, params = []) => new Promise((resolve, reject) => {
        const request = new sql.Request(transaction);
        params.forEach((value, index) => {
            request.input(`p${index}`, value);
        });

        let text = sqlText;
        params.forEach((_value, index) => {
            text = text.replace('?', `@p${index}`);
        });

        request.query(text)
            .then((result) => resolve(result.recordset || []))
            .catch(reject);
    });

    try {
        const result = await callback({ query });
        await transaction.commit();
        return result;
    } catch (error) {
        try {
            await transaction.rollback();
        } catch (rollbackError) {
            console.error('Rollback failed:', rollbackError.message);
        }
        throw error;
    }
};

class Request {
    constructor(pool) {
        this.pool = pool;
        this.request = pool.request();
    }

    input(name, _type, value) {
        this.request.input(name, value);
        return this;
    }

    async query(sqlText) {
        const result = await this.request.query(sqlText);
        return {
            recordset: result.recordset || [],
            rowsAffected: result.rowsAffected || [0]
        };
    }
}

const getPool = async () => {
    const pool = await getSqlPool(dbName);
    return {
        request: () => new Request(pool),
        close: async () => {}
    };
};

const closePool = async () => {
    const closing = [...pools.values()].map((poolPromise) => poolPromise.then((pool) => pool.close()));
    pools.clear();
    await Promise.allSettled(closing);
};

const loadDriver = () => sql;

module.exports = {
    sql,
    getPool,
    getMasterPool: async () => getPool(),
    closePool,
    buildConnectionString,
    dbName,
    runQuery,
    withTransaction,
    loadDriver
};
