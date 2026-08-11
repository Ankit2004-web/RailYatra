const { OFFER_TEMPLATES, OFFER_CATEGORIES, BANK_PARTNERS } = require('./templates');

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function toIstDate(input = new Date()) {
  const d = input instanceof Date ? input : new Date(input);
  return new Date(d.getTime() + IST_OFFSET_MS);
}

function istDateKey(input = new Date()) {
  const ist = toIstDate(input);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const day = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function istDayOfWeek(input = new Date()) {
  return toIstDate(input).getUTCDay();
}

function formatDisplayDate(input = new Date()) {
  const ist = toIstDate(input);
  return ist.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

function endOfIstDayIso(input = new Date()) {
  const ist = toIstDate(input);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  const d = ist.getUTCDate();
  const endUtc = Date.UTC(y, m, d, 23, 59, 59) - IST_OFFSET_MS;
  return new Date(endUtc).toISOString();
}

function endOfIstWeekLabel(input = new Date()) {
  const dow = istDayOfWeek(input);
  const daysUntilSunday = (7 - dow) % 7;
  const ist = toIstDate(input);
  ist.setUTCDate(ist.getUTCDate() + daysUntilSunday);
  return formatDisplayDate(ist);
}

function dailyCodeSuffix(input = new Date()) {
  const ist = toIstDate(input);
  const dd = String(ist.getUTCDate()).padStart(2, '0');
  const mm = String(ist.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}${mm}`;
}

function hashDaySeed(dateKey, salt = '') {
  let hash = 0;
  const str = `${dateKey}:${salt}`;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function isScheduledFor(template, input = new Date()) {
  const schedule = template.schedule || { always: true };
  if (schedule.always) return true;
  const dow = istDayOfWeek(input);
  if (schedule.daysOfWeek?.length) {
    return schedule.daysOfWeek.includes(dow);
  }
  return true;
}

function buildDailyFlashRule(input = new Date()) {
  const dow = istDayOfWeek(input);
  const tiers = [
    { amount: 120, minTotal: 400, title: '₹120 OFF', subtitle: 'Monday starter fare cut' },
    { amount: 150, minTotal: 450, title: '₹150 OFF', subtitle: 'Tuesday travel saver' },
    { amount: 175, minTotal: 500, title: '₹175 OFF', subtitle: 'Midweek booking bonus' },
    { amount: 200, minTotal: 550, title: '₹200 OFF', subtitle: 'Thursday flash fare' },
    { amount: 250, minTotal: 600, title: '₹250 OFF', subtitle: 'Friday getaway deal' },
    { amount: 300, minTotal: 650, title: '₹300 OFF', subtitle: 'Weekend special discount' },
    { amount: 280, minTotal: 650, title: '₹280 OFF', subtitle: 'Sunday family saver' }
  ];
  const tier = tiers[dow] || tiers[0];
  return {
    type: 'flat',
    amount: tier.amount,
    minTotal: tier.minTotal,
    displayTitle: tier.title,
    displaySubtitle: tier.subtitle
  };
}

function validityLabel(template, input = new Date()) {
  switch (template.validity) {
    case 'daily':
      return `Today only · ${formatDisplayDate(input)}`;
    case 'weekly':
      return `Valid till ${endOfIstWeekLabel(input)}`;
    default:
      return 'Always available for eligible bookings';
  }
}

function materializeOffer(template, input = new Date(), { featured = false } = {}) {
  const dateKey = istDateKey(input);
  const suffix = dailyCodeSuffix(input);
  const code = template.validity === 'always'
    ? `${template.codePrefix}150`
    : `${template.codePrefix}${suffix}`;

  let rule = { ...template.rule };
  let title = template.title;
  let subtitle = template.subtitle;

  if (template.rule?.type === 'dailyFlash') {
    const flash = buildDailyFlashRule(input);
    rule = { type: 'flat', amount: flash.amount, minTotal: flash.minTotal };
    title = flash.displayTitle;
    subtitle = flash.displaySubtitle;
  }

  return {
    id: template.id,
    category: template.category,
    code,
    badge: featured ? `${template.badge} · Today` : template.badge,
    title,
    subtitle,
    validTill: validityLabel(template, input),
    validUntil: template.validity === 'daily' ? endOfIstDayIso(input) : null,
    gradient: template.gradient,
    terms: template.terms,
    cta: template.cta,
    rule,
    featured,
    refreshedFor: dateKey
  };
}

function getActiveOffers(input = new Date()) {
  const dateKey = istDateKey(input);
  const active = OFFER_TEMPLATES
    .filter((t) => isScheduledFor(t, input))
    .map((t) => materializeOffer(t, input));

  const spotlightIdx = hashDaySeed(dateKey, 'spotlight') % active.length;
  active.forEach((o, idx) => {
    o.featured = idx === spotlightIdx || o.id === 'daily-flash';
  });
  if (active[spotlightIdx]) active[spotlightIdx].featured = true;

  return active.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
}

function getOffersPayload(input = new Date()) {
  const dateKey = istDateKey(input);
  const offers = getActiveOffers(input);
  const partnerOffset = hashDaySeed(dateKey, 'banks') % BANK_PARTNERS.length;
  const bankPartners = [
    ...BANK_PARTNERS.slice(partnerOffset),
    ...BANK_PARTNERS.slice(0, partnerOffset)
  ];

  return {
    mode: 'daily',
    refreshedAt: new Date().toISOString(),
    refreshedFor: dateKey,
    refreshedLabel: formatDisplayDate(input),
    totalActive: offers.length,
    categories: OFFER_CATEGORIES,
    bankPartners,
    offers
  };
}

function findOfferByCode(code, input = new Date()) {
  if (!code) return null;
  const normalized = String(code).trim().toUpperCase();
  const offers = getActiveOffers(input);
  return offers.find((o) => o.code === normalized) || null;
}

function calculateOfferDiscount(offer, ctx = {}) {
  if (!offer?.rule || !ctx.total) return 0;
  const { total, classCode, journeyDate, paymentMethod } = ctx;
  const rule = offer.rule;

  if (rule.minTotal && total < rule.minTotal) return 0;
  if (rule.classIn?.length && !rule.classIn.includes(classCode)) return 0;
  if (rule.paymentMethod && paymentMethod !== rule.paymentMethod) return 0;

  if (rule.journeyDayIn?.length) {
    if (!journeyDate) return 0;
    const day = new Date(`${journeyDate}T00:00:00`).getDay();
    if (!rule.journeyDayIn.includes(day)) return 0;
  }

  if (rule.type === 'flat') return rule.amount || 0;
  if (rule.type === 'percent') {
    return Math.min(Math.round(total * (rule.rate || 0)), rule.max || Infinity);
  }
  return 0;
}

function getRecommendationReason(offer, ctx) {
  const savings = calculateOfferDiscount(offer, ctx);
  if (savings <= 0) return null;

  if (offer.id === 'first-booking') return 'Best for first-time bookings over ₹500';
  if (offer.id === 'daily-flash') return `Today\'s flash deal — save ₹${savings}`;
  if (offer.id === 'sleeper-deal') return `Save ₹${savings} on your Sleeper booking`;
  if (offer.id === 'icici-bank' || offer.id === 'ac-upgrade') return `Recommended for ${ctx.classCode} class`;
  if (offer.id === 'upi-cashback') return 'Switch to UPI payment to unlock this offer';
  if (offer.id === 'hdfc-bank') return 'Pay with HDFC card for instant discount';
  if (offer.id === 'weekend-rush') return 'Weekend journey — extra savings available';
  if (offer.id === 'axis-bank') return 'Use net banking for instant savings';
  return `Save up to ₹${savings} with ${offer.code}`;
}

function getRecommendedOffers(ctx, limit = 3, input = new Date()) {
  return getActiveOffers(input)
    .map((offer) => {
      const savings = calculateOfferDiscount(offer, ctx);
      const reason = getRecommendationReason(offer, ctx);
      return { offer, savings, reason };
    })
    .filter((item) => item.savings > 0)
    .sort((a, b) => b.savings - a.savings)
    .slice(0, limit);
}

function getAppliedOfferDetails(code, ctx, input = new Date()) {
  const offer = findOfferByCode(code, input);
  if (!offer) {
    return { offer: null, savings: 0, error: 'Invalid or expired coupon code' };
  }

  if (offer.validUntil && new Date() > new Date(offer.validUntil)) {
    return { offer, savings: 0, error: 'This offer expired today — check Offers for fresh codes' };
  }

  const savings = calculateOfferDiscount(offer, ctx);
  if (savings <= 0) {
    return {
      offer,
      savings: 0,
      error: 'This offer is not applicable to your current booking'
    };
  }

  return { offer, savings, error: null };
}

module.exports = {
  getOffersPayload,
  getActiveOffers,
  findOfferByCode,
  calculateOfferDiscount,
  getRecommendedOffers,
  getAppliedOfferDetails,
  istDateKey,
  formatDisplayDate
};
