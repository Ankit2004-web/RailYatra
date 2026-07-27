/**
 * Passenger fare model aligned with MoR Commercial Circular No. 11 of 2025
 * (IRCA revised Passenger Fare Table w.e.f. 01.07.2025).
 *
 * Official reference:
 * https://indianrailways.gov.in/railwayboard/uploads/directorate/traffic_comm/Comm_Cir_2025/CC%2011%20of%202025.pdf
 */

const CC11_EFFECTIVE_DATE = '2025-07-01';

const OFFICIAL_FARE_REFERENCE = {
    circular: 'Commercial Circular No. 11 of 2025',
    issued: '2025-06-30',
    effectiveFrom: CC11_EFFECTIVE_DATE,
    url: 'https://indianrailways.gov.in/railwayboard/uploads/directorate/traffic_comm/Comm_Cir_2025/CC%2011%20of%202025.pdf'
};

/** IRCA-style base basic fare (Rs per passenger-km) for Mail/Express before CC 11/2025 revision. */
const IRCA_BASE_RATE_MAIL_EXPRESS_RS_PER_KM = {
    '2S': 0.28,
    SL: 0.39,
    '3A': 0.85,
    '3E': 0.80,
    '2A': 1.20,
    '1A': 2.00,
    CC: 0.70,
    EC: 1.30
};

/** IRCA-style base for Ordinary (non-suburban) services. */
const IRCA_BASE_RATE_ORDINARY_RS_PER_KM = {
    '2S': 0.20,
    SL: 0.32,
    '3A': 0.85,
    '3E': 0.80,
    '2A': 1.20,
    '1A': 2.00,
    CC: 0.70,
    EC: 1.30
};

/** CC 11/2025 — increase in basic fare (Rs per passenger-km). */
const CC11_INCREMENT_MAIL_EXPRESS_RS_PER_KM = {
    '2S': 0.01,
    SL: 0.01,
    '3A': 0.02,
    '3E': 0.02,
    '2A': 0.02,
    '1A': 0.02,
    CC: 0.02,
    EC: 0.02
};

const CC11_INCREMENT_ORDINARY_RS_PER_KM = {
    '2S': 0.005,
    SL: 0.005,
    '3A': 0.02,
    '3E': 0.02,
    '2A': 0.02,
    '1A': 0.02,
    CC: 0.02,
    EC: 0.02
};

/** CC 11/2025 slab increase for Ordinary Second Class (fixed Rs, not per-km). */
function ordinarySecondClassSlabIncrease(distanceKm) {
    if (distanceKm <= 500) return 0;
    if (distanceKm <= 1500) return 5;
    if (distanceKm <= 2500) return 10;
    if (distanceKm <= 3000) return 15;
    return 15 + Math.round((distanceKm - 3000) * 0.005);
}

/** Reservation fee — unchanged by CC 11/2025 (levied additionally). */
const RESERVATION_CHARGE = {
    '2S': 15,
    SL: 20,
    '3A': 40,
    '3E': 40,
    '2A': 50,
    '1A': 60,
    CC: 40,
    EC: 50
};

/** Superfast surcharge — unchanged by CC 11/2025 (levied additionally where applicable). */
const SUPERFAST_SURCHARGE = {
    '2S': 15,
    SL: 20,
    '3A': 30,
    '3E': 30,
    '2A': 30,
    '1A': 45,
    CC: 25,
    EC: 30
};

const MINIMUM_BASIC_FARE = {
    '2S': 10,
    SL: 125,
    '3A': 350,
    '3E': 320,
    '2A': 550,
    '1A': 900,
    CC: 250,
    EC: 450
};

function normalizeDate(value) {
    if (!value) return null;
    return String(value).split('T')[0];
}

function isCc11Effective(journeyDate) {
    const date = normalizeDate(journeyDate) || normalizeDate(new Date().toISOString());
    return date >= CC11_EFFECTIVE_DATE;
}

function inferServiceCategory(trainTypeCode, trainName = '') {
    const code = String(trainTypeCode || '').toUpperCase();
    const name = String(trainName || '');

    if (code === 'PASS' || /passenger|memu|demu|\blocal\b/i.test(name)) {
        return 'ORDINARY';
    }
    return 'MAIL_EXPRESS';
}

function isPremiumTrain(trainTypeCode, trainName = '') {
    const code = String(trainTypeCode || '').toUpperCase();
    const name = String(trainName || '');
    return /RAJ|SHAT|DUR|VB|TEJAS|GARIB|HUMSAFAR|ANTY/i.test(code)
        || /rajdhani|shatabdi|duronto|vande bharat|tejas|garib rath|humsafar|antyodaya|gatimaan|amrit bharat/i.test(name);
}

function isSuperfastTrain(trainTypeCode, trainName = '') {
    const code = String(trainTypeCode || '').toUpperCase();
    const name = String(trainName || '');
    return code === 'SF' || /superfast|super fast|\bsf\b/i.test(name) || isPremiumTrain(code, name);
}

function calculateBasicFare({
    distanceKm,
    classCode,
    trainTypeCode,
    trainName,
    journeyDate
}) {
    const distance = Math.max(0, Number(distanceKm) || 0);
    const cls = classCode || 'SL';
    const service = inferServiceCategory(trainTypeCode, trainName);
    const baseTable = service === 'ORDINARY'
        ? IRCA_BASE_RATE_ORDINARY_RS_PER_KM
        : IRCA_BASE_RATE_MAIL_EXPRESS_RS_PER_KM;

    let basic = distance * (baseTable[cls] || baseTable.SL || 0.39);

    if (isCc11Effective(journeyDate)) {
        if (service === 'ORDINARY' && cls === '2S') {
            basic += ordinarySecondClassSlabIncrease(distance);
        } else if (service === 'ORDINARY') {
            basic += distance * (CC11_INCREMENT_ORDINARY_RS_PER_KM[cls] || 0.005);
        } else {
            basic += distance * (CC11_INCREMENT_MAIL_EXPRESS_RS_PER_KM[cls] || 0.01);
        }
    }

    if (isPremiumTrain(trainTypeCode, trainName)) {
        basic *= 1.20;
    }

    return Math.max(MINIMUM_BASIC_FARE[cls] || 100, Math.round(basic));
}

function calculateClassFare({
    distanceKm,
    classCode,
    trainTypeCode,
    trainName,
    journeyDate,
    quotaCode,
    includeCharges = true
}) {
    const basic = calculateBasicFare({
        distanceKm,
        classCode,
        trainTypeCode,
        trainName,
        journeyDate
    });

    if (!includeCharges) return basic;

    let total = basic;
    total += RESERVATION_CHARGE[classCode] || 30;

    if (isSuperfastTrain(trainTypeCode, trainName)) {
        total += SUPERFAST_SURCHARGE[classCode] || 20;
    }

    if (quotaCode === 'TQ' || quotaCode === 'Tatkal') {
        total = Math.round(total * 1.3);
    } else if (quotaCode === 'SS' || quotaCode === 'SeniorCitizen') {
        total = Math.round(total * 0.60);
    }

    return total;
}

function applyFaresToClasses(classes, context) {
    if (!classes?.length) return classes;
    return classes.map((cls) => ({
        ...cls,
        price: calculateClassFare({
            ...context,
            classCode: cls.classCode
        }),
        fareSource: 'cc11_2025_simulation'
    }));
}

function getDefaultRatePerKm(classCode, trainTypeCode, trainName, journeyDate) {
    const sampleDistance = 100;
    return calculateBasicFare({
        distanceKm: sampleDistance,
        classCode,
        trainTypeCode,
        trainName,
        journeyDate
    }) / sampleDistance;
}

module.exports = {
    CC11_EFFECTIVE_DATE,
    OFFICIAL_FARE_REFERENCE,
    inferServiceCategory,
    isCc11Effective,
    isPremiumTrain,
    isSuperfastTrain,
    ordinarySecondClassSlabIncrease,
    calculateBasicFare,
    calculateClassFare,
    applyFaresToClasses,
    getDefaultRatePerKm,
    RESERVATION_CHARGE,
    SUPERFAST_SURCHARGE
};
