const { requireFromBackend } = require('./bootstrap');

let msnodesql = null;
let driverLoadError = null;

const loadDriver = () => {
    if (driverLoadError) throw driverLoadError;
    if (msnodesql) return msnodesql;

    try {
        msnodesql = requireFromBackend('msnodesqlv8');
        return msnodesql;
    } catch (error) {
        driverLoadError = error;
        console.error('\n*** SQL Server driver (msnodesqlv8) is missing or broken ***');
        console.error('Fix: stop the server, then run:');
        console.error('  cd backend');
        console.error('  npm install msnodesqlv8');
        console.error('If that fails, install Visual Studio "Desktop development with C++" and retry.');
        console.error('Recommended Node.js version: 20.x or 22.x LTS.\n');
        throw error;
    }
};

const dbServer = process.env.DB_SERVER || '(localdb)\\MSSQLLocalDB';
const dbName = process.env.DB_NAME || 'RailwayReservation';

const buildConnectionString = (database = dbName) => {
    const useTrustedConnection = process.env.DB_TRUSTED_CONNECTION !== 'false';

    if (useTrustedConnection) {
        return `Driver={ODBC Driver 17 for SQL Server};Server=${dbServer};Database=${database};Trusted_Connection=Yes;TrustServerCertificate=Yes;`;
    }

    return `Driver={ODBC Driver 17 for SQL Server};Server=${dbServer};Database=${database};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD};TrustServerCertificate=Yes;`;
};

const withConnection = (database, fn) => new Promise((resolve, reject) => {
    let driver;
    try {
        driver = loadDriver();
    } catch (error) {
        reject(error);
        return;
    }

    driver.open(buildConnectionString(database), (err, connection) => {
        if (err) return reject(err);

        Promise.resolve(fn(connection))
            .then(resolve)
            .catch(reject)
            .finally(() => {
                try {
                    connection.close();
                } catch (closeError) {
                    console.error('Connection close error:', closeError.message);
                }
            });
    });
});

const runQuery = (sqlText, params = [], database = dbName) => withConnection(database, (connection) => new Promise((resolve, reject) => {
    connection.query(sqlText, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
    });
}));

const withTransaction = async (callback) => withConnection(dbName, async (connection) => {
    const query = (sqlText, params = []) => new Promise((resolve, reject) => {
        connection.query(sqlText, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });

    try {
        await query('BEGIN TRANSACTION');
        const result = await callback({ query });
        await query('COMMIT TRANSACTION');
        return result;
    } catch (error) {
        try {
            await query('ROLLBACK TRANSACTION');
        } catch (rollbackError) {
            console.error('Rollback failed:', rollbackError.message);
        }
        throw error;
    }
});

class Request {
    constructor() {
        this.params = [];
    }

    input(name, type, value) {
        this.params.push({ name, value });
        return this;
    }

    async query(sqlText) {
        const values = [];
        const paramLookup = new Map(this.params.map((param) => [param.name, param.value]));

        const text = sqlText.replace(/@([A-Za-z_][A-Za-z0-9_]*)/g, (placeholder, name) => {
            if (!paramLookup.has(name)) {
                throw new Error(`Missing SQL parameter: @${name}`);
            }

            values.push(paramLookup.get(name));
            return '?';
        });

        const rows = await runQuery(text, values);
        return { recordset: rows, rowsAffected: [rows.length] };
    }
}

const getPool = async () => ({
    request: () => new Request(),
    close: async () => {}
});

module.exports = {
    sql: {},
    getPool,
    getMasterPool: getPool,
    closePool: async () => {},
    buildConnectionString,
    dbName,
    runQuery,
    withTransaction,
    loadDriver
};
