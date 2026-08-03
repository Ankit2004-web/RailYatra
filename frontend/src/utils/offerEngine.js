import { OFFERS } from '../data/offers';

const AC_CLASSES = ['1A', '2A', '3A', 'CC'];

export function findOfferByCode(code) {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  return OFFERS.find((o) => o.code === normalized) || null;
}

export function calculateOfferDiscount(offer, { total, classCode, journeyDate, paymentMethod }) {
  if (!offer || !total) return 0;

  switch (offer.code) {
    case 'RAILFIRST150':
      return total >= 500 ? 150 : 0;
    case 'TATKAL10':
      return Math.min(Math.round(total * 0.1), 250);
    case 'SLRAIL75':
      return classCode === 'SL' && total >= 300 ? 75 : 0;
    case 'HDFCRAIL':
      return paymentMethod === 'card'
        ? Math.min(Math.round(total * 0.05), 300)
        : 0;
    case 'ICICIRAIL':
      return AC_CLASSES.includes(classCode) ? 200 : 0;
    case 'UPIRAIL100':
      return paymentMethod === 'upi' ? 100 : 0;
    case 'WEEKEND8': {
      if (!journeyDate) return 0;
      const day = new Date(`${journeyDate}T00:00:00`).getDay();
      if (day === 0 || day === 5 || day === 6) {
        return Math.min(Math.round(total * 0.08), 400);
      }
      return 0;
    }
    case 'ACSAVE200':
      return ['3A', 'CC'].includes(classCode) ? 200 : 0;
    default:
      return 0;
  }
}

function getRecommendationReason(offer, ctx) {
  const savings = calculateOfferDiscount(offer, ctx);
  if (savings <= 0) return null;

  switch (offer.code) {
    case 'RAILFIRST150':
      return 'Best for first-time bookings over ₹500';
    case 'SLRAIL75':
      return `Save ₹${savings} on your Sleeper booking`;
    case 'ICICIRAIL':
    case 'ACSAVE200':
      return `Recommended for ${ctx.classCode} class`;
    case 'UPIRAIL100':
      return 'Switch to UPI payment to unlock this offer';
    case 'HDFCRAIL':
      return 'Pay with HDFC card for instant discount';
    case 'WEEKEND8':
      return 'Weekend journey — extra savings available';
    default:
      return `Save up to ₹${savings} with ${offer.code}`;
  }
}

export function getRecommendedOffers(ctx, limit = 3) {
  return OFFERS
    .map((offer) => {
      const savings = calculateOfferDiscount(offer, ctx);
      const reason = getRecommendationReason(offer, ctx);
      return { offer, savings, reason };
    })
    .filter((item) => item.savings > 0)
    .sort((a, b) => b.savings - a.savings)
    .slice(0, limit);
}

export function getAppliedOfferDetails(code, ctx) {
  const offer = findOfferByCode(code);
  if (!offer) {
    return { offer: null, savings: 0, error: 'Invalid or expired coupon code' };
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
