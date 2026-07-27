/**
 * Imports official train coach composition from CSV.
 * CSV columns: trainNumber, trainName, coachNumber, coachTypeCode, coachModelCode,
 *   coachPosition, ladiesCoach, divyangCoach, pantryCar, guardCoach, parcelCoach, powerCar,
 *   validFrom, validTo
 *
 * Capacity resolved from CoachCapacityRules — NOT hardcoded per row.
 * Source file must be from licensed/official dataset (data/railway/processed/coach_composition.csv).
 */
const fs = require('fs');
const path = require('path');
const { getPool, withTransaction } = require('../connection');
const { readCsvFile } = require('./csvParser');
const { normalizeTrainNumber } = require('./normalizers');

class CoachCompositionImporter {
    constructor(options = {}) {
        this.csvPath = options.csvPath
            || path.join(__dirname, '../data/railway/processed/coach_composition.csv');
        this.sourceName = options.sourceName || 'Official Coach Composition Import';
        this.sourceUrl = options.sourceUrl || null;
    }

    async run() {
        if (!fs.existsSync(this.csvPath)) {
            throw new Error(
                `Coach composition file not found: ${this.csvPath}. `
                + 'Import only from official/licensed rake data — do not generate fake compositions.'
            );
        }

        const rows = readCsvFile(this.csvPath);
        const byTrain = new Map();
        for (const row of rows) {
            const tn = normalizeTrainNumber(row.trainNumber);
            if (!tn) continue;
            if (!byTrain.has(tn)) byTrain.set(tn, []);
            byTrain.get(tn).push(row);
        }

        const pool = await getPool();
        const types = await pool.request().query('SELECT id, code FROM CoachTypes');
        const models = await pool.request().query('SELECT id, code FROM CoachModels');
        const tMap = new Map(types.recordset.map((r) => [r.code.toUpperCase(), r.id]));
        const mMap = new Map(models.recordset.map((r) => [r.code.toUpperCase(), r.id]));

        let importedTrains = 0;
        let importedCoaches = 0;
        const errors = [];

        for (const [trainNumber, coachRows] of byTrain) {
            try {
                await withTransaction(async ({ query }) => {
                    const trainRow = await query(
                        'SELECT id, trainName FROM Trains WHERE trainNumber = ?',
                        [trainNumber]
                    );
                    const trainId = trainRow[0]?.id || null;
                    const trainName = trainRow[0]?.trainName || coachRows[0]?.trainName || null;
                    const versionTag = `comp-${trainNumber}-${Date.now()}`;

                    await query(
                        'UPDATE CompositionVersion SET isActive = 0 WHERE trainNumber = ?',
                        [trainNumber]
                    );

                    const verResult = await query(
                        `INSERT INTO CompositionVersion (versionTag, trainNumber, sourceName, sourceUrl, isActive, notes)
                         OUTPUT INSERTED.id VALUES (?, ?, ?, ?, 1, ?)`,
                        [versionTag, trainNumber, this.sourceName, this.sourceUrl,
                            `Imported ${coachRows.length} coaches from ${path.basename(this.csvPath)}`]
                    );
                    const versionId = verResult[0].id;

                    let knownCount = 0;
                    let totalAc = 0;
                    let totalSleeper = 0;
                    let totalChair = 0;
                    let totalGeneral = 0;
                    let totalReserved = 0;
                    let totalPassenger = 0;

                    coachRows.sort((a, b) => Number(a.coachPosition) - Number(b.coachPosition));

                    for (const row of coachRows) {
                        const typeCode = String(row.coachTypeCode || '').toUpperCase();
                        const modelCode = String(row.coachModelCode || '').toUpperCase();
                        const coachTypeId = tMap.get(typeCode);
                        if (!coachTypeId) {
                            errors.push({ trainNumber, coach: row.coachNumber, msg: `Unknown coach type ${typeCode}` });
                            continue;
                        }
                        const coachModelId = modelCode ? mMap.get(modelCode) || null : null;

                        let rule = null;
                        if (coachModelId) {
                            const rules = await query(
                                `SELECT TOP 1 * FROM CoachCapacityRules
                                 WHERE coachTypeId = ? AND coachModelId = ?
                                 ORDER BY effectiveFrom DESC`,
                                [coachTypeId, coachModelId]
                            );
                            rule = rules[0] || null;
                        }

                        const capacityKnown = !!rule;
                        const seatingCapacity = rule?.seatingCapacity ?? null;
                        const sleepingBerths = rule?.sleepingBerths ?? null;
                        const ruleId = rule?.id ?? null;

                        if (capacityKnown) knownCount += 1;

                        const ctRow = await query('SELECT * FROM CoachTypes WHERE id = ?', [coachTypeId]);
                        const ct = ctRow[0];
                        const passengerCap = (seatingCapacity || 0) + (sleepingBerths || 0);

                        if (capacityKnown && ct?.isPassengerCoach) {
                            totalPassenger += passengerCap;
                            if (ct.isAcCoach) totalAc += passengerCap;
                            if (ct.isSleeperCoach) totalSleeper += sleepingBerths || 0;
                            if (ct.isChairCoach) totalChair += seatingCapacity || 0;
                            if (!ct.isReservedCoach) totalGeneral += seatingCapacity || sleepingBerths || 0;
                            if (ct.isReservedCoach) totalReserved += passengerCap;
                        }

                        await query(
                            `INSERT INTO TrainCoachComposition (
                                trainId, trainNumber, trainName, compositionVersionId, coachNumber,
                                coachTypeId, coachModelId, coachPosition, seatingCapacity, sleepingBerths,
                                capacityKnown, capacityRuleId, ladiesCoach, divyangCoach, pantryCar,
                                guardCoach, parcelCoach, powerCar
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                trainId, trainNumber, trainName, versionId, row.coachNumber,
                                coachTypeId, coachModelId, Number(row.coachPosition),
                                seatingCapacity, sleepingBerths, capacityKnown ? 1 : 0, ruleId,
                                row.ladiesCoach === '1' || row.ladiesCoach === 'true' ? 1 : 0,
                                row.divyangCoach === '1' || row.divyangCoach === 'true' ? 1 : 0,
                                row.pantryCar === '1' || row.pantryCar === 'true' ? 1 : 0,
                                row.guardCoach === '1' || row.guardCoach === 'true' ? 1 : 0,
                                row.parcelCoach === '1' || row.parcelCoach === 'true' ? 1 : 0,
                                row.powerCar === '1' || row.powerCar === 'true' ? 1 : 0
                            ]
                        );
                        importedCoaches += 1;
                    }

                    const capacityStatus = knownCount === 0 ? 'Unknown'
                        : knownCount === coachRows.length ? 'Known' : 'Partial';

                    await query(
                        `INSERT INTO TrainCapacity (
                            trainId, trainNumber, compositionVersionId, totalCoaches,
                            totalAcCapacity, totalSleeperCapacity, totalChairCapacity,
                            totalGeneralCapacity, totalReservedCapacity, totalPassengerCapacity,
                            capacityStatus
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            trainId, trainNumber, versionId, coachRows.length,
                            capacityStatus === 'Unknown' ? null : totalAc,
                            capacityStatus === 'Unknown' ? null : totalSleeper,
                            capacityStatus === 'Unknown' ? null : totalChair,
                            capacityStatus === 'Unknown' ? null : totalGeneral,
                            capacityStatus === 'Unknown' ? null : totalReserved,
                            capacityStatus === 'Unknown' ? null : totalPassenger,
                            capacityStatus
                        ]
                    );
                });
                importedTrains += 1;
            } catch (err) {
                errors.push({ trainNumber, msg: err.message });
            }
        }

        return { importedTrains, importedCoaches, errors, trainCount: byTrain.size };
    }
}

async function main() {
    const importer = new CoachCompositionImporter();
    const report = await importer.run();
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.errors.length > 50 ? 1 : 0);
}

if (require.main === module) {
    main().catch((err) => {
        console.error(err.message);
        process.exit(1);
    });
}

module.exports = CoachCompositionImporter;
