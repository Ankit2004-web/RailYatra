-- RailYatra Coach Composition & Seating Capacity Schema
-- Capacity rules sourced from official IR coach classification (ICF/LHB/VB/etc.).
-- Per-train composition imported only from licensed datasets — never fabricated.

-- ============================================================
-- COACH MODELS (ICF, LHB, Vande Bharat, MEMU, DEMU, etc.)
-- ============================================================
IF OBJECT_ID('dbo.CoachModels', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CoachModels (
        id INT IDENTITY(1,1) PRIMARY KEY,
        code NVARCHAR(20) NOT NULL,
        name NVARCHAR(100) NOT NULL,
        description NVARCHAR(500) NULL,
        manufacturer NVARCHAR(100) NULL,
        isActive BIT NOT NULL DEFAULT 1,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_CoachModels_Code UNIQUE (code)
    );
END
GO

-- ============================================================
-- COACH TYPES — extend legacy CoachTypes or create catalog
-- ============================================================
IF OBJECT_ID('dbo.CoachTypes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CoachTypes (
        id INT IDENTITY(1,1) PRIMARY KEY,
        code NVARCHAR(10) NOT NULL,
        name NVARCHAR(80) NOT NULL,
        irCategory NVARCHAR(30) NULL,
        travelClassId INT NULL,
        isPassengerCoach BIT NOT NULL DEFAULT 1,
        isAcCoach BIT NOT NULL DEFAULT 0,
        isSleeperCoach BIT NOT NULL DEFAULT 0,
        isChairCoach BIT NOT NULL DEFAULT 0,
        isReservedCoach BIT NOT NULL DEFAULT 1,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_CoachTypes_Code UNIQUE (code),
        CONSTRAINT FK_CoachTypes_TravelClasses FOREIGN KEY (travelClassId) REFERENCES dbo.TravelClasses(id)
    );
END
GO

IF COL_LENGTH('dbo.CoachTypes', 'irCategory') IS NULL
    ALTER TABLE dbo.CoachTypes ADD irCategory NVARCHAR(30) NULL;
GO
IF COL_LENGTH('dbo.CoachTypes', 'isPassengerCoach') IS NULL
    ALTER TABLE dbo.CoachTypes ADD isPassengerCoach BIT NOT NULL DEFAULT 1;
GO
IF COL_LENGTH('dbo.CoachTypes', 'isAcCoach') IS NULL
    ALTER TABLE dbo.CoachTypes ADD isAcCoach BIT NOT NULL DEFAULT 0;
GO
IF COL_LENGTH('dbo.CoachTypes', 'isSleeperCoach') IS NULL
    ALTER TABLE dbo.CoachTypes ADD isSleeperCoach BIT NOT NULL DEFAULT 0;
GO
IF COL_LENGTH('dbo.CoachTypes', 'isChairCoach') IS NULL
    ALTER TABLE dbo.CoachTypes ADD isChairCoach BIT NOT NULL DEFAULT 0;
GO
IF COL_LENGTH('dbo.CoachTypes', 'isReservedCoach') IS NULL
    ALTER TABLE dbo.CoachTypes ADD isReservedCoach BIT NOT NULL DEFAULT 1;
GO

-- Allow utility coaches (PC, EOG, SLR) without travel class
IF COL_LENGTH('dbo.CoachTypes', 'travelClassId') IS NOT NULL
BEGIN
    ALTER TABLE dbo.CoachTypes ALTER COLUMN travelClassId INT NULL;
END
GO

-- ============================================================
-- COACH CAPACITY RULES (official model × type → exact capacity)
-- ============================================================
IF OBJECT_ID('dbo.CoachCapacityRules', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CoachCapacityRules (
        id INT IDENTITY(1,1) PRIMARY KEY,
        coachTypeId INT NOT NULL,
        coachModelId INT NOT NULL,
        seatingCapacity INT NULL,
        sleepingBerths INT NULL,
        coupeCount INT NULL,
        cabinCount INT NULL,
        totalBerths INT NULL,
        lowerBerths INT NULL,
        middleBerths INT NULL,
        upperBerths INT NULL,
        sideLowerBerths INT NULL,
        sideUpperBerths INT NULL,
        sourceReference NVARCHAR(500) NOT NULL,
        effectiveFrom DATE NOT NULL DEFAULT '2000-01-01',
        effectiveTo DATE NULL,
        isValidated BIT NOT NULL DEFAULT 1,
        notes NVARCHAR(MAX) NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_CoachCapacityRules_Type_Model UNIQUE (coachTypeId, coachModelId, effectiveFrom),
        CONSTRAINT FK_CCR_CoachType FOREIGN KEY (coachTypeId) REFERENCES dbo.CoachTypes(id),
        CONSTRAINT FK_CCR_CoachModel FOREIGN KEY (coachModelId) REFERENCES dbo.CoachModels(id)
    );
    CREATE INDEX IX_CoachCapacityRules_Lookup ON dbo.CoachCapacityRules(coachTypeId, coachModelId);
END
GO

-- ============================================================
-- COACH LAYOUTS (berth/seat arrangement metadata)
-- ============================================================
IF OBJECT_ID('dbo.CoachLayouts', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CoachLayouts (
        id INT IDENTITY(1,1) PRIMARY KEY,
        coachTypeId INT NOT NULL,
        coachModelId INT NOT NULL,
        layoutCode NVARCHAR(30) NOT NULL,
        layoutName NVARCHAR(100) NOT NULL,
        berthConfiguration NVARCHAR(500) NULL,
        seatingConfiguration NVARCHAR(500) NULL,
        layoutDiagramJson NVARCHAR(MAX) NULL,
        sourceReference NVARCHAR(500) NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_CoachLayouts_Code UNIQUE (layoutCode),
        CONSTRAINT FK_CoachLayouts_Type FOREIGN KEY (coachTypeId) REFERENCES dbo.CoachTypes(id),
        CONSTRAINT FK_CoachLayouts_Model FOREIGN KEY (coachModelId) REFERENCES dbo.CoachModels(id)
    );
END
GO

-- ============================================================
-- COMPOSITION VERSION (rake snapshot history)
-- ============================================================
IF OBJECT_ID('dbo.CompositionVersion', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CompositionVersion (
        id INT IDENTITY(1,1) PRIMARY KEY,
        versionTag NVARCHAR(50) NOT NULL,
        trainNumber NVARCHAR(20) NOT NULL,
        sourceName NVARCHAR(200) NOT NULL,
        sourceUrl NVARCHAR(500) NULL,
        validFrom DATE NULL,
        validTo DATE NULL,
        isActive BIT NOT NULL DEFAULT 0,
        importedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        notes NVARCHAR(MAX) NULL,
        CONSTRAINT UQ_CompositionVersion_Tag UNIQUE (versionTag)
    );
    CREATE INDEX IX_CompositionVersion_Train ON dbo.CompositionVersion(trainNumber, isActive);
END
GO

-- ============================================================
-- TRAIN COACH COMPOSITION (per-coach rake data)
-- ============================================================
IF OBJECT_ID('dbo.TrainCoachComposition', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TrainCoachComposition (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        trainId INT NULL,
        trainNumber NVARCHAR(20) NOT NULL,
        trainName NVARCHAR(150) NULL,
        compositionVersionId INT NULL,
        coachNumber NVARCHAR(10) NOT NULL,
        coachTypeId INT NOT NULL,
        coachModelId INT NULL,
        coachPosition INT NOT NULL,
        seatingCapacity INT NULL,
        sleepingBerths INT NULL,
        capacityKnown BIT NOT NULL DEFAULT 0,
        capacityRuleId INT NULL,
        ladiesCoach BIT NOT NULL DEFAULT 0,
        divyangCoach BIT NOT NULL DEFAULT 0,
        pantryCar BIT NOT NULL DEFAULT 0,
        guardCoach BIT NOT NULL DEFAULT 0,
        parcelCoach BIT NOT NULL DEFAULT 0,
        powerCar BIT NOT NULL DEFAULT 0,
        validFrom DATE NULL,
        validTo DATE NULL,
        dataSourceId INT NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_TrainCoachComp_Version_Coach UNIQUE (compositionVersionId, coachNumber),
        CONSTRAINT FK_TCC_Train FOREIGN KEY (trainId) REFERENCES dbo.Trains(id),
        CONSTRAINT FK_TCC_CoachType FOREIGN KEY (coachTypeId) REFERENCES dbo.CoachTypes(id),
        CONSTRAINT FK_TCC_CoachModel FOREIGN KEY (coachModelId) REFERENCES dbo.CoachModels(id),
        CONSTRAINT FK_TCC_CapacityRule FOREIGN KEY (capacityRuleId) REFERENCES dbo.CoachCapacityRules(id),
        CONSTRAINT FK_TCC_CompositionVersion FOREIGN KEY (compositionVersionId) REFERENCES dbo.CompositionVersion(id)
    );
    CREATE INDEX IX_TCC_TrainNumber ON dbo.TrainCoachComposition(trainNumber);
    CREATE INDEX IX_TCC_TrainId ON dbo.TrainCoachComposition(trainId);
    CREATE INDEX IX_TCC_Version ON dbo.TrainCoachComposition(compositionVersionId, coachPosition);
END
GO

-- ============================================================
-- TRAIN CAPACITY (aggregated totals per composition version)
-- ============================================================
IF OBJECT_ID('dbo.TrainCapacity', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TrainCapacity (
        id INT IDENTITY(1,1) PRIMARY KEY,
        trainId INT NULL,
        trainNumber NVARCHAR(20) NOT NULL,
        compositionVersionId INT NULL,
        totalCoaches INT NOT NULL DEFAULT 0,
        totalAcCapacity INT NULL,
        totalSleeperCapacity INT NULL,
        totalChairCapacity INT NULL,
        totalGeneralCapacity INT NULL,
        totalReservedCapacity INT NULL,
        totalPassengerCapacity INT NULL,
        capacityStatus NVARCHAR(20) NOT NULL DEFAULT 'Unknown',
        calculatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_TrainCapacity_Train_Version UNIQUE (trainNumber, compositionVersionId),
        CONSTRAINT FK_TrainCapacity_Train FOREIGN KEY (trainId) REFERENCES dbo.Trains(id),
        CONSTRAINT FK_TrainCapacity_Version FOREIGN KEY (compositionVersionId) REFERENCES dbo.CompositionVersion(id),
        CONSTRAINT CK_TrainCapacity_Status CHECK (capacityStatus IN ('Known', 'Partial', 'Unknown'))
    );
    CREATE INDEX IX_TrainCapacity_TrainNumber ON dbo.TrainCapacity(trainNumber);
END
GO
