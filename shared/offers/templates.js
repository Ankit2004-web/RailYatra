/** Offer templates — schedules and rules drive daily auto-refresh. */

const OFFER_CATEGORIES = [
  { id: 'all', label: 'All Offers' },
  { id: 'train', label: 'Train Deals' },
  { id: 'bank', label: 'Bank Offers' },
  { id: 'payment', label: 'UPI & Wallet' },
  { id: 'new', label: 'New User' }
];

const AC_CLASSES = ['1A', '2A', '3A', 'CC'];

/**
 * @typedef {Object} OfferTemplate
 * @property {string} id
 * @property {string} category
 * @property {string} codePrefix — stable prefix; daily suffix appended in engine
 * @property {string} badge
 * @property {string} title
 * @property {string} subtitle
 * @property {string} gradient
 * @property {string} terms
 * @property {string} cta
 * @property {object} rule — passed to discount calculator
 * @property {object} [schedule]
 * @property {'daily'|'weekly'|'always'} validity
 */

const OFFER_TEMPLATES = [
  {
    id: 'first-booking',
    category: 'new',
    codePrefix: 'RAILFIRST',
    badge: 'New User',
    title: 'Flat ₹150 OFF',
    subtitle: 'On your first train booking',
    gradient: 'offer-card-teal',
    terms: 'Min booking ₹500. Valid once per account.',
    cta: 'Book now',
    rule: { type: 'flat', amount: 150, minTotal: 500 },
    schedule: { always: true },
    validity: 'always'
  },
  {
    id: 'daily-flash',
    category: 'train',
    codePrefix: 'FLASH',
    badge: 'Deal of the Day',
    title: 'Daily Flash Save',
    subtitle: 'Rotating fare discount on select routes',
    gradient: 'offer-card-coral',
    terms: 'Min booking ₹400. Refreshes every day at midnight IST.',
    cta: 'Grab today\'s deal',
    rule: { type: 'dailyFlash' },
    schedule: { always: true },
    validity: 'daily'
  },
  {
    id: 'tatkal-saver',
    category: 'train',
    codePrefix: 'TATKAL',
    badge: 'Tatkal',
    title: '10% OFF',
    subtitle: 'On Tatkal train bookings',
    gradient: 'offer-card-orange',
    terms: 'Max discount ₹250. Tatkal quota only.',
    cta: 'Grab deal',
    rule: { type: 'percent', rate: 0.1, max: 250 },
    schedule: { daysOfWeek: [1, 2, 3, 4, 5] },
    validity: 'weekly'
  },
  {
    id: 'sleeper-deal',
    category: 'train',
    codePrefix: 'SLRAIL',
    badge: 'Sleeper',
    title: '₹75 OFF',
    subtitle: 'Sleeper (SL) class journeys',
    gradient: 'offer-card-blue',
    terms: 'Applicable on SL class only. Min fare ₹300.',
    cta: 'Use code',
    rule: { type: 'flat', amount: 75, minTotal: 300, classIn: ['SL'] },
    schedule: { daysOfWeek: [1, 2, 3] },
    validity: 'weekly'
  },
  {
    id: 'hdfc-bank',
    category: 'bank',
    codePrefix: 'HDFC',
    badge: 'HDFC Bank',
    title: '5% Instant OFF',
    subtitle: 'With HDFC credit & debit cards',
    gradient: 'offer-card-indigo',
    terms: 'Max discount ₹300 per transaction.',
    cta: 'View offer',
    rule: { type: 'percent', rate: 0.05, max: 300, paymentMethod: 'card' },
    schedule: { daysOfWeek: [1, 3, 5] },
    validity: 'weekly'
  },
  {
    id: 'icici-bank',
    category: 'bank',
    codePrefix: 'ICICI',
    badge: 'ICICI Bank',
    title: '₹200 OFF',
    subtitle: 'On AC class bookings',
    gradient: 'offer-card-purple',
    terms: 'Valid on 1A, 2A, 3A & CC classes.',
    cta: 'Apply now',
    rule: { type: 'flat', amount: 200, classIn: AC_CLASSES },
    schedule: { daysOfWeek: [2, 4, 6] },
    validity: 'weekly'
  },
  {
    id: 'upi-cashback',
    category: 'payment',
    codePrefix: 'UPI',
    badge: 'UPI',
    title: '₹100 Cashback',
    subtitle: 'Pay via UPI at checkout',
    gradient: 'offer-card-green',
    terms: 'Cashback credited within 7 working days.',
    cta: 'Pay with UPI',
    rule: { type: 'flat', amount: 100, paymentMethod: 'upi' },
    schedule: { always: true },
    validity: 'daily'
  },
  {
    id: 'weekend-rush',
    category: 'train',
    codePrefix: 'WEEKEND',
    badge: 'Weekend',
    title: '8% OFF',
    subtitle: 'Friday–Sunday departures',
    gradient: 'offer-card-coral',
    terms: 'Max discount ₹400. General quota only.',
    cta: 'Plan trip',
    rule: { type: 'percent', rate: 0.08, max: 400, journeyDayIn: [0, 5, 6] },
    schedule: { daysOfWeek: [5, 6, 0] },
    validity: 'weekly'
  },
  {
    id: 'ac-upgrade',
    category: 'train',
    codePrefix: 'ACSAVE',
    badge: 'AC Special',
    title: '₹200 OFF',
    subtitle: 'AC 3 Tier & Chair Car',
    gradient: 'offer-card-navy',
    terms: 'Valid on 3A & CC. Cannot combine with other codes.',
    cta: 'Book AC',
    rule: { type: 'flat', amount: 200, classIn: ['3A', 'CC'] },
    schedule: { daysOfWeek: [2, 3, 4] },
    validity: 'weekly'
  },
  {
    id: 'axis-bank',
    category: 'bank',
    codePrefix: 'AXIS',
    badge: 'Axis Bank',
    title: '₹150 OFF',
    subtitle: 'Net banking & debit cards',
    gradient: 'offer-card-indigo',
    terms: 'Min booking ₹600. Max once per day.',
    cta: 'Pay now',
    rule: { type: 'flat', amount: 150, minTotal: 600, paymentMethod: 'netbanking' },
    schedule: { daysOfWeek: [0, 6] },
    validity: 'weekly'
  }
];

const BANK_PARTNERS = [
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'PhonePe UPI',
  'Google Pay',
  'Paytm UPI'
];

module.exports = {
  OFFER_CATEGORIES,
  OFFER_TEMPLATES,
  AC_CLASSES,
  BANK_PARTNERS
};
