const { requireFromBackend } = require('./bootstrap');
const bcrypt = requireFromBackend('bcryptjs');
const { execSync } = require('child_process');
const path = require('path');
const { getPool, closePool } = require('./connection');
const { stations, trains, getClassesForTrain, buildTrainStops } = require('./seedData');

function ensureLocalDbRunning() {
    try {
        execSync('sqllocaldb start MSSQLLocalDB', { stdio: 'ignore' });
    } catch (error) {
        // Ignore if already running.
    }
}

async function seedDatabase() {
    ensureLocalDbRunning();
    const pool = await getPool();

    try {
        console.log('Connected for seeding...');

        const stationCount = await pool.request().query('SELECT COUNT(*) AS count FROM Stations');
        if (stationCount.recordset[0].count === 0) {
            for (const [code, name, city, state] of stations) {
                await pool.request()
                    .input('code', 'NVarChar', code)
                    .input('name', 'NVarChar', name)
                    .input('city', 'NVarChar', city)
                    .input('state', 'NVarChar', state)
                    .query('INSERT INTO Stations (code, name, city, state) VALUES (@code, @name, @city, @state)');
            }
            console.log(`Seeded ${stations.length} stations.`);
        } else {
            console.log('Stations already exist, skipping.');
        }

        const trainCount = await pool.request().query('SELECT COUNT(*) AS count FROM Trains');
        if (trainCount.recordset[0].count === 0) {
            for (const train of trains) {
                await pool.request()
                    .input('trainNumber', 'NVarChar', train[0])
                    .input('trainName', 'NVarChar', train[1])
                    .input('source', 'NVarChar', train[2])
                    .input('destination', 'NVarChar', train[3])
                    .input('departureTime', 'NVarChar', train[4])
                    .input('arrivalTime', 'NVarChar', train[5])
                    .input('duration', 'NVarChar', train[6])
                    .input('distance', 'Int', train[7])
                    .input('availableSeats', 'Int', train[8])
                    .input('price', 'Decimal', train[9])
                    .input('journeyDate', 'Date', train[10])
                    .query(`INSERT INTO Trains (trainNumber, trainName, source, destination, departureTime, arrivalTime, duration, distance, availableSeats, price, journeyDate)
                            VALUES (@trainNumber, @trainName, @source, @destination, @departureTime, @arrivalTime, @duration, @distance, @availableSeats, @price, @journeyDate)`);
            }
            console.log(`Seeded ${trains.length} trains.`);
        } else {
            console.log('Trains already exist, skipping.');
        }

        const classCount = await pool.request().query('SELECT COUNT(*) AS count FROM TrainClasses');
        if (classCount.recordset[0].count === 0) {
            const trainRows = await pool.request().query('SELECT id, trainName, price, availableSeats FROM Trains');
            let seededClasses = 0;

            for (const train of trainRows.recordset) {
                const classes = getClassesForTrain(train.trainName, Number(train.price), train.availableSeats);
                for (const cls of classes) {
                    await pool.request()
                        .input('trainId', 'Int', train.id)
                        .input('classCode', 'NVarChar', cls.classCode)
                        .input('className', 'NVarChar', cls.className)
                        .input('price', 'Decimal', cls.price)
                        .input('totalSeats', 'Int', cls.totalSeats)
                        .input('availableSeats', 'Int', cls.availableSeats)
                        .query(`INSERT INTO TrainClasses (trainId, classCode, className, price, totalSeats, availableSeats)
                                VALUES (@trainId, @classCode, @className, @price, @totalSeats, @availableSeats)`);
                    seededClasses += 1;
                }
            }

            console.log(`Seeded ${seededClasses} train classes.`);
        } else {
            console.log('Train classes already exist, skipping.');
        }

        const seatCount = await pool.request().query('SELECT COUNT(*) AS count FROM Seats');
        if (seatCount.recordset[0].count === 0) {
            const classRows = await pool.request().query(
                'SELECT tc.trainId, tc.classCode, tc.totalSeats, t.journeyDate FROM TrainClasses tc INNER JOIN Trains t ON tc.trainId = t.id'
            );
            const seatRepository = require(path.join(__dirname, '../backend/repositories/seatRepository'));
            let seededSeats = 0;

            for (const row of classRows.recordset) {
                const journeyDate = new Date(row.journeyDate).toISOString().split('T')[0];
                await seatRepository.seedSeatsForClass(row.trainId, row.classCode, row.totalSeats, journeyDate);
                seededSeats += row.totalSeats;
            }

            console.log(`Seeded ${seededSeats} seats.`);
        } else {
            console.log('Seats already exist, skipping.');
        }

        const stopCount = await pool.request().query('SELECT COUNT(*) AS count FROM TrainStops');
        if (stopCount.recordset[0].count === 0) {
            const trainStopRepository = require(path.join(__dirname, '../backend/repositories/trainStopRepository'));
            const trainRows = await pool.request().query('SELECT id, trainNumber, trainName, source, destination, departureTime, arrivalTime, distance FROM Trains');
            let seededStops = 0;

            for (const train of trainRows.recordset) {
                const seedTrain = trains.find((t) => t[0] === train.trainNumber);
                const stops = buildTrainStops(seedTrain || [
                    train.trainNumber, train.trainName, train.source, train.destination,
                    train.departureTime, train.arrivalTime, '', train.distance, 0, 0, train.journeyDate
                ]);
                await trainStopRepository.createMany(train.id, stops);
                seededStops += stops.length;
            }

            console.log(`Seeded ${seededStops} train route stops.`);
        } else {
            console.log('Train stops already exist, skipping.');
        }

        const demoEmails = ['demo@railway.com', 'admin@railway.com'];
        for (const demoEmail of demoEmails) {
            await pool.request()
                .input('email', 'NVarChar', demoEmail)
                .query('DELETE FROM Users WHERE email = @email');
        }

        const adminEmail = process.env.ADMIN_EMAIL?.trim();
        const adminPassword = process.env.ADMIN_PASSWORD?.trim();

        if (!adminEmail || !adminPassword) {
            console.log('ADMIN_EMAIL and ADMIN_PASSWORD not set — skipping admin seed.');
            console.log('Seed completed successfully.');
            const migrateMasterData = require('./migrate-master-data');
            await migrateMasterData();
            return;
        }

        const adminResult = await pool.request()
            .input('email', 'NVarChar', adminEmail)
            .query('SELECT * FROM Users WHERE email = @email');

        if (adminResult.recordset.length === 0) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(adminPassword, salt);

            await pool.request()
                .input('name', 'NVarChar', 'System Admin')
                .input('email', 'NVarChar', adminEmail)
                .input('password', 'NVarChar', hashedPassword)
                .input('phone', 'NVarChar', '9999999999')
                .input('isAdmin', 'Bit', true)
                .query('INSERT INTO Users (name, email, password, phone, isAdmin) VALUES (@name, @email, @password, @phone, @isAdmin)');

            console.log(`Admin user created: ${adminEmail}`);
        } else if (!adminResult.recordset[0].isAdmin) {
            await pool.request()
                .input('email', 'NVarChar', adminEmail)
                .query('UPDATE Users SET isAdmin = 1 WHERE email = @email');
            console.log(`Existing user promoted to admin: ${adminEmail}`);
        } else {
            console.log('Admin user already exists.');
        }

        console.log('Seed completed successfully.');
        const migrateMasterData = require('./migrate-master-data');
        await migrateMasterData();
    } catch (error) {
        console.error('Seed failed:', error.message);
        if (require.main === module) {
            process.exit(1);
        }
        throw error;
    } finally {
        await closePool();
    }
}

if (require.main === module) {
    seedDatabase();
}

module.exports = seedDatabase;
