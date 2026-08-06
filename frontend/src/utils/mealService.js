export const MEAL_PRICES = Object.freeze({
  Veg: 120,
  'Non-Veg': 150,
  Jain: 120,
  None: 0
});

const MEAL_ELIGIBLE_CLASSES = new Set(['1A', '2A', '3A', '3E', 'CC', 'EC', 'EA']);

export function trainProvidesMeals(trainName = '', trainTypeCode = '', classCode = '') {
  if (!MEAL_ELIGIBLE_CLASSES.has(String(classCode || '').toUpperCase())) {
    return false;
  }

  const name = String(trainName || '');
  const type = String(trainTypeCode || '').toUpperCase();

  return /rajdhani|shatabdi|duronto|tejas|humsafar|anubhuthi/i.test(name)
    || ['RAJ', 'SHAT', 'DUR', 'TEJAS', 'HUM'].includes(type);
}

export function mealPriceForPreference(preference) {
  if (!preference || preference === 'None') return 0;
  return MEAL_PRICES[preference] ?? 0;
}

export function calculateMealTotal(passengers = []) {
  return passengers.reduce(
    (sum, passenger) => sum + mealPriceForPreference(passenger?.foodPreference),
    0
  );
}
