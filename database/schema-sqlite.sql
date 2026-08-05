-- RailYatra SQLite schema (cloud demo — $0 hosting on Render)

CREATE TABLE IF NOT EXISTS Users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    phone TEXT NOT NULL,
    isAdmin INTEGER NOT NULL DEFAULT 0,
    isBlocked INTEGER NOT NULL DEFAULT 0,
    avatarUrl TEXT,
    theme TEXT NOT NULL DEFAULT 'light',
    role TEXT NOT NULL DEFAULT 'passenger',
    mfaEnabled INTEGER NOT NULL DEFAULT 0,
    mfaSecret TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Stations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    normalizedName TEXT,
    isActive INTEGER NOT NULL DEFAULT 1,
    stateId INTEGER,
    zoneId INTEGER,
    latitude REAL,
    longitude REAL,
    dataSourceId INTEGER,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Trains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trainNumber TEXT NOT NULL UNIQUE,
    trainName TEXT NOT NULL,
    source TEXT NOT NULL,
    destination TEXT NOT NULL,
    departureTime TEXT NOT NULL,
    arrivalTime TEXT NOT NULL,
    duration TEXT NOT NULL,
    distance INTEGER NOT NULL,
    availableSeats INTEGER NOT NULL DEFAULT 100,
    price REAL NOT NULL,
    journeyDate TEXT NOT NULL,
    runningDays TEXT NOT NULL DEFAULT 'Daily',
    runningStatus TEXT NOT NULL DEFAULT 'Running',
    normalizedName TEXT,
    isActive INTEGER NOT NULL DEFAULT 1,
    trainTypeId INTEGER,
    sourceStationId INTEGER,
    destinationStationId INTEGER,
    dataSourceId INTEGER,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS TrainClasses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trainId INTEGER NOT NULL,
    classCode TEXT NOT NULL,
    className TEXT NOT NULL,
    price REAL NOT NULL,
    totalSeats INTEGER NOT NULL,
    availableSeats INTEGER NOT NULL,
    travelClassId INTEGER,
    isAvailable INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (trainId, classCode)
);

CREATE TABLE IF NOT EXISTS Bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    trainId INTEGER NOT NULL,
    totalPrice REAL NOT NULL,
    seatNumbers TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'Confirmed',
    journeyDate TEXT NOT NULL,
    pnrNumber TEXT NOT NULL UNIQUE,
    classCode TEXT,
    bookingType TEXT NOT NULL DEFAULT 'General',
    paymentStatus TEXT NOT NULL DEFAULT 'Pending',
    waitlistPosition INTEGER,
    quota TEXT NOT NULL DEFAULT 'General',
    grandTotal REAL,
    paymentBreakdown TEXT,
    fromStationId INTEGER,
    toStationId INTEGER,
    bookingDate TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Passengers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bookingId INTEGER NOT NULL,
    name TEXT NOT NULL,
    age INTEGER NOT NULL,
    gender TEXT NOT NULL,
    berthPreference TEXT,
    passengerStatus TEXT NOT NULL DEFAULT 'Confirmed'
);

CREATE TABLE IF NOT EXISTS PasswordResetTokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expiresAt TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Seats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trainId INTEGER NOT NULL,
    classCode TEXT NOT NULL,
    seatNumber INTEGER NOT NULL,
    berthType TEXT NOT NULL DEFAULT 'SEAT',
    journeyDate TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Available',
    bookingId INTEGER,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (trainId, classCode, seatNumber, journeyDate)
);

CREATE TABLE IF NOT EXISTS Payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bookingId INTEGER NOT NULL,
    razorpayOrderId TEXT,
    razorpayPaymentId TEXT,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'Pending',
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Refunds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bookingId INTEGER NOT NULL UNIQUE,
    originalAmount REAL NOT NULL,
    refundAmount REAL NOT NULL,
    refundPercent REAL NOT NULL,
    cancellationCharge REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Processed',
    reason TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS TrainStops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trainId INTEGER NOT NULL,
    stationId INTEGER,
    stationCode TEXT,
    stationName TEXT NOT NULL,
    stopOrder INTEGER NOT NULL,
    arrivalTime TEXT,
    departureTime TEXT,
    arrivalDayOffset INTEGER NOT NULL DEFAULT 0,
    departureDayOffset INTEGER NOT NULL DEFAULT 0,
    haltMinutes INTEGER NOT NULL DEFAULT 0,
    distanceKm INTEGER,
    platformHint TEXT,
    isTechnicalStop INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (trainId, stopOrder)
);

CREATE TABLE IF NOT EXISTS SavedPassengers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    name TEXT NOT NULL,
    age INTEGER NOT NULL,
    gender TEXT NOT NULL,
    berthPreference TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    isRead INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS SupportTickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    subject TEXT NOT NULL,
    category TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Open',
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS SupportChatMessages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    sessionId TEXT NOT NULL,
    sender TEXT NOT NULL,
    message TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS AuditLogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    action TEXT NOT NULL,
    resource TEXT,
    details TEXT,
    ipAddress TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS UserDevices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    deviceLabel TEXT NOT NULL,
    userAgent TEXT,
    lastSeenAt TEXT NOT NULL DEFAULT (datetime('now')),
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS FavoriteRoutes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    sourceCode TEXT NOT NULL,
    destinationCode TEXT NOT NULL,
    label TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS UserPreferences (
    userId INTEGER PRIMARY KEY,
    notifyBooking INTEGER NOT NULL DEFAULT 1,
    notifyRefund INTEGER NOT NULL DEFAULT 1,
    notifyDelay INTEGER NOT NULL DEFAULT 1,
    notifyChart INTEGER NOT NULL DEFAULT 1,
    gstNumber TEXT,
    gstBusinessName TEXT,
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS SearchCache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cacheKey TEXT NOT NULL UNIQUE,
    payload TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS IdempotencyKeys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idempotencyKey TEXT NOT NULL UNIQUE,
    response TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS OutboxEvents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    aggregateType TEXT NOT NULL,
    aggregateId TEXT NOT NULL,
    eventType TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS OtpCodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    otpHash TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS UserLoyalty (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL UNIQUE,
    points INTEGER NOT NULL DEFAULT 0,
    tier TEXT NOT NULL DEFAULT 'Silver',
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
