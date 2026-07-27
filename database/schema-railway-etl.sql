-- RailYatra ETL Master Data Schema
-- Normalized timetable tables for ASP.NET Core import pipeline.
-- Applied after schema.sql and schema-railway-master.sql.

-- ============================================================
-- ZONES (canonical; RailwayZones kept for legacy compatibility)
-- ============================================================
IF OBJECT_ID('dbo.Zones', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Zones (
        id INT IDENTITY(1,1) PRIMARY KEY,
        code NVARCHAR(10) NOT NULL,
        name NVARCHAR(100) NOT NULL,
        headquarters NVARCHAR(100) NULL,
        isActive BIT NOT NULL DEFAULT 1,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Zones_Code UNIQUE (code)
    );
    CREATE INDEX IX_Zones_Name ON dbo.Zones(name);
END
GO

-- Seed zones from RailwayZones if empty
IF NOT EXISTS (SELECT 1 FROM dbo.Zones) AND OBJECT_ID('dbo.RailwayZones', 'U') IS NOT NULL
BEGIN
    INSERT INTO dbo.Zones (code, name, headquarters)
    SELECT code, name, headquarters FROM dbo.RailwayZones;
END
GO

-- ============================================================
-- DATA VERSION (timetable snapshot history)
-- ============================================================
IF OBJECT_ID('dbo.DataVersion', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DataVersion (
        id INT IDENTITY(1,1) PRIMARY KEY,
        versionTag NVARCHAR(50) NOT NULL,
        sourceName NVARCHAR(200) NOT NULL,
        sourceUrl NVARCHAR(500) NULL,
        publisher NVARCHAR(200) NULL,
        licenseNotes NVARCHAR(500) NULL,
        datasetVersion NVARCHAR(50) NULL,
        fileHash NVARCHAR(128) NULL,
        importMode NVARCHAR(20) NOT NULL DEFAULT 'Full',
        isActive BIT NOT NULL DEFAULT 0,
        trainCount INT NULL,
        routeCount INT NULL,
        stationCount INT NULL,
        importedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        notes NVARCHAR(MAX) NULL,
        CONSTRAINT UQ_DataVersion_Tag UNIQUE (versionTag)
    );
    CREATE INDEX IX_DataVersion_Active ON dbo.DataVersion(isActive) WHERE isActive = 1;
END
GO

-- ============================================================
-- IMPORT LOGS
-- ============================================================
IF OBJECT_ID('dbo.ImportLogs', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ImportLogs (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        dataVersionId INT NULL,
        importType NVARCHAR(30) NOT NULL,
        status NVARCHAR(30) NOT NULL DEFAULT 'Started',
        startedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        completedAt DATETIME2 NULL,
        executionTimeMs BIGINT NULL,
        insertedCount INT NOT NULL DEFAULT 0,
        updatedCount INT NOT NULL DEFAULT 0,
        deletedCount INT NOT NULL DEFAULT 0,
        skippedCount INT NOT NULL DEFAULT 0,
        errorCount INT NOT NULL DEFAULT 0,
        sourceFile NVARCHAR(500) NULL,
        message NVARCHAR(MAX) NULL,
        errorDetails NVARCHAR(MAX) NULL,
        CONSTRAINT FK_ImportLogs_DataVersion FOREIGN KEY (dataVersionId) REFERENCES dbo.DataVersion(id)
    );
    CREATE INDEX IX_ImportLogs_StartedAt ON dbo.ImportLogs(startedAt DESC);
    CREATE INDEX IX_ImportLogs_Status ON dbo.ImportLogs(status);
END
GO

-- ============================================================
-- TRAIN MASTER
-- ============================================================
IF OBJECT_ID('dbo.TrainMaster', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TrainMaster (
        id INT IDENTITY(1,1) PRIMARY KEY,
        trainNumber NVARCHAR(20) NOT NULL,
        trainName NVARCHAR(150) NOT NULL,
        normalizedName NVARCHAR(150) NULL,
        trainTypeId INT NULL,
        zoneId INT NULL,
        sourceStationId INT NOT NULL,
        sourceStationCode NVARCHAR(10) NOT NULL,
        sourceStationName NVARCHAR(150) NOT NULL,
        destinationStationId INT NOT NULL,
        destinationStationCode NVARCHAR(10) NOT NULL,
        destinationStationName NVARCHAR(150) NOT NULL,
        departureTimeFromSource NVARCHAR(8) NOT NULL,
        arrivalTimeAtDestination NVARCHAR(8) NOT NULL,
        totalDistanceKm INT NULL,
        totalJourneyMinutes INT NULL,
        trainStatus NVARCHAR(20) NOT NULL DEFAULT 'Active',
        pantryAvailable BIT NULL,
        reservationAvailable BIT NULL,
        superfastFlag BIT NOT NULL DEFAULT 0,
        dataVersionId INT NULL,
        legacyTrainId INT NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_TrainMaster_Number_Version UNIQUE (trainNumber, dataVersionId),
        CONSTRAINT FK_TrainMaster_TrainType FOREIGN KEY (trainTypeId) REFERENCES dbo.TrainTypes(id),
        CONSTRAINT FK_TrainMaster_Zone FOREIGN KEY (zoneId) REFERENCES dbo.Zones(id),
        CONSTRAINT FK_TrainMaster_SourceStation FOREIGN KEY (sourceStationId) REFERENCES dbo.Stations(id),
        CONSTRAINT FK_TrainMaster_DestStation FOREIGN KEY (destinationStationId) REFERENCES dbo.Stations(id),
        CONSTRAINT FK_TrainMaster_DataVersion FOREIGN KEY (dataVersionId) REFERENCES dbo.DataVersion(id),
        CONSTRAINT CK_TrainMaster_Status CHECK (trainStatus IN ('Active', 'Cancelled', 'Inactive'))
    );
    CREATE INDEX IX_TrainMaster_Number ON dbo.TrainMaster(trainNumber);
    CREATE INDEX IX_TrainMaster_Status ON dbo.TrainMaster(trainStatus);
    CREATE INDEX IX_TrainMaster_Source ON dbo.TrainMaster(sourceStationId);
    CREATE INDEX IX_TrainMaster_Dest ON dbo.TrainMaster(destinationStationId);
    CREATE INDEX IX_TrainMaster_Type ON dbo.TrainMaster(trainTypeId);
    CREATE INDEX IX_TrainMaster_DataVersion ON dbo.TrainMaster(dataVersionId);
END
GO

-- Extend TrainRunningDays to link to TrainMaster
IF COL_LENGTH('dbo.TrainRunningDays', 'trainMasterId') IS NULL
    ALTER TABLE dbo.TrainRunningDays ADD trainMasterId INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TrainRunningDays_TrainMasterId' AND object_id = OBJECT_ID('dbo.TrainRunningDays'))
    CREATE INDEX IX_TrainRunningDays_TrainMasterId ON dbo.TrainRunningDays(trainMasterId);
GO

-- ============================================================
-- TRAIN ROUTES (complete stop sequence)
-- ============================================================
IF OBJECT_ID('dbo.TrainRoutes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TrainRoutes (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        trainMasterId INT NOT NULL,
        trainNumber NVARCHAR(20) NOT NULL,
        stationSequence INT NOT NULL,
        stationId INT NOT NULL,
        stationCode NVARCHAR(10) NOT NULL,
        stationName NVARCHAR(150) NOT NULL,
        arrivalTime NVARCHAR(8) NULL,
        departureTime NVARCHAR(8) NULL,
        haltMinutes INT NULL,
        dayNumber TINYINT NOT NULL DEFAULT 1,
        distanceFromSourceKm INT NULL,
        platformNumber NVARCHAR(20) NULL,
        isTechnicalHalt BIT NOT NULL DEFAULT 0,
        isCommercialHalt BIT NOT NULL DEFAULT 1,
        dataVersionId INT NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_TrainRoutes_Train_Station UNIQUE (trainMasterId, stationSequence),
        CONSTRAINT FK_TrainRoutes_TrainMaster FOREIGN KEY (trainMasterId) REFERENCES dbo.TrainMaster(id) ON DELETE CASCADE,
        CONSTRAINT FK_TrainRoutes_Station FOREIGN KEY (stationId) REFERENCES dbo.Stations(id),
        CONSTRAINT FK_TrainRoutes_DataVersion FOREIGN KEY (dataVersionId) REFERENCES dbo.DataVersion(id)
    );
    CREATE INDEX IX_TrainRoutes_TrainMaster ON dbo.TrainRoutes(trainMasterId, stationSequence);
    CREATE INDEX IX_TrainRoutes_Station ON dbo.TrainRoutes(stationId);
    CREATE INDEX IX_TrainRoutes_TrainNumber ON dbo.TrainRoutes(trainNumber);
    CREATE INDEX IX_TrainRoutes_Train_Station ON dbo.TrainRoutes(trainMasterId, stationId) INCLUDE (stationSequence, arrivalTime, departureTime, dayNumber);
END
GO

-- ============================================================
-- ROUTE DISTANCES (segment between consecutive stops)
-- ============================================================
IF OBJECT_ID('dbo.RouteDistances', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.RouteDistances (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        trainMasterId INT NOT NULL,
        fromStationId INT NOT NULL,
        toStationId INT NOT NULL,
        fromSequence INT NOT NULL,
        toSequence INT NOT NULL,
        distanceKm INT NULL,
        dataVersionId INT NULL,
        CONSTRAINT UQ_RouteDistances_Segment UNIQUE (trainMasterId, fromStationId, toStationId),
        CONSTRAINT FK_RouteDistances_TrainMaster FOREIGN KEY (trainMasterId) REFERENCES dbo.TrainMaster(id) ON DELETE CASCADE,
        CONSTRAINT FK_RouteDistances_FromStation FOREIGN KEY (fromStationId) REFERENCES dbo.Stations(id),
        CONSTRAINT FK_RouteDistances_ToStation FOREIGN KEY (toStationId) REFERENCES dbo.Stations(id),
        CONSTRAINT FK_RouteDistances_DataVersion FOREIGN KEY (dataVersionId) REFERENCES dbo.DataVersion(id)
    );
    CREATE INDEX IX_RouteDistances_Train ON dbo.RouteDistances(trainMasterId);
    CREATE INDEX IX_RouteDistances_FromTo ON dbo.RouteDistances(fromStationId, toStationId);
END
GO

-- Widen Stations columns for DataMeet import compatibility
IF COL_LENGTH('dbo.Stations', 'code') IS NOT NULL
BEGIN
    DECLARE @codeLen INT = (SELECT max_length FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Stations') AND name = 'code');
    IF @codeLen < 20
        ALTER TABLE dbo.Stations ALTER COLUMN code NVARCHAR(20) NOT NULL;
END
GO
IF COL_LENGTH('dbo.Stations', 'city') IS NOT NULL
BEGIN
    DECLARE @cityLen INT = (SELECT max_length FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Stations') AND name = 'city');
    IF @cityLen < 200
        ALTER TABLE dbo.Stations ALTER COLUMN city NVARCHAR(120) NOT NULL;
END
GO
