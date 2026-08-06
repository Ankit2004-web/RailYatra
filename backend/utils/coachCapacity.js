/**
 * Indian Railways passenger coach capacity per IR classification.
 * Supports ICF (older) and LHB (Linke Hofmann Busch) coach builds.
 * Values = berths/seats per single coach.
 *
 * Reference: IR coach classification (1A, 2A, 3A, 3E, EA, EC, CC, SL, 2S, UR/GS).
 */
const COACH_CAPACITY_ICF = Object.freeze({
    '1A': 24,
    '2A': 46,
    '3A': 64,
    '3E': 78,
    EA: 50,
    EC: 56,
    CC: 73,
    SL: 72,
    '2S': 73,
    GS: 90,
    UR: 90,
    FC: 24
});

const COACH_CAPACITY_LHB = Object.freeze({
    '1A': 24,
    '2A': 54,
    '3A': 72,
    '3E': 78,
    EA: 50,
    EC: 56,
    CC: 73,
    SL: 78,
    '2S': 73,
    GS: 99,
    UR: 99,
    FC: 24
});

/** @deprecated Use getBerthsPerCoach(code, build) — kept for backward compatibility (LHB defaults). */
const COACH_CAPACITY = COACH_CAPACITY_LHB;

/** Typical coach count per class by train category (when rake composition is unknown). */
const DEFAULT_COACH_COUNT = Object.freeze({
    rajdhani: { '1A': 1, '2A': 2, '3A': 4 },
    duronto: { '1A': 1, '2A': 2, '3A': 3 },
    vandeBharat: { CC: 8, EC: 2 },
    shatabdi: { CC: 5, EC: 1, '2S': 2 },
    garibRath: { '3E': 12 },
    anubhuthi: { EA: 1, CC: 4 },
    superfast: { SL: 6, '3A': 2, '2A': 1, '2S': 2 },
    express: { SL: 8, '3A': 2, '2A': 1, '2S': 2 },
    passenger: { '2S': 4, SL: 4, GS: 2 },
    default: { SL: 1, '3A': 1, '2A': 1, '2S': 1, CC: 1, EC: 1, '1A': 1, '3E': 1, EA: 1, GS: 1 }
});

const LHB_TRAIN_PATTERN = /rajdhani|shatabdi|duronto|vande bharat|garib rath|tejas|humsafar|double decker|anubhuthi|amrit bharat/i;
const LHB_TYPE_CODES = new Set(['RAJ', 'SHAT', 'DUR', 'VB']);

function inferCoachBuild(trainName = '', trainTypeCode = '') {
    const name = String(trainName);
    const type = String(trainTypeCode).toUpperCase();
    if (LHB_TRAIN_PATTERN.test(name) || LHB_TYPE_CODES.has(type)) return 'LHB';
    return 'ICF';
}

function inferTrainCategory(trainName = '', trainTypeCode = '') {
    const name = String(trainName);
    const type = String(trainTypeCode).toUpperCase();
    if (/garib rath/i.test(name)) return 'garibRath';
    if (/anubhuthi/i.test(name)) return 'anubhuthi';
    if (/vande bharat/i.test(name) || type === 'VB') return 'vandeBharat';
    if (/shatabdi/i.test(name) || type === 'SHAT') return 'shatabdi';
    if (/rajdhani/i.test(name) || type === 'RAJ') return 'rajdhani';
    if (/duronto/i.test(name) || type === 'DUR') return 'duronto';
    if (/passenger|pass\b/i.test(name) || type === 'PASS') return 'passenger';
    if (/superfast|\bSF\b|mail|express|\bEXP\b/i.test(name) || type === 'SF') return 'superfast';
    return 'express';
}

function getBerthsPerCoach(classCode, coachBuild = 'LHB') {
    try {
        const rulesService = require('../services/coachCapacityRulesService');
        if (rulesService.isCacheLoaded()) {
            return rulesService.getBerthsPerCoachFromRules(classCode, coachBuild);
        }
    } catch {
        /* use static tables */
    }

    if (!classCode) return COACH_CAPACITY_LHB.SL;
    const code = String(classCode).toUpperCase();
    const table = coachBuild === 'ICF' ? COACH_CAPACITY_ICF : COACH_CAPACITY_LHB;
    return table[code] ?? COACH_CAPACITY_LHB[code] ?? 72;
}

function getCoachCount(classCode, trainName, trainTypeCode) {
    const category = inferTrainCategory(trainName, trainTypeCode);
    const map = DEFAULT_COACH_COUNT[category] || DEFAULT_COACH_COUNT.default;
    const code = String(classCode).toUpperCase();
    return map[code] ?? DEFAULT_COACH_COUNT.default[code] ?? 1;
}

/** Total berths/seats for a class on a train (coaches × per-coach capacity). */
function getClassCapacity(classCode, trainName, trainTypeCode) {
    const build = inferCoachBuild(trainName, trainTypeCode);
    const coaches = getCoachCount(classCode, trainName, trainTypeCode);
    return coaches * getBerthsPerCoach(classCode, build);
}

function estimateTrainTotalCapacity(classCodes, trainName, trainTypeCode) {
    return classCodes.reduce(
        (sum, code) => sum + getClassCapacity(code, trainName, trainTypeCode),
        0
    );
}

module.exports = {
    COACH_CAPACITY,
    COACH_CAPACITY_ICF,
    COACH_CAPACITY_LHB,
    DEFAULT_COACH_COUNT,
    inferCoachBuild,
    getBerthsPerCoach,
    getCoachCount,
    getClassCapacity,
    estimateTrainTotalCapacity,
    inferTrainCategory
};
