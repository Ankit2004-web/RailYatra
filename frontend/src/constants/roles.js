export const ROLES = {
  PASSENGER: 'passenger',
  ADMIN: 'admin',
  BOOKING_AGENT: 'booking_agent',
  TTE: 'tte',
  STATION_MASTER: 'station_master',
  RAILWAY_STAFF: 'railway_staff',
  CUSTOMER_SUPPORT: 'customer_support',
  FINANCE: 'finance'
};

export const ROLE_LABELS = {
  passenger: 'Passenger',
  admin: 'Administrator',
  booking_agent: 'Booking Agent',
  tte: 'Ticket Examiner (TTE)',
  station_master: 'Station Master',
  railway_staff: 'Railway Staff',
  customer_support: 'Customer Support',
  finance: 'Finance / Accounts'
};

export function resolveRole(user) {
  if (!user) return ROLES.PASSENGER;
  if (user.role) return user.role;
  if (user.isAdmin) return ROLES.ADMIN;
  return ROLES.PASSENGER;
}

export function isStaffRole(role) {
  return role && role !== ROLES.PASSENGER;
}

export function getPortalPath(role) {
  if (role === ROLES.ADMIN) return '/admin';
  if (isStaffRole(role)) return '/portal';
  return '/home';
}
