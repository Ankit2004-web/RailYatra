CREATE TABLE IF NOT EXISTS DataImportSources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sourceName TEXT NOT NULL,
    sourceUrl TEXT,
    publisher TEXT,
    datasetVersion TEXT,
    licenseNotes TEXT,
    downloadedAt TEXT,
    importedAt TEXT NOT NULL DEFAULT (datetime('now')),
    fileHash TEXT,
    recordCount INTEGER,
    status TEXT NOT NULL DEFAULT 'Completed',
    notes TEXT
);

CREATE TABLE IF NOT EXISTS States (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT,
    name TEXT NOT NULL UNIQUE,
    isUnionTerritory INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS RailwayZones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    headquarters TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS TrainTypes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS TravelClasses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS Quotas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS TrainRunningDays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trainId INTEGER NOT NULL,
    dayOfWeek INTEGER NOT NULL,
    runs INTEGER NOT NULL DEFAULT 1,
    UNIQUE (trainId, dayOfWeek)
);

INSERT OR IGNORE INTO TrainTypes (code, name, description) VALUES
    ('RAJ', 'Rajdhani', 'Rajdhani Express'),
    ('SHAT', 'Shatabdi', 'Shatabdi Express'),
    ('DUR', 'Duronto', 'Duronto Express'),
    ('VB', 'Vande Bharat', 'Vande Bharat Express'),
    ('SF', 'Superfast', 'Superfast Express'),
    ('EXP', 'Express', 'Express train'),
    ('PASS', 'Passenger', 'Passenger train');

INSERT OR IGNORE INTO TravelClasses (code, name, description) VALUES
    ('1A', 'AC First Class', 'First AC'),
    ('2A', 'AC 2 Tier', 'Second AC'),
    ('3A', 'AC 3 Tier', 'Third AC'),
    ('3E', 'AC 3 Economy', 'AC 3-tier economy'),
    ('EA', 'Anubhuthi', 'AC chair car with entertainment'),
    ('SL', 'Sleeper', 'Sleeper Class'),
    ('CC', 'Chair Car', 'AC Chair Car'),
    ('EC', 'Executive Chair', 'Executive Chair Car'),
    ('2S', 'Second Sitting', 'Second Sitting'),
    ('GS', 'General', 'Unreserved / General');

INSERT OR IGNORE INTO Quotas (code, name, description) VALUES
    ('GN', 'General', 'General quota'),
    ('TQ', 'Tatkal', 'Tatkal quota'),
    ('LD', 'Ladies', 'Ladies quota'),
    ('SS', 'Senior Citizen', 'Senior citizen quota');
