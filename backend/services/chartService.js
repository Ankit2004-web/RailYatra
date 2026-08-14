const { getPool } = require('../../database/connection');
const notificationRepository = require('../repositories/notificationRepository');
const { isChartClosed, CHART_HOURS_BEFORE } = require('../utils/irctcRules');
const { addDaysIso, getIstParts } = require('../utils/istTime');

async function prepareChartsForUpcomingJourneys(now = new Date()) {
    const ist = getIstParts(now);
    const untilDate = addDaysIso(ist.dateStr, 1);
    const pool = await getPool();
    const result = await pool.request()
        .input('untilDate', 'NVarChar', untilDate)
        .query(`
            SELECT b.id, b.userId, b.pnrNumber, b.journeyDate, t.departureTime
            FROM Bookings b
            INNER JOIN Trains t ON t.id = b.trainId
            WHERE b.status IN ('Confirmed', 'RAC', 'Waitlisted')
              AND ISNULL(b.chartPrepared, 0) = 0
              AND b.journeyDate <= @untilDate
        `);

    let prepared = 0;
    for (const row of result.recordset) {
        const chart = isChartClosed({
            journeyDate: String(row.journeyDate).slice(0, 10),
            departureTime: row.departureTime,
            now
        });
        if (!chart.closed) continue;

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
