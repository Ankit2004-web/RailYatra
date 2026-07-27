/**
 * Loads official IR CoachCapacityRules from DB (same source as IRCTC coach layouts).
 * Used for per-coach seating/berth counts in rake synthesis and capacity backfill.
 */
const coachCompositionRepository = require('../repositories/coachCompositionRepository');
const {
    getBerthsPerCoach: fallbackBerthsPerCoach,
    inferCoachBuild
} = require('../utils/coachCapacity');

/** Travel class → IR coach type code (matches CoachTypes.code in DB) */
const CLASS_TO_COACH_TYPE = Object.freeze({
    '1A': 'HA',
    '2A': 'A',
    '3A': 'B',
    '3E': 'G',
    SL: 'S',
    '2S': 'D',
    CC: 'C',
    EC: 'E',
    EA: 'EA',
    GS: 'GS',
    UR: 'UR'
});

let rulesByKey = null;
let rulesByClass = null;

function ruleKey(coachTypeCode, coachModelCode) {
    return `${coachTypeCode}|${coachModelCode}`;
}

function normalizeRule(row) {
    const seating = row.seatingCapacity ?? null;
    const sleeping = row.sleepingBerths ?? null;
    const capacity = seating || sleeping || row.totalBerths || 0;

    return {
        coachTypeCode: row.coachTypeCode,
        coachModelCode: row.coachModelCode,
        travelClassCode: row.travelClassCode || null,
        seatingCapacity: seating,
        sleepingBerths: sleeping,
        capacity,
        isChair: seating != null && sleeping == null,
        isSleeper: sleeping != null,
        sourceReference: row.sourceReference || 'IR CoachCapacityRules',
        coupeCount: row.coupeCount,
        cabinCount: row.cabinCount
    };
}

async function loadRulesCache() {
    if (rulesByKey) return { rulesByKey, rulesByClass };

    const rows = await coachCompositionRepository.getAllCapacityRules();
    rulesByKey = new Map();
    rulesByClass = new Map();

    for (const row of rows) {
        const normalized = normalizeRule(row);
        const key = ruleKey(row.coachTypeCode, row.coachModelCode);
        if (!rulesByKey.has(key)) {
            rulesByKey.set(key, normalized);
        }

        if (row.travelClassCode) {
            const classKey = `${row.travelClassCode}|${row.coachModelCode}`;
            if (!rulesByClass.has(classKey)) {
                rulesByClass.set(classKey, normalized);
            }
        }
    }

    return { rulesByKey, rulesByClass };
}

function ensureFallbackMaps() {
    if (!rulesByKey) {
        rulesByKey = new Map();
        rulesByClass = new Map();
    }
}

/** Sync lookup — uses cache; falls back to hardcoded IR tables if rule missing */
function getPerCoachCapacity(classCode, coachModelCode) {
    ensureFallbackMaps();
    const code = String(classCode || '').toUpperCase();
    const model = String(coachModelCode || 'LHB').toUpperCase();
    const coachType = CLASS_TO_COACH_TYPE[code];

    let rule = null;
    if (coachType) {
        rule = rulesByKey.get(ruleKey(coachType, model))
            || rulesByClass.get(`${code}|${model}`);
    }

    if (rule) {
        return {
            ...rule,
            capacity: rule.capacity,
            capacitySource: rule.sourceReference
        };
    }

    const capacity = fallbackBerthsPerCoach(code, model === 'ICF' ? 'ICF' : 'LHB');
    const meta = CLASS_TO_COACH_TYPE[code];
    const isChair = ['D', 'C', 'E', 'EA', 'GS', 'UR'].includes(meta);

    return {
        coachTypeCode: coachType || null,
        coachModelCode: model,
        travelClassCode: code,
        seatingCapacity: isChair ? capacity : null,
        sleepingBerths: isChair ? null : capacity,
        capacity,
        isChair,
        isSleeper: !isChair,
        capacitySource: `IR ${model} ${code} classification (fallback table)`,
        sourceReference: null
    };
}

function getBerthsPerCoachFromRules(classCode, coachBuild) {
    return getPerCoachCapacity(classCode, coachBuild).capacity;
}

function isCacheLoaded() {
    return rulesByKey != null && rulesByKey.size > 0;
}

module.exports = {
    CLASS_TO_COACH_TYPE,
    loadRulesCache,
    getPerCoachCapacity,
    getBerthsPerCoachFromRules,
    isCacheLoaded,
    inferCoachBuild
};
