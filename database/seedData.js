const addDays = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
};

const { getClassCapacity, estimateTrainTotalCapacity } = require('../backend/utils/coachCapacity');

module.exports = {
    stations: [
        ['NDLS', 'New Delhi', 'New Delhi', 'Delhi'],
        ['CSMT', 'Mumbai CSMT', 'Mumbai', 'Maharashtra'],
        ['HWH', 'Howrah Junction', 'Kolkata', 'West Bengal'],
        ['SBC', 'Bengaluru City', 'Bengaluru', 'Karnataka'],
        ['MAS', 'Chennai Central', 'Chennai', 'Tamil Nadu'],
        ['PNBE', 'Patna Junction', 'Patna', 'Bihar'],
        ['LKO', 'Lucknow NR', 'Lucknow', 'Uttar Pradesh'],
        ['JP', 'Jaipur Junction', 'Jaipur', 'Rajasthan'],
        ['ADI', 'Ahmedabad Junction', 'Ahmedabad', 'Gujarat'],
        ['BCT', 'Mumbai Central', 'Mumbai', 'Maharashtra'],
        ['SC', 'Secunderabad Junction', 'Hyderabad', 'Telangana'],
        ['PUNE', 'Pune Junction', 'Pune', 'Maharashtra'],
        ['CNB', 'Kanpur Central', 'Kanpur', 'Uttar Pradesh'],
        ['BPL', 'Bhopal Junction', 'Bhopal', 'Madhya Pradesh'],
        ['VSKP', 'Visakhapatnam', 'Visakhapatnam', 'Andhra Pradesh'],
        ['BBS', 'Bhubaneswar', 'Bhubaneswar', 'Odisha'],
        ['HYB', 'Hyderabad Deccan', 'Hyderabad', 'Telangana'],
        ['KOAA', 'Kolkata', 'Kolkata', 'West Bengal'],
        ['RNC', 'Ranchi Junction', 'Ranchi', 'Jharkhand'],
        ['GAY', 'Gaya Junction', 'Gaya', 'Bihar'],
        ['BBSR', 'Bhubaneswar New', 'Bhubaneswar', 'Odisha']
    ],
    trains: [
        ['12951', 'Mumbai Rajdhani', 'New Delhi', 'Mumbai Central', '16:55', '08:35', '15h 40m', 1384, 120, 2500, addDays(1)],
        ['12301', 'Howrah Rajdhani', 'New Delhi', 'Howrah Junction', '16:55', '10:05', '17h 10m', 1447, 100, 2200, addDays(1)],
        ['12627', 'Karnataka Express', 'New Delhi', 'Bengaluru City', '20:20', '06:40', '34h 20m', 2365, 150, 1800, addDays(2)],
        ['12621', 'Tamil Nadu Express', 'New Delhi', 'Chennai Central', '22:30', '04:50', '30h 20m', 2180, 140, 1950, addDays(2)],
        ['12309', 'Rajendra Nagar Express', 'New Delhi', 'Patna Junction', '19:15', '08:30', '13h 15m', 1001, 160, 950, addDays(1)],
        ['12230', 'Lucknow Mail', 'New Delhi', 'Lucknow NR', '22:00', '07:20', '9h 20m', 512, 180, 650, addDays(1)],
        ['12958', 'Jaipur Duronto', 'New Delhi', 'Jaipur Junction', '23:00', '05:30', '6h 30m', 303, 90, 1200, addDays(3)],
        ['12917', 'Gujarat Mail', 'Mumbai Central', 'Ahmedabad Junction', '22:20', '06:45', '8h 25m', 493, 130, 850, addDays(2)],
        ['12724', 'Telangana Express', 'New Delhi', 'Secunderabad Junction', '17:25', '19:35', '26h 10m', 1677, 145, 1650, addDays(3)],
        ['12124', 'Deccan Queen', 'Mumbai CSMT', 'Pune Junction', '07:15', '10:30', '3h 15m', 192, 200, 450, addDays(1)],
        ['12382', 'Poorva Express', 'Howrah Junction', 'New Delhi', '08:15', '06:05', '21h 50m', 1447, 155, 1750, addDays(4)],
        ['12276', 'Kanpur Shatabdi', 'New Delhi', 'Kanpur Central', '15:50', '20:45', '4h 55m', 441, 110, 980, addDays(2)],
        ['12649', 'Mysore Express', 'Bengaluru City', 'Chennai Central', '21:30', '04:15', '6h 45m', 362, 170, 720, addDays(3)],
        ['12432', 'Bhopal Shatabdi', 'New Delhi', 'Bhopal Junction', '06:00', '14:25', '8h 25m', 707, 95, 1350, addDays(5)],
        ['12842', 'Coromandel Express', 'Howrah Junction', 'Chennai Central', '14:50', '17:15', '26h 25m', 1661, 165, 1580, addDays(4)],
        ['12859', 'Gitanjali Express', 'Mumbai CSMT', 'Howrah Junction', '13:30', '18:45', '29h 15m', 1968, 175, 1680, addDays(5)],
        ['12779', 'Goa Express', 'New Delhi', 'Pune Junction', '13:10', '11:40', '22h 30m', 1511, 150, 1420, addDays(6)],
        ['12863', 'Howrah Express', 'Visakhapatnam', 'Howrah Junction', '12:20', '03:20', '15h 0m', 881, 160, 1100, addDays(3)],
        ['12417', 'Prayagraj Express', 'New Delhi', 'Kanpur Central', '21:05', '02:35', '5h 30m', 441, 185, 580, addDays(2)],
        ['12616', 'Grand Trunk Express', 'New Delhi', 'Chennai Central', '18:40', '06:15', '35h 35m', 2180, 140, 1900, addDays(7)],
        ['12903', 'Mumbai Central Rajdhani', 'New Delhi', 'Mumbai Central', '16:25', '08:15', '15h 50m', 1384, 115, 2550, addDays(4)],
        ['12269', 'Chennai Duronto', 'New Delhi', 'Chennai Central', '15:45', '20:15', '28h 30m', 2180, 100, 2400, addDays(5)],
        ['12431', 'Rajdhani Express', 'New Delhi', 'Bhopal Junction', '17:55', '23:45', '5h 50m', 707, 105, 1450, addDays(6)],
        ['12740', 'Vande Bharat Express', 'New Delhi', 'Lucknow NR', '06:10', '10:35', '4h 25m', 512, 80, 1650, addDays(1)],
        ['12801', 'Purushottam Express', 'New Delhi', 'Visakhapatnam', '22:00', '04:30', '30h 30m', 1915, 170, 1320, addDays(8)],
        ['12839', 'Howrah-Bhubaneswar Express', 'Howrah Junction', 'Bhubaneswar', '06:00', '14:30', '8h 30m', 445, 150, 680, addDays(1)],
        ['12881', 'Bhubaneswar-Howrah Express', 'Bhubaneswar', 'Howrah Junction', '07:00', '15:30', '8h 30m', 445, 150, 680, addDays(1)]
    ],
    getClassesForTrain: (trainName, basePrice, totalSeats) => {
        let templates;

        if (/Rajdhani|Duronto|Vande Bharat/i.test(trainName)) {
            templates = [
                ['1A', 'AC First Class', 5.0, 0.05],
                ['2A', 'AC 2 Tier', 3.0, 0.10],
                ['3A', 'AC 3 Tier', 2.0, 0.35],
                ['CC', 'Chair Car', 1.5, 0.50]
            ];
        } else if (/Shatabdi/i.test(trainName)) {
            templates = [
                ['CC', 'Chair Car', 1.8, 0.70],
                ['EC', 'Executive Chair', 3.0, 0.30]
            ];
        } else {
            templates = [
                ['SL', 'Sleeper', 1.0, 0.45],
                ['3A', 'AC 3 Tier', 2.0, 0.25],
                ['2A', 'AC 2 Tier', 3.0, 0.15],
                ['2S', 'Second Sitting', 0.6, 0.15]
            ];
        }

        return templates.map(([classCode, className, multiplier]) => {
            const seats = getClassCapacity(classCode, trainName);
            return {
                classCode,
                className,
                price: Math.round(basePrice * multiplier),
                totalSeats: seats,
                availableSeats: seats
            };
        });

    },
    getTrainTotalCapacity: (trainName, classCodes) =>
        estimateTrainTotalCapacity(classCodes, trainName),
    buildTrainStops: (train) => {
        const [, , source, destination, departureTime, arrivalTime, , distance] = train;
        const midDistance = Math.floor(distance / 2);

        return [
            {
                stationName: source,
                stopOrder: 1,
                arrivalTime: null,
                departureTime,
                haltMinutes: 0,
                distanceKm: 0
            },
            {
                stationName: 'Midway Junction',
                stopOrder: 2,
                arrivalTime: '--:--',
                departureTime: '--:--',
                haltMinutes: 5,
                distanceKm: midDistance
            },
            {
                stationName: destination,
                stopOrder: 3,
                arrivalTime,
                departureTime: null,
                haltMinutes: 0,
                distanceKm: distance
            }
        ];
    }
};
