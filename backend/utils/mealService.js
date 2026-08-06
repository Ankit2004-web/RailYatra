/**
 * IR-style optional meal pricing (e-catering standard rates, inclusive of GST).
 */
const MEAL_PRICES = Object.freeze({
    Veg: 120,
    'Non-Veg': 150,
    Jain: 120,
    None: 0
});

const MEAL_ELIGIBLE_CLASSES = new Set(['1A', '2A', '3A', '3E', 'CC', 'EC', 'EA']);

function trainProvidesMeals(trainName = '', trainTypeCode = '', classCode = '') {
    if (!MEAL_ELIGIBLE_CLASSES.has(String(classCode || '').toUpperCase())) {
        return false;
    }

    const name = String(trainName || '');
    const type = String(trainTypeCode || '').toUpperCase();

    return /rajdhani|shatabdi|duronto|tejas|humsafar|anubhuthi/i.test(name)
        || ['RAJ', 'SHAT', 'DUR', 'TEJAS', 'HUM'].includes(type);
}

function mealPriceForPreference(preference) {
    if (!preference || preference === 'None') return 0;
    return MEAL_PRICES[preference] ?? 0;
}

function calculateMealTotal(passengers = []) {
    return passengers.reduce(
        (sum, passenger) => sum + mealPriceForPreference(passenger?.foodPreference),
        0
    );
}

function normalizePassengerFoodPreferences(passengers, mealsAvailable) {
    if (mealsAvailable) return passengers;
    return passengers.map((passenger) => ({
        ...passenger,
        foodPreference: 'None'
    }));
}

module.exports = {
    MEAL_PRICES,
    trainProvidesMeals,
    mealPriceForPreference,
    calculateMealTotal,
    normalizePassengerFoodPreferences
};
