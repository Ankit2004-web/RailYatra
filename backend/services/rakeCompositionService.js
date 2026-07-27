/**
 * Builds per-coach rake composition from train classes + IR capacity rules.
 * Used when official COA/composition CSV is not imported.
 * Each coach gets exact capacity from CoachCapacityRules model (ICF/LHB).
 */
const {
    inferCoachBuild,
    getCoachCount
} = require('../utils/coachCapacity');
const { getPerCoachCapacity, CLASS_TO_COACH_TYPE } = require('./coachCapacityRulesService');

/** Travel class → IR coach prefix & coach type code */
const CLASS_COACH_META = Object.freeze({
    '1A': { prefix: 'HA', coachType: 'HA', isSleeper: true, isChair: false },
    '2A': { prefix: 'A', coachType: 'A', isSleeper: true, isChair: false },
    '3A': { prefix: 'B', coachType: 'B', isSleeper: true, isChair: false },
    '3E': { prefix: 'G', coachType: 'G', isSleeper: true, isChair: false },
    SL: { prefix: 'S', coachType: 'S', isSleeper: true, isChair: false },
    '2S': { prefix: 'D', coachType: 'D', isSleeper: false, isChair: true },
    CC: { prefix: 'C', coachType: 'C', isSleeper: false, isChair: true },
    EC: { prefix: 'E', coachType: 'E', isSleeper: false, isChair: true },
    EA: { prefix: 'EA', coachType: 'EA', isSleeper: false, isChair: true },
    GS: { prefix: 'GS', coachType: 'GS', isSleeper: false, isChair: true },
    UR: { prefix: 'UR', coachType: 'UR', isSleeper: false, isChair: true }
});

/** Rake order (loco → tail) for synthesized composition */
const RAKE_CLASS_ORDER = ['GS', 'UR', '2S', 'SL', '3E', '3A', '2A', '1A', 'EA', 'EC', 'CC'];

function getCoachCountForClass(classCode, trainName, trainTypeCode) {
    return getCoachCount(classCode, trainName, trainTypeCode);
}

/**
 * @param {object} train - { trainName, trainTypeCode }
 * @param {Array<{ classCode: string, className?: string }>} trainClasses
 * @returns {{ coaches: Array, classTotals: Map, capacityStatus: string, source: string }}
 */
function buildRakeFromTrainClasses(train, trainClasses) {
    const trainName = train.trainName || '';
    const trainTypeCode = train.trainTypeCode || '';
    const build = inferCoachBuild(trainName, trainTypeCode);
    const classCodes = trainClasses.map((c) => String(c.classCode).toUpperCase());
    const ordered = RAKE_CLASS_ORDER.filter((c) => classCodes.includes(c));
    const remaining = classCodes.filter((c) => !ordered.includes(c));
    const sequence = [...ordered, ...remaining];

    const coaches = [];
    const classTotals = new Map();
    let position = 1;

    for (const classCode of sequence) {
        const meta = CLASS_COACH_META[classCode];
        if (!meta) continue;

        const coachCount = getCoachCountForClass(classCode, trainName, trainTypeCode);
        const capRule = getPerCoachCapacity(classCode, build);
        const perCoach = capRule.capacity;
        let classTotal = 0;

        for (let i = 1; i <= coachCount; i += 1) {
            const seatingCapacity = capRule.isChair ? perCoach : null;
            const sleepingBerths = capRule.isSleeper ? perCoach : null;
            const cap = perCoach;
            classTotal += cap;

            coaches.push({
                coachNumber: `${meta.prefix}${i}`,
                coachType: meta.coachType,
                coachTypeName: meta.coachType,
                classCode,
                coachModel: build,
                coachModelName: build,
                coachPosition: position,
                seatingCapacity,
                sleepingBerths,
                capacityKnown: true,
                capacitySource: capRule.capacitySource,
                capacityRuleCoachType: capRule.coachTypeCode || CLASS_TO_COACH_TYPE[classCode],
                ladiesCoach: false,
                divyangCoach: false,
                pantryCar: false,
                guardCoach: false,
                parcelCoach: false,
                powerCar: false,
                seats: buildSeatList(coachNumber(`${meta.prefix}${i}`), classCode, perCoach, meta)
            });
            position += 1;
        }

        classTotals.set(classCode, classTotal);
    }

    // Utility coaches for long-distance rakes (no passenger berths)
    if (coaches.length >= 5) {
        coaches.unshift({
            coachNumber: 'EOG1',
            coachType: 'EOG',
            coachTypeName: 'Power Car',
            classCode: null,
            coachModel: build,
            coachModelName: build,
            coachPosition: 0,
            seatingCapacity: null,
            sleepingBerths: null,
            capacityKnown: false,
            capacitySource: null,
            powerCar: true,
            ladiesCoach: false,
            divyangCoach: false,
            pantryCar: false,
            guardCoach: false,
            parcelCoach: false,
            seats: []
        });
        coaches.forEach((c, idx) => { c.coachPosition = idx + 1; });
    }

    return {
        coaches,
        classTotals,
        capacityStatus: coaches.length > 0 ? 'Partial' : 'Unknown',
        source: 'IR rake template from CoachCapacityRules (not official COA)',
        coachModel: build
    };
}

function coachNumber(n) {
    return n;
}

function buildSeatList(coachNum, classCode, count, meta) {
    const seats = [];
    for (let n = 1; n <= count; n += 1) {
        seats.push({
            coachNumber: coachNum,
            seatNumber: n,
            displayLabel: `${coachNum}-${n}`,
            berthType: meta.isSleeper ? berthTypeFor(classCode, n) : 'SEAT',
            status: 'Available'
        });
    }
    return seats;
}

function berthTypeFor(classCode, seatNumber) {
    if (['CC', 'EC', 'EA', '2S', 'GS', 'UR'].includes(classCode)) return 'SEAT';
    const cycle = (seatNumber - 1) % 8;
    if (cycle < 2) return 'LB';
    if (cycle < 4) return 'MB';
    if (cycle < 6) return 'UB';
    if (cycle === 6) return 'SL';
    return 'SU';
}

function getClassTotalFromRake(coaches, classCode) {
    return coaches
        .filter((c) => c.classCode === classCode && c.capacityKnown)
        .reduce((sum, c) => sum + (c.seatingCapacity || c.sleepingBerths || 0), 0);
}

function getAllSeatsForClass(coaches, classCode) {
    return coaches
        .filter((c) => c.classCode === classCode)
        .flatMap((c) => c.seats || []);
}

module.exports = {
    CLASS_COACH_META,
    buildRakeFromTrainClasses,
    getClassTotalFromRake,
    getAllSeatsForClass,
    getCoachCountForClass
};
