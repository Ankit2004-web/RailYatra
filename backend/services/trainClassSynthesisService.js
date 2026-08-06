/**
 * Adds missing travel classes (e.g. 2S on day trains) when source data omitted them.
 */
const { getPool } = require('../../database/connection');
const trainClassRepository = require('../repositories/trainClassRepository');
const { inferTrainCategory } = require('../utils/coachCapacity');
const { buildRakeFromTrainClasses, getClassTotalFromRake } = require('./rakeCompositionService');
const { applyFaresToClasses } = require('../utils/irctcFareTable2025');

const CLASS_NAMES = Object.freeze({
    '1A': 'AC First Class',
    '2A': 'AC 2 Tier',
    '3A': 'AC 3 Tier',
    '3E': 'AC 3 Economy',
    CC: 'Chair Car',
    EC: 'Executive Chair Car',
    EA: 'Anubhuthi Executive',
    SL: 'Sleeper',
    '2S': 'Second Sitting'
});

const CLASS_ORDER = ['EC', 'EA', 'CC', '2S', '3A', '3E', '2A', '1A', 'SL', 'GS', 'UR'];

const EXCLUDE_2S_CATEGORIES = new Set(['rajdhani', 'duronto', 'vandeBharat', 'garibRath']);

function shouldAdd2S(trainName, trainTypeCode, classCodes) {
    if (classCodes.includes('2S')) return false;
    const category = inferTrainCategory(trainName, trainTypeCode);
    if (EXCLUDE_2S_CATEGORIES.has(category)) return false;
    if (classCodes.includes('SL')) return true;
    if (classCodes.some((code) => ['CC', 'EC', 'EA'].includes(code))) return true;
    if (['passenger', 'superfast', 'express', 'shatabdi'].includes(category)) return true;
    return false;
}

function sortClasses(classes) {
    return [...classes].sort((a, b) => {
        const ai = CLASS_ORDER.indexOf(a.classCode);
        const bi = CLASS_ORDER.indexOf(b.classCode);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
}

function synthesizeMissingClasses(classes, { trainName, trainTypeCode, distanceKm, journeyDate }) {
    if (!classes?.length) return classes || [];

    const codes = classes.map((c) => c.classCode);
    const missingCodes = [];
    if (shouldAdd2S(trainName, trainTypeCode, codes)) {
        missingCodes.push('2S');
    }

    const toAdd = missingCodes.filter((code) => !codes.includes(code));
    if (!toAdd.length) return sortClasses(classes);

    const stubs = toAdd.map((classCode) => {
        const expanded = [
            ...classes,
            { classCode, className: CLASS_NAMES[classCode] || classCode }
        ];
        const rake = buildRakeFromTrainClasses({ trainName, trainTypeCode }, expanded);
        const capacity = getClassTotalFromRake(rake.coaches, classCode)
            || (classCode === '2S' ? 216 : 72);

        return {
            classCode,
            className: CLASS_NAMES[classCode] || classCode,
            price: null,
            totalSeats: capacity,
            availableSeats: capacity,
            isAvailable: 1,
            synthesized: true
        };
    });

    const priced = applyFaresToClasses(stubs, {
        distanceKm: distanceKm || 0,
        trainTypeCode,
        trainName,
        journeyDate
    });

    return sortClasses([...classes, ...priced]);
}

async function persistMissingClassForBooking(trainId, classCode, train) {
    const existing = await trainClassRepository.findByTrainAndCode(trainId, classCode);
    if (existing) return existing;

    const synthesized = (train.classes || []).find((c) => c.classCode === classCode);
    if (!synthesized) return null;

    const pool = await getPool();
    await pool.request()
        .input('trainId', 'Int', trainId)
        .input('classCode', 'NVarChar', classCode)
        .input('className', 'NVarChar', synthesized.className || CLASS_NAMES[classCode] || classCode)
        .input('price', 'Decimal', synthesized.price)
        .input('totalSeats', 'Int', synthesized.totalSeats || synthesized.availableSeats || 72)
        .input('availableSeats', 'Int', synthesized.availableSeats || synthesized.totalSeats || 72)
        .query(`INSERT INTO TrainClasses (trainId, classCode, className, price, totalSeats, availableSeats, isAvailable)
                VALUES (@trainId, @classCode, @className, @price, @totalSeats, @availableSeats, 1)`);

    return trainClassRepository.findByTrainAndCode(trainId, classCode);
}

module.exports = {
    shouldAdd2S,
    synthesizeMissingClasses,
    sortClasses,
    persistMissingClassForBooking
};
