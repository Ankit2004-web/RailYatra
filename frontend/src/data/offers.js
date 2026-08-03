export const OFFER_CATEGORIES = [
  { id: 'all', label: 'All Offers' },
  { id: 'train', label: 'Train Deals' },
  { id: 'bank', label: 'Bank Offers' },
  { id: 'payment', label: 'UPI & Wallet' },
  { id: 'new', label: 'New User' }
];

export const OFFERS = [
  {
    id: 'first-booking',
    category: 'new',
    code: 'RAILFIRST150',
    badge: 'New User',
    title: 'Flat ₹150 OFF',
    subtitle: 'On your first train booking',
    validTill: '31 Aug 2026',
    gradient: 'offer-card-teal',
    terms: 'Min booking ₹500. Valid once per account.',
    cta: 'Book now'
  },
  {
    id: 'tatkal-saver',
    category: 'train',
    code: 'TATKAL10',
    badge: 'Tatkal',
    title: '10% OFF',
    subtitle: 'On Tatkal train bookings',
    validTill: '15 Sep 2026',
    gradient: 'offer-card-orange',
    terms: 'Max discount ₹250. Tatkal quota only.',
    cta: 'Grab deal'
  },
  {
    id: 'sleeper-deal',
    category: 'train',
    code: 'SLRAIL75',
    badge: 'Sleeper',
    title: '₹75 OFF',
    subtitle: 'Sleeper (SL) class journeys',
    validTill: '30 Sep 2026',
    gradient: 'offer-card-blue',
    terms: 'Applicable on SL class only. Min fare ₹300.',
    cta: 'Use code'
  },
  {
    id: 'hdfc-bank',
    category: 'bank',
    code: 'HDFCRAIL',
    badge: 'HDFC Bank',
    title: '5% Instant OFF',
    subtitle: 'With HDFC credit & debit cards',
    validTill: '31 Dec 2026',
    gradient: 'offer-card-indigo',
    terms: 'Max discount ₹300 per transaction.',
    cta: 'View offer'
  },
  {
    id: 'icici-bank',
    category: 'bank',
    code: 'ICICIRAIL',
    badge: 'ICICI Bank',
    title: '₹200 OFF',
    subtitle: 'On AC class bookings',
    validTill: '30 Nov 2026',
    gradient: 'offer-card-purple',
    terms: 'Valid on 1A, 2A, 3A & CC classes.',
    cta: 'Apply now'
  },
  {
    id: 'upi-cashback',
    category: 'payment',
    code: 'UPIRAIL100',
    badge: 'UPI',
    title: '₹100 Cashback',
    subtitle: 'Pay via UPI at checkout',
    validTill: '31 Oct 2026',
    gradient: 'offer-card-green',
    terms: 'Cashback credited within 7 working days.',
    cta: 'Pay with UPI'
  },
  {
    id: 'weekend-rush',
    category: 'train',
    code: 'WEEKEND8',
    badge: 'Weekend',
    title: '8% OFF',
    subtitle: 'Friday–Sunday departures',
    validTill: '31 Dec 2026',
    gradient: 'offer-card-coral',
    terms: 'Max discount ₹400. General quota only.',
    cta: 'Plan trip'
  },
  {
    id: 'ac-upgrade',
    category: 'train',
    code: 'ACSAVE200',
    badge: 'AC Special',
    title: '₹200 OFF',
    subtitle: 'AC 3 Tier & Chair Car',
    validTill: '30 Sep 2026',
    gradient: 'offer-card-navy',
    terms: 'Valid on 3A & CC. Cannot combine with other codes.',
    cta: 'Book AC'
  }
];
