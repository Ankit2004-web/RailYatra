const trainRepository = require('../repositories/trainRepository');

function recommendSeats({ train, classCode, passengers, preferences = {} }) {
    const recommendations = [];
    const pref = preferences.berth || 'Lower';
    const isSenior = passengers.some((p) => Number(p.age) >= 60);
    const isLadies = passengers.some((p) => p.gender === 'Female');

    recommendations.push({
        type: 'berth',
        title: isSenior ? 'Lower berth recommended' : `${pref} berth preference`,
        reason: isSenior
            ? 'Senior citizens are eligible for lower berth quota when available.'
            : 'Based on your berth preference selection.',
        confidence: isSenior ? 0.92 : 0.78
    });

    if (classCode === 'SL' || classCode === '3A') {
        recommendations.push({
            type: 'coach',
            title: 'Middle coaches for smoother ride',
            reason: 'Coaches B1–B4 typically have less vibration on long routes.',
            confidence: 0.71
        });
    }

    if (isLadies && passengers.length === 1) {
        recommendations.push({
            type: 'quota',
            title: 'Consider Ladies quota',
            reason: 'Single female travellers may get better berth allocation in Ladies quota.',
            confidence: 0.85
        });
    }

    if (train?.duration && String(train.duration).includes('h')) {
        recommendations.push({
            type: 'food',
            title: 'Pre-order veg meal',
            reason: 'Journey over 6 hours — meal booking improves on-board availability.',
            confidence: 0.66
        });
    }

    return recommendations;
}

async function getRecommendations({ trainId, classCode, passengers, preferences }) {
    const train = await trainRepository.findById(trainId);
    return recommendSeats({ train, classCode, passengers, preferences });
}

module.exports = { getRecommendations, recommendSeats };
