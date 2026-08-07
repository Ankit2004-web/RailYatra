const liveTrainService = require('./liveTrainService');

const MAX_BATCH = 10;

function parseTrainNumbers(raw) {
    if (!raw) return [];
    return [...new Set(String(raw).split(/[\s,]+/).map((v) => v.replace(/\D/g, '')).filter((v) => /^\d{5}$/.test(v)))].slice(0, MAX_BATCH);
}

/**
 * Lightweight batch live-status lookup for search results (cached via liveTrainService).
 */
async function getScheduleUpdates(trainNumbers, journeyDate) {
    const numbers = parseTrainNumbers(Array.isArray(trainNumbers) ? trainNumbers.join(',') : trainNumbers);
    if (!numbers.length) return { updatedAt: new Date().toISOString(), trains: [] };

    const settled = await Promise.allSettled(
        numbers.map(async (trainNumber) => {
            const status = await liveTrainService.getLiveStatusByTrainNumber(trainNumber, journeyDate);
            return {
                trainNumber,
                status: status.status,
                delayMinutes: status.delayMinutes || 0,
                cancelled: /cancel/i.test(status.status || '') || status.runningStatus === 'Cancelled',
                dataSource: status.dataSource,
                provider: status.provider,
                currentLocation: status.currentLocation,
                nextStation: status.nextStation,
                lastUpdated: status.lastUpdated
            };
        })
    );

    const trains = settled
        .filter((item) => item.status === 'fulfilled')
        .map((item) => item.value);

    return {
        updatedAt: new Date().toISOString(),
        journeyDate: journeyDate || null,
        trains
    };
}

module.exports = { getScheduleUpdates, parseTrainNumbers };
