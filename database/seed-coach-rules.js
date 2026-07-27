/**
 * Seeds CoachModels, CoachTypes, CoachCapacityRules, and CoachLayouts
 * from official Indian Railways coach classification (ICF/LHB/VB/MEMU/DEMU).
 * Does NOT seed per-train composition — that requires licensed import data.
 */
const { getPool, closePool } = require('./connection');

const COACH_MODELS = [
    ['ICF', 'ICF Coach', 'Integral Coach Factory conventional design'],
    ['LHB', 'LHB Coach', 'Linke Hofmann Busch stainless steel coaches'],
    ['VB', 'Vande Bharat', 'Train18 / Vande Bharat trainset'],
    ['TRAIN18', 'Train18', 'Train18 platform (same family as VB)'],
    ['MEMU', 'MEMU', 'Mainline Electric Multiple Unit'],
    ['DEMU', 'DEMU', 'Diesel Electric Multiple Unit'],
    ['DD', 'Double Decker', 'Double-decker LHB/ICF coaches'],
    ['JS', 'Jan Shatabdi', 'Jan Shatabdi rake variant']
];

/** [code, name, irCategory, travelClassCode, isPassenger, isAc, isSleeper, isChair, isReserved] */
const COACH_TYPES = [
    ['HA', 'AC First Class', 'FirstAC', '1A', 1, 1, 1, 0, 1],
    ['A', 'AC Two Tier', 'AC2Tier', '2A', 1, 1, 1, 0, 1],
    ['B', 'AC Three Tier', 'AC3Tier', '3A', 1, 1, 1, 0, 1],
    ['G', 'AC Three Economy', 'AC3Economy', '3E', 1, 1, 1, 0, 1],
    ['EA', 'Anubhuti', 'Anubhuti', 'EA', 1, 1, 0, 1, 1],
    ['E', 'Executive Chair Car', 'Executive', 'EC', 1, 1, 0, 1, 1],
    ['C', 'AC Chair Car', 'ChairCar', 'CC', 1, 1, 0, 1, 1],
    ['S', 'Sleeper Class', 'Sleeper', 'SL', 1, 0, 1, 0, 1],
    ['D', 'Second Sitting', 'SecondSitting', '2S', 1, 0, 0, 1, 1],
    ['GS', 'General Unreserved', 'General', 'GS', 1, 0, 0, 1, 0],
    ['UR', 'Unreserved', 'General', 'GS', 1, 0, 0, 1, 0],
    ['PC', 'Pantry Car', 'Utility', null, 0, 0, 0, 0, 0],
    ['SLR', 'Seating-cum-Luggage/Guard', 'Utility', null, 0, 0, 0, 0, 0],
    ['EOG', 'End on Generator/Power Car', 'Power', null, 0, 0, 0, 0, 0],
    ['PAR', 'Parcel Van', 'Parcel', null, 0, 0, 0, 0, 0]
];

/**
 * [coachTypeCode, coachModelCode, seats, berths, coupes, cabins, totalBerths, source]
 * Berths/seats per IR official classification document.
 */
const CAPACITY_RULES = [
    ['HA', 'LHB', null, 24, 2, 6, 24, 'IR AC First Class — full LHB coach: 8 compartments incl. 2 coupes'],
    ['HA', 'ICF', null, 24, 2, 6, 24, 'IR AC First Class — full ICF coach'],
    ['A', 'LHB', null, 54, null, null, 54, 'IR AC 2-Tier LHB: 54 berths'],
    ['A', 'ICF', null, 46, null, null, 46, 'IR AC 2-Tier ICF: 46 berths'],
    ['B', 'LHB', null, 72, null, null, 72, 'IR AC 3-Tier LHB: 72 berths'],
    ['B', 'ICF', null, 64, null, null, 64, 'IR AC 3-Tier ICF: 64 berths'],
    ['G', 'LHB', null, 78, null, null, 78, 'IR AC 3-Economy (Garib Rath): 78 berths'],
    ['G', 'ICF', null, 78, null, null, 78, 'IR AC 3-Economy ICF variant'],
    ['EA', 'LHB', 50, null, null, null, null, 'IR Anubhuti: 50 seats with entertainment'],
    ['E', 'LHB', 56, null, null, null, null, 'IR Executive Chair Car LHB: 56 seats, 2+2'],
    ['E', 'ICF', 56, null, null, null, null, 'IR Executive Chair Car ICF'],
    ['C', 'LHB', 73, null, null, null, null, 'IR AC Chair Car: 73 seats, 3+2'],
    ['C', 'ICF', 73, null, null, null, null, 'IR AC Chair Car ICF'],
    ['S', 'LHB', null, 78, null, null, 78, 'IR Sleeper LHB: 78 berths'],
    ['S', 'ICF', null, 72, null, null, 72, 'IR Sleeper ICF: 72 berths'],
    ['D', 'LHB', 73, null, null, null, null, 'IR Second Sitting — same layout as CC without AC'],
    ['D', 'ICF', 73, null, null, null, null, 'IR Second Sitting ICF'],
    ['GS', 'LHB', 99, null, null, null, null, 'IR General Unreserved LHB: 99 seats'],
    ['GS', 'ICF', 90, null, null, null, null, 'IR General Unreserved ICF: 90 seats'],
    ['UR', 'LHB', 99, null, null, null, null, 'IR Unreserved LHB'],
    ['UR', 'ICF', 90, null, null, null, null, 'IR Unreserved ICF'],
    ['E', 'VB', 44, null, null, null, null, 'Vande Bharat Executive: ~44 seats per executive car'],
    ['C', 'VB', 78, null, null, null, null, 'Vande Bharat Chair Car: ~78 seats per car'],
    ['C', 'JS', 78, null, null, null, null, 'Jan Shatabdi AC Chair Car'],
    ['A', 'DD', null, 40, null, null, 40, 'Double Decker AC 2-Tier approx per deck combined'],
    ['S', 'DD', null, 60, null, null, 60, 'Double Decker Sleeper approx'],
    ['C', 'MEMU', 100, null, null, null, null, 'MEMU driving trailer — varies by rake; rule for standard DTC'],
    ['C', 'DEMU', 90, null, null, null, null, 'DEMU standard trailer coach']
];

const LAYOUTS = [
    ['HA-LHB-STD', 'HA', 'LHB', 'LHB First AC Standard', '2 coupe (2 berths each) + 6 cabin (4 berths each) = 24'],
    ['A-LHB-STD', 'A', 'LHB', 'LHB AC 2-Tier Standard', '54 berths: 3-tier bays + side lower/upper'],
    ['B-LHB-STD', 'B', 'LHB', 'LHB AC 3-Tier Standard', '72 berths across 9 bays'],
    ['S-LHB-STD', 'S', 'LHB', 'LHB Sleeper Standard', '78 berths'],
    ['C-LHB-STD', 'C', 'LHB', 'LHB AC Chair 3+2', '73 seats in 3+2 arrangement'],
    ['D-LHB-STD', 'D', 'LHB', 'LHB Second Sitting 3+2', '73 seats — same layout as AC Chair Car without AC'],
    ['D-ICF-STD', 'D', 'ICF', 'ICF Second Sitting 3+2', '73 seats in 3+2 arrangement'],
    ['E-LHB-STD', 'E', 'LHB', 'LHB Executive 2+2', '56 seats in 2+2 arrangement'],
    ['VB-EC-STD', 'E', 'VB', 'Vande Bharat Executive', 'Rotating executive seats'],
    ['VB-CC-STD', 'C', 'VB', 'Vande Bharat Chair', '2+2 aircraft-style seating']
];

async function seedCoachRules() {
    const pool = await getPool();

    for (const [code, name, desc] of COACH_MODELS) {
        const ex = await pool.request().input('code', 'NVarChar', code)
            .query('SELECT id FROM CoachModels WHERE code=@code');
        if (!ex.recordset[0]) {
            await pool.request().input('code', 'NVarChar', code).input('name', 'NVarChar', name)
                .input('desc', 'NVarChar', desc)
                .query('INSERT INTO CoachModels (code, name, description) VALUES (@code, @name, @desc)');
        }
    }

    const travelClasses = await pool.request().query('SELECT id, code FROM TravelClasses');
    const tcMap = new Map(travelClasses.recordset.map((r) => [r.code, r.id]));

    for (const [code, name, irCat, tc, ...flags] of COACH_TYPES) {
        const [isPassenger, isAc, isSleeper, isChair, isReserved] = flags;
        const travelClassId = tc ? tcMap.get(tc) || null : null;
        const ex = await pool.request().input('code', 'NVarChar', code)
            .query('SELECT id FROM CoachTypes WHERE code=@code');
        if (ex.recordset[0]) {
            await pool.request()
                .input('id', 'Int', ex.recordset[0].id)
                .input('name', 'NVarChar', name)
                .input('irCat', 'NVarChar', irCat)
                .input('tcId', 'Int', travelClassId)
                .input('ip', 'Bit', isPassenger)
                .input('iac', 'Bit', isAc)
                .input('isl', 'Bit', isSleeper)
                .input('ich', 'Bit', isChair)
                .input('ir', 'Bit', isReserved)
                .query(`UPDATE CoachTypes SET name=@name, irCategory=@irCat, travelClassId=@tcId,
                        isPassengerCoach=@ip, isAcCoach=@iac, isSleeperCoach=@isl, isChairCoach=@ich,
                        isReservedCoach=@ir WHERE id=@id`);
        } else {
            await pool.request()
                .input('code', 'NVarChar', code)
                .input('name', 'NVarChar', name)
                .input('irCat', 'NVarChar', irCat)
                .input('tcId', 'Int', travelClassId)
                .input('ip', 'Bit', isPassenger)
                .input('iac', 'Bit', isAc)
                .input('isl', 'Bit', isSleeper)
                .input('ich', 'Bit', isChair)
                .input('ir', 'Bit', isReserved)
                .query(`INSERT INTO CoachTypes (code, name, irCategory, travelClassId, isPassengerCoach,
                        isAcCoach, isSleeperCoach, isChairCoach, isReservedCoach)
                        VALUES (@code, @name, @irCat, @tcId, @ip, @iac, @isl, @ich, @ir)`);
        }
    }

    const models = await pool.request().query('SELECT id, code FROM CoachModels');
    const types = await pool.request().query('SELECT id, code FROM CoachTypes');
    const mMap = new Map(models.recordset.map((r) => [r.code, r.id]));
    const tMap = new Map(types.recordset.map((r) => [r.code, r.id]));

    for (const [tCode, mCode, seats, berths, coupes, cabins, totalBerths, source] of CAPACITY_RULES) {
        const coachTypeId = tMap.get(tCode);
        const coachModelId = mMap.get(mCode);
        if (!coachTypeId || !coachModelId) continue;

        const ex = await pool.request()
            .input('tid', 'Int', coachTypeId)
            .input('mid', 'Int', coachModelId)
            .query('SELECT id FROM CoachCapacityRules WHERE coachTypeId=@tid AND coachModelId=@mid');

        if (ex.recordset[0]) {
            await pool.request()
                .input('id', 'Int', ex.recordset[0].id)
                .input('seats', 'Int', seats)
                .input('berths', 'Int', berths)
                .input('coupes', 'Int', coupes)
                .input('cabins', 'Int', cabins)
                .input('total', 'Int', totalBerths)
                .input('src', 'NVarChar', source)
                .query(`UPDATE CoachCapacityRules SET seatingCapacity=@seats, sleepingBerths=@berths,
                        coupeCount=@coupes, cabinCount=@cabins, totalBerths=@total, sourceReference=@src,
                        updatedAt=SYSUTCDATETIME() WHERE id=@id`);
        } else {
            await pool.request()
                .input('tid', 'Int', coachTypeId)
                .input('mid', 'Int', coachModelId)
                .input('seats', 'Int', seats)
                .input('berths', 'Int', berths)
                .input('coupes', 'Int', coupes)
                .input('cabins', 'Int', cabins)
                .input('total', 'Int', totalBerths)
                .input('src', 'NVarChar', source)
                .query(`INSERT INTO CoachCapacityRules (coachTypeId, coachModelId, seatingCapacity, sleepingBerths,
                        coupeCount, cabinCount, totalBerths, sourceReference)
                        VALUES (@tid, @mid, @seats, @berths, @coupes, @cabins, @total, @src)`);
        }
    }

    for (const [layoutCode, tCode, mCode, layoutName, config] of LAYOUTS) {
        const coachTypeId = tMap.get(tCode);
        const coachModelId = mMap.get(mCode);
        if (!coachTypeId || !coachModelId) continue;

        const ex = await pool.request().input('code', 'NVarChar', layoutCode)
            .query('SELECT id FROM CoachLayouts WHERE layoutCode=@code');
        if (!ex.recordset[0]) {
            await pool.request()
                .input('code', 'NVarChar', layoutCode)
                .input('tid', 'Int', coachTypeId)
                .input('mid', 'Int', coachModelId)
                .input('name', 'NVarChar', layoutName)
                .input('config', 'NVarChar', config)
                .query(`INSERT INTO CoachLayouts (layoutCode, coachTypeId, coachModelId, layoutName, berthConfiguration)
                        VALUES (@code, @tid, @mid, @name, @config)`);
        }
    }

    console.log(`Seeded ${COACH_MODELS.length} models, ${COACH_TYPES.length} types, ${CAPACITY_RULES.length} capacity rules.`);
    await closePool();
}

if (require.main === module) {
    seedCoachRules().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { seedCoachRules, CAPACITY_RULES, COACH_MODELS, COACH_TYPES };
