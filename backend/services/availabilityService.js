/**
 * Availability provider abstraction (Category B development / Category C future).
 */
const bookingSeatAllocationRepository = require('../repositories/bookingSeatAllocationRepository');

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

        return {
            status: available > 0 ? 'Available' : 'Waitlist',
            availableCount: available,
            racCount: 0,
            waitlistCount: available > 0 ? 0 : 10,
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
