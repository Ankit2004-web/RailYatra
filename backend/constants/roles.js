const ROLES = {
    PASSENGER: 'passenger',
    ADMIN: 'admin',
    BOOKING_AGENT: 'booking_agent',
    TTE: 'tte',
    STATION_MASTER: 'station_master',
    RAILWAY_STAFF: 'railway_staff',
    CUSTOMER_SUPPORT: 'customer_support',
    FINANCE: 'finance'
};

const ALL_ROLES = Object.values(ROLES);

const STAFF_ROLES = [
    ROLES.ADMIN,
    ROLES.BOOKING_AGENT,
    ROLES.TTE,
    ROLES.STATION_MASTER,
    ROLES.RAILWAY_STAFF,
    ROLES.CUSTOMER_SUPPORT,
    ROLES.FINANCE
];

const ROLE_MODULES = {
    [ROLES.PASSENGER]: ['home', 'search', 'book', 'bookings', 'pnr', 'profile', 'live_train', 'support', 'cancel'],
    [ROLES.ADMIN]: ['admin_dashboard', 'trains', 'stations', 'users', 'bookings', 'reports', 'waitlist', 'master_data', 'audit'],
    [ROLES.BOOKING_AGENT]: ['agent_bookings', 'search', 'book', 'pnr', 'passenger_lookup'],
    [ROLES.TTE]: ['train_manifest', 'pnr_verify', 'coach_chart', 'live_train'],
    [ROLES.STATION_MASTER]: ['station_ops', 'platform_info', 'live_train', 'chart_status'],
    [ROLES.RAILWAY_STAFF]: ['train_ops', 'coach_maintenance', 'reports_read'],
    [ROLES.CUSTOMER_SUPPORT]: ['support_tickets', 'booking_lookup', 'refund_assist', 'faq'],
    [ROLES.FINANCE]: ['revenue_reports', 'refunds', 'payment_history', 'reconciliation']
};

const resolveRole = (user) => {
    if (!user) return ROLES.PASSENGER;
    if (user.role && ALL_ROLES.includes(user.role)) return user.role;
    if (user.isAdmin) return ROLES.ADMIN;
    return ROLES.PASSENGER;
};

const roleHasModule = (role, module) => {
    const modules = ROLE_MODULES[role] || ROLE_MODULES[ROLES.PASSENGER];
    return modules.includes(module) || modules.includes('*');
};

module.exports = {
    ROLES,
    ALL_ROLES,
    STAFF_ROLES,
    ROLE_MODULES,
    resolveRole,
    roleHasModule
};
