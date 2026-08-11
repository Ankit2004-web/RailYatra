/**
 * Coach composition — official import or full rake template with every coach + seats.
 */
const coachCompositionRepository = require('../repositories/coachCompositionRepository');
const trainClassRepository = require('../repositories/trainClassRepository');
const {
    buildRakeFromTrainClasses,
    getClassTotalFromRake
} = require('./rakeCompositionService');

async function resolveRake(trainNumber) {
    const { version, coaches } = await coachCompositionRepository.getCoachesByTrainNumber(trainNumber);

    if (coaches.length > 0) {
        return {
            compositionVersion: version?.versionTag || null,
            compositionSource: version?.sourceName || null,
            validFrom: version?.validFrom || null,
            validTo: version?.validTo || null,
            capacityStatus: coaches.every((c) => c.capacityKnown) ? 'Known'
                : coaches.some((c) => c.capacityKnown) ? 'Partial' : 'Unknown',
            coaches: coaches.map(mapOfficialCoach)
        };
    }

    const trainRepository = require('../repositories/trainRepository');
    const train = await trainRepository.findByNumber(trainNumber);
    if (!train) {
        return { coaches: [], capacityStatus: 'Unknown', compositionSource: null };
    }

    const trainTypeCode = train.trainTypeId
        ? (await coachCompositionRepository.getTrainTypeCode?.(train.trainTypeId))
        : null;

    const classes = await trainClassRepository.findByTrainId(train.id);
    const rake = buildRakeFromTrainClasses(
        { trainName: train.trainName, trainTypeCode: trainTypeCode || train.trainTypeCode },
        classes
    );

    return {
        compositionVersion: null,
        compositionSource: rake.source,
        validFrom: null,
        validTo: null,
        capacityStatus: rake.capacityStatus,
        coaches: rake.coaches
    };
}

function mapOfficialCoach(row) {
    const meta = {
        coachNumber: row.coachNumber,
        coachType: row.coachTypeCode,
        coachTypeName: row.coachTypeName,
        classCode: row.classCode || null,
        coachModel: row.coachModelCode || null,
        coachModelName: row.coachModelName || null,
        coachPosition: row.coachPosition,
        seatingCapacity: row.capacityKnown ? row.seatingCapacity : null,
        sleepingBerths: row.capacityKnown ? row.sleepingBerths : null,
        capacityKnown: !!row.capacityKnown,
        capacitySource: row.capacitySource || null,
        ladiesCoach: !!row.ladiesCoach,
        divyangCoach: !!row.divyangCoach,
        pantryCar: !!row.pantryCar,
        guardCoach: !!row.guardCoach,
        parcelCoach: !!row.parcelCoach,
        powerCar: !!row.powerCar,
        seats: []
    };

    if (row.capacityKnown && row.classCode) {
        const count = row.seatingCapacity || row.sleepingBerths || 0;
        const isChair = !!row.seatingCapacity;
        meta.seats = Array.from({ length: count }, (_, i) => ({
            coachNumber: row.coachNumber,
            seatNumber: i + 1,
            displayLabel: `${row.coachNumber}-${i + 1}`,
            berthType: isChair ? 'SEAT' : berthCycle(i + 1),
            status: 'Available'
        }));
    }

    return meta;
}

function berthCycle(n) {
    const cycle = (n - 1) % 8;
    if (cycle < 2) return 'LB';
    if (cycle < 4) return 'MB';
    if (cycle < 6) return 'UB';
    if (cycle === 6) return 'SL';
    return 'SU';
}

function summarizeCapacity(coaches) {
    const passenger = coaches.filter((c) => c.classCode && c.capacityKnown);
    let totalAc = 0;
    let totalSleeper = 0;
    let totalChair = 0;
    let totalGeneral = 0;
    let totalReserved = 0;
    let totalPassenger = 0;

    for (const c of passenger) {
        const cap = (c.seatingCapacity || 0) + (c.sleepingBerths || 0);
        totalPassenger += cap;
        if (['1A', '2A', '3A', '3E', 'EA', 'EC', 'CC'].includes(c.classCode)) totalAc += cap;
        if (c.sleepingBerths) totalSleeper += c.sleepingBerths;
        if (c.seatingCapacity) totalChair += c.seatingCapacity;
        if (c.classCode === 'GS' || c.classCode === 'UR') totalGeneral += cap;
        else totalReserved += cap;
    }

    return {
        totalCoaches: coaches.length,
        totalAcCapacity: totalPassenger ? totalAc : null,
        totalSleeperCapacity: totalSleeper || null,
        totalChairCapacity: totalChair || null,
        totalGeneralCapacity: totalGeneral || null,
        totalReservedCapacity: totalReserved || null,
        totalPassengerCapacity: totalPassenger || null
    };
}

async function getTrainCoaches(trainNumber) {
    const rake = await resolveRake(trainNumber);
    const passengerCoaches = rake.coaches.filter((c) => c.classCode);

    return {
        trainNumber,
        compositionVersion: rake.compositionVersion,
        compositionSource: rake.compositionSource,
        validFrom: rake.validFrom,
        validTo: rake.validTo,
        coachCount: rake.coaches.length,
        passengerCoachCount: passengerCoaches.length,
        capacityStatus: rake.capacityStatus,
        coaches: rake.coaches
    };
}

async function getTrainCapacitySummary(trainNumber) {
    const rake = await resolveRake(trainNumber);
    if (!rake.coaches.length) {
        return {
            trainNumber,
            capacityStatus: 'Unknown',
            totalCoaches: 0,
            totalAcCapacity: null,
            totalSleeperCapacity: null,
            totalChairCapacity: null,
            totalGeneralCapacity: null,
            totalReservedCapacity: null,
            totalPassengerCapacity: null,
            message: 'Coach composition unavailable for this train'
        };
    }

    const summary = summarizeCapacity(rake.coaches);
    return {
        trainNumber,
        capacityStatus: rake.capacityStatus,
        compositionSource: rake.compositionSource,
        ...summary
    };
}

async function getTrainLayout(trainNumber) {
    const rake = await resolveRake(trainNumber);
    return {
        trainNumber,
        capacityStatus: rake.capacityStatus,
        compositionSource: rake.compositionSource,
        coaches: rake.coaches.map((c) => ({
            coachNumber: c.coachNumber,
            coachType: c.coachType,
            classCode: c.classCode,
            coachModel: c.coachModel,
            seatingCapacity: c.seatingCapacity,
            sleepingBerths: c.sleepingBerths,
            seatCount: (c.seats || []).length,
            seats: c.seats || []
        }))
    };
}

function enrichClassesFromRakeCoaches(classes, rakeCoaches, { includeSeats = true } = {}) {
    if (!rakeCoaches?.length) return classes;

    return classes.map((cls) => {
        const classCoaches = rakeCoaches.filter((c) => c.classCode === cls.classCode);
        const totalFromRake = getClassTotalFromRake(rakeCoaches, cls.classCode);

        return {
            ...cls,
            totalSeats: totalFromRake || cls.totalSeats,
            availableSeats: cls.availableSeats != null
                ? cls.availableSeats
                : (totalFromRake || cls.totalSeats),
            coachCount: classCoaches.length,
            coaches: classCoaches.map((c) => ({
                coachNumber: c.coachNumber,
                coachType: c.coachType,
                coachModel: c.coachModel,
                seatingCapacity: c.seatingCapacity,
                sleepingBerths: c.sleepingBerths,
                seatCount: (c.seats || []).length,
                ...(includeSeats ? { seats: c.seats || [] } : {})
            }))
        };
    });
}

/** Build full rake from train metadata (no extra DB round-trip). */
function enrichClassesFromTrainMeta(classes, trainName, trainTypeCode, options = {}) {
    const rake = buildRakeFromTrainClasses({ trainName, trainTypeCode }, classes);
    return enrichClassesFromRakeCoaches(classes, rake.coaches, options);
}

/** Enrich train class rows with every coach in the rake and total seats across all coaches */
async function enrichClassesWithRake(trainNumber, classes, trainMeta = null) {
    const { coaches: official } = await coachCompositionRepository.getCoachesByTrainNumber(trainNumber);

    if (official.length > 0) {
        const rakeCoaches = official.map(mapOfficialCoach);
        return enrichClassesFromRakeCoaches(classes, rakeCoaches);
    }

    if (trainMeta) {
        return enrichClassesFromTrainMeta(classes, trainMeta.trainName, trainMeta.trainTypeCode);
    }

    const rake = await resolveRake(trainNumber);
    return enrichClassesFromRakeCoaches(classes, rake.coaches);
}

module.exports = {
    getTrainCoaches,
    getTrainCapacitySummary,
    getTrainLayout,
    enrichClassesWithRake,
    enrichClassesFromTrainMeta,
    enrichClassesFromRakeCoaches,
    resolveRake
};
