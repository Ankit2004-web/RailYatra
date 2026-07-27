-- Railway master-data schema extension (Category A — static timetable/master data)
-- Applied after schema.sql. Preserves legacy columns for backward compatibility.

-- ============================================================
-- DATA PROVENANCE
-- ============================================================
IF OBJECT_ID('dbo.DataImportSources', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DataImportSources (
        id INT IDENTITY(1,1) PRIMARY KEY,
        sourceName NVARCHAR(200) NOT NULL,
        sourceUrl NVARCHAR(500) NULL,
        publisher NVARCHAR(200) NULL,
        datasetVersion NVARCHAR(50) NULL,
        licenseNotes NVARCHAR(500) NULL,
        downloadedAt DATETIME2 NULL,
        importedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        fileHash NVARCHAR(128) NULL,
        recordCount INT NULL,
        status NVARCHAR(30) NOT NULL DEFAULT 'Completed',
        notes NVARCHAR(MAX) NULL
    );
END
GO

-- ============================================================
-- GEO / ZONES
-- ============================================================
IF OBJECT_ID('dbo.States', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.States (
        id INT IDENTITY(1,1) PRIMARY KEY,
        code NVARCHAR(10) NULL,
        name NVARCHAR(100) NOT NULL,
        isUnionTerritory BIT NOT NULL DEFAULT 0,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_States_Name UNIQUE (name)
    );
END
GO

IF OBJECT_ID('dbo.Cities', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Cities (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(100) NOT NULL,
        stateId INT NOT NULL,
        latitude DECIMAL(9,6) NULL,
        longitude DECIMAL(9,6) NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Cities_States FOREIGN KEY (stateId) REFERENCES dbo.States(id)
    );
    CREATE INDEX IX_Cities_StateId ON dbo.Cities(stateId);
    CREATE INDEX IX_Cities_Name ON dbo.Cities(name);
END
GO

IF OBJECT_ID('dbo.RailwayZones', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.RailwayZones (
        id INT IDENTITY(1,1) PRIMARY KEY,
        code NVARCHAR(10) NOT NULL,
        name NVARCHAR(100) NOT NULL,
        headquarters NVARCHAR(100) NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_RailwayZones_Code UNIQUE (code)
    );
END
GO

-- ============================================================
-- STATIONS — extend legacy table
-- ============================================================
IF COL_LENGTH('dbo.Stations', 'normalizedName') IS NULL
    ALTER TABLE dbo.Stations ADD normalizedName NVARCHAR(100) NULL;
GO
IF COL_LENGTH('dbo.Stations', 'cityId') IS NULL
    ALTER TABLE dbo.Stations ADD cityId INT NULL;
GO
IF COL_LENGTH('dbo.Stations', 'stateId') IS NULL
    ALTER TABLE dbo.Stations ADD stateId INT NULL;
GO
IF COL_LENGTH('dbo.Stations', 'zoneId') IS NULL
    ALTER TABLE dbo.Stations ADD zoneId INT NULL;
GO
IF COL_LENGTH('dbo.Stations', 'latitude') IS NULL
    ALTER TABLE dbo.Stations ADD latitude DECIMAL(9,6) NULL;
GO
IF COL_LENGTH('dbo.Stations', 'longitude') IS NULL
    ALTER TABLE dbo.Stations ADD longitude DECIMAL(9,6) NULL;
GO
IF COL_LENGTH('dbo.Stations', 'elevation') IS NULL
    ALTER TABLE dbo.Stations ADD elevation INT NULL;
GO
IF COL_LENGTH('dbo.Stations', 'isJunction') IS NULL
    ALTER TABLE dbo.Stations ADD isJunction BIT NOT NULL DEFAULT 0;
GO
IF COL_LENGTH('dbo.Stations', 'isActive') IS NULL
    ALTER TABLE dbo.Stations ADD isActive BIT NOT NULL DEFAULT 1;
GO
IF COL_LENGTH('dbo.Stations', 'dataSourceId') IS NULL
    ALTER TABLE dbo.Stations ADD dataSourceId INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Stations_NormalizedName' AND object_id = OBJECT_ID('dbo.Stations'))
    CREATE INDEX IX_Stations_NormalizedName ON dbo.Stations(normalizedName);
GO

-- ============================================================
-- TRAIN TYPES & TRAVEL CLASSES
-- ============================================================
IF OBJECT_ID('dbo.TrainTypes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TrainTypes (
        id INT IDENTITY(1,1) PRIMARY KEY,
        code NVARCHAR(20) NOT NULL,
        name NVARCHAR(80) NOT NULL,
        description NVARCHAR(255) NULL,
        CONSTRAINT UQ_TrainTypes_Code UNIQUE (code)
    );
END
GO

IF OBJECT_ID('dbo.TravelClasses', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TravelClasses (
        id INT IDENTITY(1,1) PRIMARY KEY,
        code NVARCHAR(5) NOT NULL,
        name NVARCHAR(50) NOT NULL,
        description NVARCHAR(255) NULL,
        CONSTRAINT UQ_TravelClasses_Code UNIQUE (code)
    );
END
GO

IF OBJECT_ID('dbo.Quotas', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Quotas (
        id INT IDENTITY(1,1) PRIMARY KEY,
        code NVARCHAR(10) NOT NULL,
        name NVARCHAR(50) NOT NULL,
        description NVARCHAR(255) NULL,
        CONSTRAINT UQ_Quotas_Code UNIQUE (code)
    );
END
GO

-- ============================================================
-- TRAINS — extend legacy table
-- ============================================================
IF COL_LENGTH('dbo.Trains', 'normalizedName') IS NULL
    ALTER TABLE dbo.Trains ADD normalizedName NVARCHAR(100) NULL;
GO
IF COL_LENGTH('dbo.Trains', 'trainTypeId') IS NULL
    ALTER TABLE dbo.Trains ADD trainTypeId INT NULL;
GO
IF COL_LENGTH('dbo.Trains', 'sourceStationId') IS NULL
    ALTER TABLE dbo.Trains ADD sourceStationId INT NULL;
GO
IF COL_LENGTH('dbo.Trains', 'destinationStationId') IS NULL
    ALTER TABLE dbo.Trains ADD destinationStationId INT NULL;
GO
IF COL_LENGTH('dbo.Trains', 'isActive') IS NULL
    ALTER TABLE dbo.Trains ADD isActive BIT NOT NULL DEFAULT 1;
GO
IF COL_LENGTH('dbo.Trains', 'dataSourceId') IS NULL
    ALTER TABLE dbo.Trains ADD dataSourceId INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Trains_NormalizedName' AND object_id = OBJECT_ID('dbo.Trains'))
    CREATE INDEX IX_Trains_NormalizedName ON dbo.Trains(normalizedName);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Trains_SourceStationId' AND object_id = OBJECT_ID('dbo.Trains'))
    CREATE INDEX IX_Trains_SourceStationId ON dbo.Trains(sourceStationId);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Trains_DestinationStationId' AND object_id = OBJECT_ID('dbo.Trains'))
    CREATE INDEX IX_Trains_DestinationStationId ON dbo.Trains(destinationStationId);
GO

-- ============================================================
-- TRAIN RUNNING DAYS (normalized)
-- ============================================================
IF OBJECT_ID('dbo.TrainRunningDays', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TrainRunningDays (
        id INT IDENTITY(1,1) PRIMARY KEY,
        trainId INT NOT NULL,
        dayOfWeek TINYINT NOT NULL,
        runs BIT NOT NULL DEFAULT 1,
        CONSTRAINT UQ_TrainRunningDays_Train_Day UNIQUE (trainId, dayOfWeek),
        CONSTRAINT FK_TrainRunningDays_Trains FOREIGN KEY (trainId) REFERENCES dbo.Trains(id) ON DELETE CASCADE,
        CONSTRAINT CK_TrainRunningDays_Day CHECK (dayOfWeek BETWEEN 1 AND 7)
    );
    CREATE INDEX IX_TrainRunningDays_TrainId ON dbo.TrainRunningDays(trainId);
END
GO

-- ============================================================
-- TRAIN STOPS — extend for multi-day & station FK
-- ============================================================
IF COL_LENGTH('dbo.TrainStops', 'stationId') IS NULL
    ALTER TABLE dbo.TrainStops ADD stationId INT NULL;
GO
IF COL_LENGTH('dbo.TrainStops', 'arrivalDayOffset') IS NULL
    ALTER TABLE dbo.TrainStops ADD arrivalDayOffset INT NOT NULL DEFAULT 0;
GO
IF COL_LENGTH('dbo.TrainStops', 'departureDayOffset') IS NULL
    ALTER TABLE dbo.TrainStops ADD departureDayOffset INT NOT NULL DEFAULT 0;
GO
IF COL_LENGTH('dbo.TrainStops', 'isTechnicalStop') IS NULL
    ALTER TABLE dbo.TrainStops ADD isTechnicalStop BIT NOT NULL DEFAULT 0;
GO
IF COL_LENGTH('dbo.TrainStops', 'platformHint') IS NULL
    ALTER TABLE dbo.TrainStops ADD platformHint NVARCHAR(20) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TrainStops_StationId' AND object_id = OBJECT_ID('dbo.TrainStops'))
    CREATE INDEX IX_TrainStops_StationId ON dbo.TrainStops(stationId);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TrainStops_Train_Station' AND object_id = OBJECT_ID('dbo.TrainStops'))
    CREATE INDEX IX_TrainStops_Train_Station ON dbo.TrainStops(trainId, stationId);
GO

-- ============================================================
-- TRAIN CLASSES — link to TravelClasses (optional FK)
-- ============================================================
IF COL_LENGTH('dbo.TrainClasses', 'travelClassId') IS NULL
    ALTER TABLE dbo.TrainClasses ADD travelClassId INT NULL;
GO
IF COL_LENGTH('dbo.TrainClasses', 'isAvailable') IS NULL
    ALTER TABLE dbo.TrainClasses ADD isAvailable BIT NOT NULL DEFAULT 1;
GO

-- ============================================================
-- FARE SIMULATION (Category B — development only)
-- ============================================================
IF OBJECT_ID('dbo.FareRules', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.FareRules (
        id INT IDENTITY(1,1) PRIMARY KEY,
        travelClassId INT NOT NULL,
        trainTypeId INT NULL,
        baseRatePerKm DECIMAL(8,4) NOT NULL,
        minimumFare DECIMAL(10,2) NOT NULL DEFAULT 0,
        reservationCharge DECIMAL(10,2) NOT NULL DEFAULT 40,
        superfastCharge DECIMAL(10,2) NOT NULL DEFAULT 0,
        otherFixedCharge DECIMAL(10,2) NOT NULL DEFAULT 0,
        effectiveFrom DATE NOT NULL DEFAULT '2020-01-01',
        effectiveTo DATE NULL,
        CONSTRAINT FK_FareRules_TravelClasses FOREIGN KEY (travelClassId) REFERENCES dbo.TravelClasses(id)
    );
END
GO

IF OBJECT_ID('dbo.TrainSegmentFares', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TrainSegmentFares (
        id INT IDENTITY(1,1) PRIMARY KEY,
        trainId INT NOT NULL,
        fromStationId INT NOT NULL,
        toStationId INT NOT NULL,
        travelClassId INT NOT NULL,
        quotaId INT NULL,
        fare DECIMAL(10,2) NOT NULL,
        effectiveFrom DATE NOT NULL,
        effectiveTo DATE NULL,
        dataSourceId INT NULL,
        CONSTRAINT FK_TrainSegmentFares_Trains FOREIGN KEY (trainId) REFERENCES dbo.Trains(id) ON DELETE CASCADE
    );
    CREATE INDEX IX_TrainSegmentFares_Lookup ON dbo.TrainSegmentFares(trainId, fromStationId, toStationId, travelClassId);
END
GO

-- ============================================================
-- JOURNEY / INVENTORY (Category B — development reservation engine)
-- ============================================================
IF OBJECT_ID('dbo.TrainJourneys', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TrainJourneys (
        id INT IDENTITY(1,1) PRIMARY KEY,
        trainId INT NOT NULL,
        sourceDepartureDate DATE NOT NULL,
        status NVARCHAR(20) NOT NULL DEFAULT 'Scheduled',
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_TrainJourneys_Train_Date UNIQUE (trainId, sourceDepartureDate),
        CONSTRAINT FK_TrainJourneys_Trains FOREIGN KEY (trainId) REFERENCES dbo.Trains(id) ON DELETE CASCADE
    );
END
GO

IF OBJECT_ID('dbo.CoachTypes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CoachTypes (
        id INT IDENTITY(1,1) PRIMARY KEY,
        code NVARCHAR(10) NOT NULL,
        name NVARCHAR(50) NOT NULL,
        travelClassId INT NOT NULL,
        CONSTRAINT UQ_CoachTypes_Code UNIQUE (code),
        CONSTRAINT FK_CoachTypes_TravelClasses FOREIGN KEY (travelClassId) REFERENCES dbo.TravelClasses(id)
    );
END
GO

IF OBJECT_ID('dbo.JourneyCoaches', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.JourneyCoaches (
        id INT IDENTITY(1,1) PRIMARY KEY,
        trainJourneyId INT NOT NULL,
        coachTypeId INT NOT NULL,
        coachNumber NVARCHAR(10) NOT NULL,
        position INT NOT NULL DEFAULT 0,
        CONSTRAINT FK_JourneyCoaches_Journey FOREIGN KEY (trainJourneyId) REFERENCES dbo.TrainJourneys(id) ON DELETE CASCADE,
        CONSTRAINT FK_JourneyCoaches_CoachType FOREIGN KEY (coachTypeId) REFERENCES dbo.CoachTypes(id)
    );
END
GO

IF OBJECT_ID('dbo.JourneySeats', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.JourneySeats (
        id INT IDENTITY(1,1) PRIMARY KEY,
        journeyCoachId INT NOT NULL,
        seatNumber NVARCHAR(10) NOT NULL,
        berthType NVARCHAR(20) NULL,
        CONSTRAINT FK_JourneySeats_Coach FOREIGN KEY (journeyCoachId) REFERENCES dbo.JourneyCoaches(id) ON DELETE CASCADE,
        CONSTRAINT UQ_JourneySeats UNIQUE (journeyCoachId, seatNumber)
    );
END
GO

IF OBJECT_ID('dbo.BookingSeatAllocations', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.BookingSeatAllocations (
        id INT IDENTITY(1,1) PRIMARY KEY,
        passengerId INT NOT NULL,
        journeySeatId INT NULL,
        fromStopSequence INT NOT NULL,
        toStopSequence INT NOT NULL,
        bookingStatus NVARCHAR(20) NOT NULL DEFAULT 'Confirmed',
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_BSA_Passenger FOREIGN KEY (passengerId) REFERENCES dbo.Passengers(id) ON DELETE CASCADE
    );
    CREATE INDEX IX_BSA_Seat_Stops ON dbo.BookingSeatAllocations(journeySeatId, fromStopSequence, toStopSequence);
END
GO

-- ============================================================
-- BOOKING EXTENSIONS
-- ============================================================
IF COL_LENGTH('dbo.Bookings', 'trainJourneyId') IS NULL
    ALTER TABLE dbo.Bookings ADD trainJourneyId INT NULL;
GO
IF COL_LENGTH('dbo.Bookings', 'fromStationId') IS NULL
    ALTER TABLE dbo.Bookings ADD fromStationId INT NULL;
GO
IF COL_LENGTH('dbo.Bookings', 'toStationId') IS NULL
    ALTER TABLE dbo.Bookings ADD toStationId INT NULL;
GO

IF OBJECT_ID('dbo.BookingCancellations', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.BookingCancellations (
        id INT IDENTITY(1,1) PRIMARY KEY,
        bookingId INT NOT NULL UNIQUE,
        cancelledAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        cancellationCharge DECIMAL(10,2) NOT NULL DEFAULT 0,
        refundAmount DECIMAL(10,2) NOT NULL DEFAULT 0,
        reason NVARCHAR(255) NULL,
        CONSTRAINT FK_BookingCancellations_Bookings FOREIGN KEY (bookingId) REFERENCES dbo.Bookings(id) ON DELETE CASCADE
    );
END
GO

-- Seed reference TravelClasses & Quotas if empty
IF NOT EXISTS (SELECT 1 FROM dbo.TravelClasses)
BEGIN
    INSERT INTO dbo.TravelClasses (code, name, description) VALUES
    ('1A', 'AC First Class', 'First AC — coupe/cabin berths'),
    ('2A', 'AC 2 Tier', 'Second AC'),
    ('3A', 'AC 3 Tier', 'Third AC'),
    ('3E', 'AC 3 Economy', 'AC 3-tier economy (Garib Rath)'),
    ('EA', 'Anubhuthi', 'AC chair car with entertainment'),
    ('SL', 'Sleeper', 'Sleeper Class'),
    ('CC', 'Chair Car', 'AC Chair Car'),
    ('EC', 'Executive Chair', 'Executive Chair Car'),
    ('2S', 'Second Sitting', 'Second Sitting'),
    ('GS', 'General', 'Unreserved / General');
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.TravelClasses WHERE code = 'EA')
    INSERT INTO dbo.TravelClasses (code, name, description) VALUES ('EA', 'Anubhuthi', 'AC chair car with entertainment');
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Quotas)
BEGIN
    INSERT INTO dbo.Quotas (code, name, description) VALUES
    ('GN', 'General', 'General quota'),
    ('TQ', 'Tatkal', 'Tatkal quota'),
    ('LD', 'Ladies', 'Ladies quota'),
    ('SS', 'Senior Citizen', 'Senior citizen quota');
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.TrainTypes)
BEGIN
    INSERT INTO dbo.TrainTypes (code, name, description) VALUES
    ('RAJ', 'Rajdhani', 'Rajdhani Express'),
    ('SHAT', 'Shatabdi', 'Shatabdi Express'),
    ('DUR', 'Duronto', 'Duronto Express'),
    ('VB', 'Vande Bharat', 'Vande Bharat Express'),
    ('SF', 'Superfast', 'Superfast Express'),
    ('EXP', 'Express', 'Express train'),
    ('PASS', 'Passenger', 'Passenger train');
END
GO
