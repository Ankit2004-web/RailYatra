/**
 * Availability provider abstraction (Category B development / Category C future).
 */
const { getPool } = require('../../database/connection');
const bookingSeatAllocationRepository = require('../repositories/bookingSeatAllocationRepository');

const getBookingCounts = async ({ trainId, journeyDate, classCode }) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('trainId', 'Int', trainId)
        .input('journeyDate', 'Date', journeyDate)
        .input('classCode', 'NVarChar', classCode)
        .query(`
            SELECT status, COUNT(*) AS count
            FROM Bookings
            WHERE trainId = @trainId AND journeyDate = @journeyDate AND classCode = @classCode
              AND status IN ('Waitlisted', 'RAC')
            GROUP BY status
        `);

    const counts = { Waitlisted: 0, RAC: 0 };
    for (const row of result.recordset) {
        counts[row.status] = row.count;
    }
    return counts;
};

class DevelopmentAvailabilityProvider {
    async checkAvailability({ trainId, journeyDate, classCode, fromStopSequence, toStopSequence, quota }) {
        const seatRepository = require('../repositories/seatRepository');
        const trainClassRepository = require('../repositories/trainClassRepository');
        const seatMap = await seatRepository.getSeatMap(trainId, classCode, journeyDate);
        const seatList = Array.isArray(seatMap) ? seatMap : (seatMap.seats || []);
        const classRow = await trainClassRepository.findByTrainAndCode(trainId, classCode);
        const totalSeats = classRow?.totalSeats || seatList.length;
        let available = seatList.filter((s) => s.status === 'Available').length;
        let segmentAware = false;

        if (fromStopSequence && toStopSequence) {
            segmentAware = true;
            const overlapCount = await bookingSeatAllocationRepository.countOverlappingAllocations({
                trainId,
                journeyDate,
                classCode,
                fromStopSequence,
                toStopSequence
            });
            available = Math.max(0, totalSeats - overlapCount);
        }

        const bookingCounts = await getBookingCounts({ trainId, journeyDate, classCode });

        return {
            status: available > 0 ? 'Available' : 'Waitlist',
            availableCount: available,
            racCount: bookingCounts.RAC,
            waitlistCount: available > 0 ? bookingCounts.Waitlisted : Math.max(bookingCounts.Waitlisted, 10),
            provider: 'development_simulation',
            segmentAware,
            quota: quota || 'General'
        };
    }
}

class FutureExternalAvailabilityProvider {
    async checkAvailability() {
        throw new Error('External availability provider not configured. Use development mode.');
    }
}

function getAvailabilityProvider() {
    if (process.env.AVAILABILITY_PROVIDER === 'external') {
        return new FutureExternalAvailabilityProvider();
    }
    return new DevelopmentAvailabilityProvider();
}

async function checkAvailability(params) {
    return getAvailabilityProvider().checkAvailability(params);
}

module.exports = {
    DevelopmentAvailabilityProvider,
    FutureExternalAvailabilityProvider,
    getAvailabilityProvider,
    checkAvailability
};
