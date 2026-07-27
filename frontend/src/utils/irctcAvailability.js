/** IRCTC-style availability labels for search & class selection */

export function formatIrctcAvailability(seats, { waitlist = 0, rac = 0 } = {}) {
  if (seats == null) {
    return { text: '—', shortText: '—', tone: 'unknown' };
  }
  if (seats <= 0 && rac > 0) {
    return { text: `RAC ${rac}`, shortText: `RAC ${rac}`, tone: 'rac' };
  }
  if (seats <= 0 && waitlist > 0) {
    return { text: `WL#${waitlist}`, shortText: `WL#${waitlist}`, tone: 'waitlist' };
  }
  if (seats <= 0) {
    return { text: 'REGRET', shortText: 'REGRET', tone: 'regret' };
  }
  const padded = String(seats).padStart(4, '0');
  return {
    text: `AVAILABLE-${padded}`,
    shortText: `AVL ${seats}`,
    tone: 'available'
  };
}

export function irctcAvailabilityClass(tone) {
  return `irctc-avl irctc-avl-${tone}`;
}
