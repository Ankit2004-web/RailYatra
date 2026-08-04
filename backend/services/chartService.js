const { getPool } = require('../../database/connection');
const notificationRepository = require('../repositories/notificationRepository');

const CHART_HOURS_BEFORE = 4;

async function prepareChartsForUpcomingJourneys() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT b.id, b.userId, b.pnrNumber, b.journeyDate
        FROM Bookings b
        WHERE b.status IN ('Confirmed', 'RAC', 'Waitlisted')
          AND b.chartPrepared = 0
          AND b.journeyDate <= CAST(DATEADD(HOUR, ${CHART_HOURS_BEFORE}, SYSUTCDATETIME()) AS DATE)
    `);

    let prepared = 0;
    for (const row of result.recordset) {
        await pool.request()
            .input('id', 'Int', row.id)
            .query('UPDATE Bookings SET chartPrepared = 1, updatedAt = SYSUTCDATETIME() WHERE id = @id');

        if (row.userId) {
            await notificationRepository.create({
                userId: row.userId,
                type: 'chart_prepared',
                title: 'Chart prepared',
                message: `Final chart is prepared for PNR ${row.pnrNumber}.`,
                meta: { bookingId: row.id, pnr: row.pnrNumber }
            }).catch(() => {});
        }
        prepared += 1;
    }
    return prepared;
}

module.exports = { prepareChartsForUpcomingJourneys, CHART_HOURS_BEFORE };
