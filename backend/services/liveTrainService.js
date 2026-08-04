const trainRepository = require('../repositories/trainRepository');
const trainStopRepository = require('../repositories/trainStopRepository');

const simulateRunningStatus = (train, stops) => {
    const now = new Date();
    const progressIndex = Math.min(
        Math.max(Math.floor((now.getHours() * 60 + now.getMinutes()) / 180), 0),
        Math.max(stops.length - 2, 0)
    );
    const currentStop = stops[progressIndex] || stops[0];
    const nextStop = stops[progressIndex + 1] || stops[stops.length - 1];
    const delayMinutes = Math.floor(Math.random() * 25);

    return {
        trainId: train.id,
        trainNumber: train.trainNumber,
        trainName: train.trainName,
        currentLocation: currentStop?.stationName || train.source,
        currentStationCode: currentStop?.stationCode || null,
        nextStation: nextStop?.stationName || train.destination,
        delayMinutes,
        speedKmph: 55 + Math.floor(Math.random() * 35),
        platform: `P${1 + (train.id % 6)}`,
        status: delayMinutes > 15 ? 'Delayed' : 'Running',
        lastUpdated: new Date().toISOString(),
        provider: 'railyatra_live_engine',
        routeStops: stops.map((s, i) => ({
            stationName: s.stationName,
            stationCode: s.stationCode,
            order: s.stopOrder,
            passed: i <= progressIndex,
            current: i === progressIndex
        })),
        expectedArrival: nextStop?.arrivalTime || train.arrivalTime,
        expectedDeparture: currentStop?.departureTime || train.departureTime
    };
};

const getLiveStatusByTrainNumber = async (trainNumber) => {
    const train = await trainRepository.findByNumber(String(trainNumber).trim());
    if (!train) return null;

    const stops = await trainStopRepository.findByTrainId(train.id);
    return simulateRunningStatus(train, stops);
};

const searchLiveTrains = async (query) => {
    const trains = await trainRepository.findAll();
    const term = String(query || '').trim().toLowerCase();
    const filtered = term
        ? trains.filter((t) => t.trainNumber.includes(term) || t.trainName.toLowerCase().includes(term)).slice(0, 10)
        : trains.slice(0, 8);

    const results = [];
    for (const train of filtered) {
        const stops = await trainStopRepository.findByTrainId(train.id);
        results.push(simulateRunningStatus(train, stops));
    }
    return results;
};

module.exports = {
    getLiveStatusByTrainNumber,
    searchLiveTrains
};
