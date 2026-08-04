const { getPool } = require('../../database/connection');

const findAll = async () => {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM Stations ORDER BY name ASC');
    return result.recordset;
};

const search = async (query, limit = 10) => {
    const pool = await getPool();
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 20);
    const term = String(query || '').trim();
    if (!term) return [];

    const upper = term.toUpperCase();
    const like = `%${term}%`;
    const prefix = `${term}%`;

    const result = await pool.request()
        .input('exactCode', 'NVarChar', upper)
        .input('prefix', 'NVarChar', prefix)
        .input('like', 'NVarChar', like)
        .query(`
            SELECT TOP (${safeLimit}) s.*,
                CASE
                    WHEN UPPER(s.code) = @exactCode THEN 0
                    WHEN UPPER(s.code) LIKE @prefix THEN 1
                    WHEN s.name LIKE @prefix THEN 2
                    WHEN s.city LIKE @prefix THEN 3
                    ELSE 4
                END AS rankOrder
            FROM Stations s
            WHERE s.isActive = 1
              AND (UPPER(s.code) = @exactCode OR s.code LIKE @prefix
                   OR s.name LIKE @like OR s.city LIKE @like OR s.normalizedName LIKE @like)
            ORDER BY rankOrder, s.name ASC
        `);
    return result.recordset.map(({ rankOrder, ...station }) => station);
};

const findById = async (id) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('id', 'Int', id)
        .query('SELECT * FROM Stations WHERE id = @id');
    return result.recordset[0] || null;
};

const findByCode = async (code) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('code', 'NVarChar', code)
        .query('SELECT * FROM Stations WHERE code = @code');
    return result.recordset[0] || null;
};

const create = async ({ code, name, city, state }) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('code', 'NVarChar', code.toUpperCase())
        .input('name', 'NVarChar', name)
        .input('city', 'NVarChar', city)
        .input('state', 'NVarChar', state)
        .query(`INSERT INTO Stations (code, name, city, state)
                OUTPUT INSERTED.*
                VALUES (@code, @name, @city, @state)`);
    return result.recordset[0];
};

const update = async (id, { code, name, city, state }) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('id', 'Int', id)
        .input('code', 'NVarChar', code.toUpperCase())
        .input('name', 'NVarChar', name)
        .input('city', 'NVarChar', city)
        .input('state', 'NVarChar', state)
        .query(`UPDATE Stations SET code = @code, name = @name, city = @city, state = @state, updatedAt = SYSUTCDATETIME()
                OUTPUT INSERTED.*
                WHERE id = @id`);
    return result.recordset[0] || null;
};

const remove = async (id) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('id', 'Int', id)
        .query('DELETE FROM Stations WHERE id = @id');
    return result.rowsAffected[0] > 0;
};

const createMany = async (stations) => {
    const summary = { created: 0, skipped: 0, errors: [] };

    for (const station of stations) {
        const code = (station.code || '').trim().toUpperCase();
        if (!code || !station.name || !station.city || !station.state) {
            summary.errors.push({ code: code || station.code, msg: 'Missing required fields' });
            continue;
        }

        const existing = await findByCode(code);
        if (existing) {
            summary.skipped += 1;
            continue;
        }

        try {
            await create({ code, name: station.name.trim(), city: station.city.trim(), state: station.state.trim() });
            summary.created += 1;
        } catch (err) {
            summary.errors.push({ code, msg: err.message });
        }
    }

    return summary;
};

const findPaginated = async ({ page = 1, pageSize = 50, search = '' }) => {
    const pool = await getPool();
    const offset = (page - 1) * pageSize;
    const trimmed = search.trim();
    const hasSearch = trimmed.length > 0;

    const countReq = pool.request();
    const dataReq = pool.request()
        .input('offset', 'Int', offset)
        .input('pageSize', 'Int', pageSize);

    let where = 'WHERE isActive = 1';
    if (hasSearch) {
        where += ' AND (code LIKE @search OR name LIKE @search OR city LIKE @search OR state LIKE @search)';
        countReq.input('search', 'NVarChar', `%${trimmed}%`);
        dataReq.input('search', 'NVarChar', `%${trimmed}%`);
    }

    const [countResult, dataResult] = await Promise.all([
        countReq.query(`SELECT COUNT(*) AS total FROM Stations ${where}`),
        dataReq.query(`
            SELECT * FROM Stations ${where}
            ORDER BY name ASC
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
        `)
    ]);

    const totalItems = countResult.recordset[0].total;
    return {
        items: dataResult.recordset,
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize) || 1
    };
};

const parseAmenities = (raw) => {
    if (!raw) return { parking: false, food: false, waitingRoom: false, lounge: false, wifi: false };
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return {
            parking: !!parsed.parking,
            food: !!parsed.food,
            waitingRoom: !!parsed.waitingRoom,
            lounge: !!parsed.lounge,
            wifi: !!parsed.wifi
        };
    } catch {
        return { parking: false, food: false, waitingRoom: false, lounge: false, wifi: false };
    }
};

const findDetailByCode = async (code) => {
    const station = await findByCode(code);
    if (!station) return null;
    const amenities = parseAmenities(station.amenities);
    return {
        ...station,
        amenities,
        platforms: station.platformCount ? Array.from({ length: station.platformCount }, (_, i) => ({
            number: i + 1,
            label: `Platform ${i + 1}`
        })) : [{ number: 1, label: 'Platform 1' }]
    };
};

const findNearby = async (code, limit = 8) => {
    const station = await findByCode(code);
    if (!station) return [];
    const pool = await getPool();
    const safeLimit = Math.min(limit, 20);
    const result = await pool.request()
        .input('code', 'NVarChar', code.toUpperCase())
        .input('state', 'NVarChar', station.state)
        .input('city', 'NVarChar', station.city)
        .query(`SELECT TOP (${safeLimit}) * FROM Stations
                WHERE isActive = 1 AND code <> @code
                  AND (state = @state OR city = @city)
                ORDER BY name ASC`);
    return result.recordset;
};

module.exports = { findAll, search, findById, findByCode, create, update, remove, createMany, findPaginated, findDetailByCode, findNearby };
