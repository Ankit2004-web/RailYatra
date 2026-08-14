USE RailwayReservation;
GO

IF OBJECT_ID('dbo.Passengers', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Passengers (
        id INT IDENTITY(1,1) PRIMARY KEY,
        bookingId INT NOT NULL,
        name NVARCHAR(100) NOT NULL,
        age INT NOT NULL,
        gender NVARCHAR(10) NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.Bookings', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Bookings (
        id INT IDENTITY(1,1) PRIMARY KEY,
        userId INT NOT NULL,
        trainId INT NOT NULL,
        totalPrice DECIMAL(10,2) NOT NULL,
        seatNumbers NVARCHAR(500) NOT NULL DEFAULT '[]',
        status NVARCHAR(20) NOT NULL DEFAULT 'Confirmed',
        journeyDate DATE NOT NULL,
        pnrNumber NVARCHAR(10) NOT NULL UNIQUE,
        bookingDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID('dbo.Trains', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Trains (
        id INT IDENTITY(1,1) PRIMARY KEY,
        trainNumber NVARCHAR(20) NOT NULL UNIQUE,
        trainName NVARCHAR(100) NOT NULL,
        source NVARCHAR(100) NOT NULL,
        destination NVARCHAR(100) NOT NULL,
        departureTime NVARCHAR(10) NOT NULL,
        arrivalTime NVARCHAR(10) NOT NULL,
        duration NVARCHAR(20) NOT NULL,
        distance INT NOT NULL,
        availableSeats INT NOT NULL DEFAULT 100,
        price DECIMAL(10,2) NOT NULL,
        journeyDate DATE NOT NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID('dbo.Stations', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Stations (
        id INT IDENTITY(1,1) PRIMARY KEY,
        code NVARCHAR(10) NOT NULL UNIQUE,
        name NVARCHAR(100) NOT NULL,
        city NVARCHAR(80) NOT NULL,
        state NVARCHAR(80) NOT NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID('dbo.Users', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(100) NOT NULL,
        email NVARCHAR(150) NOT NULL UNIQUE,
        password NVARCHAR(255) NOT NULL,
        phone NVARCHAR(15) NOT NULL,
        isAdmin BIT NOT NULL DEFAULT 0,
        avatarUrl NVARCHAR(500) NULL,
        theme NVARCHAR(20) NOT NULL DEFAULT 'light',
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID('dbo.TrainClasses', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TrainClasses (
        id INT IDENTITY(1,1) PRIMARY KEY,
        trainId INT NOT NULL,
        classCode NVARCHAR(5) NOT NULL,
        className NVARCHAR(50) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        totalSeats INT NOT NULL,
        availableSeats INT NOT NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_TrainClasses_Train_Class UNIQUE (trainId, classCode)
    );
END
GO

IF COL_LENGTH('dbo.Bookings', 'classCode') IS NULL
BEGIN
    ALTER TABLE dbo.Bookings ADD classCode NVARCHAR(5) NULL;
END
GO

IF COL_LENGTH('dbo.Bookings', 'bookingType') IS NULL
BEGIN
    ALTER TABLE dbo.Bookings ADD bookingType NVARCHAR(10) NOT NULL DEFAULT 'General';
END
GO

IF COL_LENGTH('dbo.Bookings', 'paymentStatus') IS NULL
BEGIN
    ALTER TABLE dbo.Bookings ADD paymentStatus NVARCHAR(20) NOT NULL DEFAULT 'Pending';
END
GO

IF COL_LENGTH('dbo.Bookings', 'waitlistPosition') IS NULL
BEGIN
    ALTER TABLE dbo.Bookings ADD waitlistPosition INT NULL;
END
GO

IF COL_LENGTH('dbo.Users', 'isBlocked') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD isBlocked BIT NOT NULL DEFAULT 0;
END
GO

IF COL_LENGTH('dbo.Users', 'avatarUrl') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD avatarUrl NVARCHAR(500) NULL;
END
GO

IF COL_LENGTH('dbo.Users', 'theme') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD theme NVARCHAR(20) NOT NULL DEFAULT 'light';
END
GO

IF COL_LENGTH('dbo.Trains', 'runningDays') IS NULL
BEGIN
    ALTER TABLE dbo.Trains ADD runningDays NVARCHAR(50) NOT NULL DEFAULT 'Daily';
END
GO

IF COL_LENGTH('dbo.Trains', 'runningStatus') IS NULL
BEGIN
    ALTER TABLE dbo.Trains ADD runningStatus NVARCHAR(20) NOT NULL DEFAULT 'Running';
END
GO

IF OBJECT_ID('dbo.PasswordResetTokens', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PasswordResetTokens (
        id INT IDENTITY(1,1) PRIMARY KEY,
        userId INT NOT NULL,
        token NVARCHAR(64) NOT NULL UNIQUE,
        expiresAt DATETIME2 NOT NULL,
        used BIT NOT NULL DEFAULT 0,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_PasswordResetTokens_Users')
BEGIN
    ALTER TABLE dbo.PasswordResetTokens
    ADD CONSTRAINT FK_PasswordResetTokens_Users FOREIGN KEY (userId) REFERENCES dbo.Users(id) ON DELETE CASCADE;
END
GO

IF OBJECT_ID('dbo.Seats', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Seats (
        id INT IDENTITY(1,1) PRIMARY KEY,
        trainId INT NOT NULL,
        classCode NVARCHAR(5) NOT NULL,
        seatNumber INT NOT NULL,
        berthType NVARCHAR(5) NOT NULL DEFAULT 'SEAT',
        journeyDate DATE NOT NULL,
        status NVARCHAR(20) NOT NULL DEFAULT 'Available',
        bookingId INT NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Seats_Train_Class_Seat_Date UNIQUE (trainId, classCode, seatNumber, journeyDate)
    );
END
GO

IF OBJECT_ID('dbo.Payments', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Payments (
        id INT IDENTITY(1,1) PRIMARY KEY,
        bookingId INT NOT NULL,
        razorpayOrderId NVARCHAR(100) NULL,
        razorpayPaymentId NVARCHAR(100) NULL,
        amount DECIMAL(10,2) NOT NULL,
        currency NVARCHAR(5) NOT NULL DEFAULT 'INR',
        status NVARCHAR(20) NOT NULL DEFAULT 'Pending',
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Seats_Trains')
BEGIN
    ALTER TABLE dbo.Seats
    ADD CONSTRAINT FK_Seats_Trains FOREIGN KEY (trainId) REFERENCES dbo.Trains(id) ON DELETE CASCADE;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Seats_Bookings')
BEGIN
    ALTER TABLE dbo.Seats
    ADD CONSTRAINT FK_Seats_Bookings FOREIGN KEY (bookingId) REFERENCES dbo.Bookings(id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Payments_Bookings')
BEGIN
    ALTER TABLE dbo.Payments
    ADD CONSTRAINT FK_Payments_Bookings FOREIGN KEY (bookingId) REFERENCES dbo.Bookings(id) ON DELETE CASCADE;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_TrainClasses_Trains')
BEGIN
    ALTER TABLE dbo.TrainClasses
    ADD CONSTRAINT FK_TrainClasses_Trains FOREIGN KEY (trainId) REFERENCES dbo.Trains(id) ON DELETE CASCADE;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Bookings_Users')
BEGIN
    ALTER TABLE dbo.Bookings
    ADD CONSTRAINT FK_Bookings_Users FOREIGN KEY (userId) REFERENCES dbo.Users(id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Bookings_Trains')
BEGIN
    ALTER TABLE dbo.Bookings
    ADD CONSTRAINT FK_Bookings_Trains FOREIGN KEY (trainId) REFERENCES dbo.Trains(id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Passengers_Bookings')
BEGIN
    ALTER TABLE dbo.Passengers
    ADD CONSTRAINT FK_Passengers_Bookings FOREIGN KEY (bookingId) REFERENCES dbo.Bookings(id) ON DELETE CASCADE;
END
GO

IF COL_LENGTH('dbo.Bookings', 'quota') IS NULL
BEGIN
    ALTER TABLE dbo.Bookings ADD quota NVARCHAR(20) NOT NULL DEFAULT 'General';
END
GO

IF OBJECT_ID('dbo.Refunds', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Refunds (
        id INT IDENTITY(1,1) PRIMARY KEY,
        bookingId INT NOT NULL UNIQUE,
        originalAmount DECIMAL(10,2) NOT NULL,
        refundAmount DECIMAL(10,2) NOT NULL,
        refundPercent DECIMAL(5,2) NOT NULL,
        cancellationCharge DECIMAL(10,2) NOT NULL DEFAULT 0,
        status NVARCHAR(20) NOT NULL DEFAULT 'Processed',
        reason NVARCHAR(100) NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID('dbo.TrainStops', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TrainStops (
        id INT IDENTITY(1,1) PRIMARY KEY,
        trainId INT NOT NULL,
        stationCode NVARCHAR(10) NULL,
        stationName NVARCHAR(100) NOT NULL,
        stopOrder INT NOT NULL,
        arrivalTime NVARCHAR(10) NULL,
        departureTime NVARCHAR(10) NULL,
        haltMinutes INT NOT NULL DEFAULT 0,
        distanceKm INT NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_TrainStops_Train_Order UNIQUE (trainId, stopOrder)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Refunds_Bookings')
BEGIN
    ALTER TABLE dbo.Refunds
    ADD CONSTRAINT FK_Refunds_Bookings FOREIGN KEY (bookingId) REFERENCES dbo.Bookings(id) ON DELETE CASCADE;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_TrainStops_Trains')
BEGIN
    ALTER TABLE dbo.TrainStops
    ADD CONSTRAINT FK_TrainStops_Trains FOREIGN KEY (trainId) REFERENCES dbo.Trains(id) ON DELETE CASCADE;
END
GO

IF COL_LENGTH('dbo.Passengers', 'berthPreference') IS NULL
BEGIN
    ALTER TABLE dbo.Passengers ADD berthPreference NVARCHAR(20) NULL;
END
GO

IF COL_LENGTH('dbo.Passengers', 'passengerStatus') IS NULL
BEGIN
    ALTER TABLE dbo.Passengers ADD passengerStatus NVARCHAR(20) NOT NULL DEFAULT 'Confirmed';
END
GO

IF COL_LENGTH('dbo.Bookings', 'paymentBreakdown') IS NULL
BEGIN
    ALTER TABLE dbo.Bookings ADD paymentBreakdown NVARCHAR(MAX) NULL;
END
GO

IF COL_LENGTH('dbo.Bookings', 'grandTotal') IS NULL
BEGIN
    ALTER TABLE dbo.Bookings ADD grandTotal DECIMAL(10,2) NULL;
END
GO

IF OBJECT_ID('dbo.SavedPassengers', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SavedPassengers (
        id INT IDENTITY(1,1) PRIMARY KEY,
        userId INT NOT NULL,
        name NVARCHAR(100) NOT NULL,
        age INT NOT NULL,
        gender NVARCHAR(10) NOT NULL,
        berthPreference NVARCHAR(20) NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_SavedPassengers_Users')
BEGIN
    ALTER TABLE dbo.SavedPassengers
    ADD CONSTRAINT FK_SavedPassengers_Users FOREIGN KEY (userId) REFERENCES dbo.Users(id) ON DELETE CASCADE;
END
GO

IF COL_LENGTH('dbo.Users', 'role') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD role NVARCHAR(30) NOT NULL DEFAULT 'passenger';
END
GO

IF COL_LENGTH('dbo.Users', 'mfaEnabled') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD mfaEnabled BIT NOT NULL DEFAULT 0;
END
GO

IF COL_LENGTH('dbo.Users', 'isBlocked') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD isBlocked BIT NOT NULL DEFAULT 0;
END
GO

UPDATE dbo.Users SET role = 'admin' WHERE isAdmin = 1 AND (role IS NULL OR role = 'passenger');
GO

IF COL_LENGTH('dbo.Bookings', 'paymentHoldExpiresAt') IS NULL
BEGIN
    ALTER TABLE dbo.Bookings ADD paymentHoldExpiresAt DATETIME2 NULL;
END
GO

IF COL_LENGTH('dbo.Passengers', 'nationality') IS NULL
BEGIN
    ALTER TABLE dbo.Passengers ADD nationality NVARCHAR(50) NULL DEFAULT 'Indian';
END
GO

IF COL_LENGTH('dbo.Passengers', 'mobile') IS NULL
BEGIN
    ALTER TABLE dbo.Passengers ADD mobile NVARCHAR(15) NULL;
END
GO

IF COL_LENGTH('dbo.Passengers', 'email') IS NULL
BEGIN
    ALTER TABLE dbo.Passengers ADD email NVARCHAR(150) NULL;
END
GO

IF COL_LENGTH('dbo.Passengers', 'idType') IS NULL
BEGIN
    ALTER TABLE dbo.Passengers ADD idType NVARCHAR(30) NULL;
END
GO

IF COL_LENGTH('dbo.Passengers', 'idNumber') IS NULL
BEGIN
    ALTER TABLE dbo.Passengers ADD idNumber NVARCHAR(50) NULL;
END
GO

IF COL_LENGTH('dbo.Passengers', 'idToken') IS NULL
BEGIN
    ALTER TABLE dbo.Passengers ADD idToken NVARCHAR(80) NULL;
END
GO

IF COL_LENGTH('dbo.Passengers', 'idFingerprint') IS NULL
BEGIN
    ALTER TABLE dbo.Passengers ADD idFingerprint NVARCHAR(64) NULL;
END
GO

IF OBJECT_ID('dbo.IdentityVault', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.IdentityVault (
        id INT IDENTITY(1,1) PRIMARY KEY,
        token NVARCHAR(80) NOT NULL UNIQUE,
        userId INT NULL,
        idType NVARCHAR(30) NOT NULL,
        fingerprint NVARCHAR(64) NOT NULL,
        last4 NVARCHAR(8) NULL,
        maskedNumber NVARCHAR(40) NOT NULL,
        ciphertext NVARCHAR(MAX) NULL,
        iv NVARCHAR(64) NULL,
        authTag NVARCHAR(64) NULL,
        purpose NVARCHAR(40) NOT NULL,
        saveForLater BIT NOT NULL DEFAULT 0,
        consentVersion NVARCHAR(20) NULL,
        expiresAt DATETIME2 NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID('dbo.IdentityConsents', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.IdentityConsents (
        id INT IDENTITY(1,1) PRIMARY KEY,
        userId INT NOT NULL,
        purpose NVARCHAR(40) NOT NULL,
        documentType NVARCHAR(30) NULL,
        granted BIT NOT NULL DEFAULT 1,
        noticeVersion NVARCHAR(20) NULL,
        grantedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        withdrawnAt DATETIME2 NULL
    );
END
GO

IF OBJECT_ID('dbo.IdentityBreachIncidents', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.IdentityBreachIncidents (
        id INT IDENTITY(1,1) PRIMARY KEY,
        summary NVARCHAR(2000) NOT NULL,
        detectedAt DATETIME2 NOT NULL,
        reportedBy INT NULL,
        userCount INT NOT NULL DEFAULT 0,
        usersNotified INT NOT NULL DEFAULT 0,
        usersNotifiedAt DATETIME2 NULL,
        dpbiDeadline DATETIME2 NULL,
        status NVARCHAR(40) NOT NULL DEFAULT 'open',
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF COL_LENGTH('dbo.Passengers', 'foodPreference') IS NULL
BEGIN
    ALTER TABLE dbo.Passengers ADD foodPreference NVARCHAR(30) NULL;
END
GO

IF COL_LENGTH('dbo.Passengers', 'insuranceOptIn') IS NULL
BEGIN
    ALTER TABLE dbo.Passengers ADD insuranceOptIn BIT NOT NULL DEFAULT 0;
END
GO

IF COL_LENGTH('dbo.Passengers', 'isSeniorCitizen') IS NULL
BEGIN
    ALTER TABLE dbo.Passengers ADD isSeniorCitizen BIT NOT NULL DEFAULT 0;
END
GO

IF COL_LENGTH('dbo.Passengers', 'isDivyang') IS NULL
BEGIN
    ALTER TABLE dbo.Passengers ADD isDivyang BIT NOT NULL DEFAULT 0;
END
GO

IF COL_LENGTH('dbo.Stations', 'platformCount') IS NULL
BEGIN
    ALTER TABLE dbo.Stations ADD platformCount INT NULL;
END
GO

IF COL_LENGTH('dbo.Stations', 'amenities') IS NULL
BEGIN
    ALTER TABLE dbo.Stations ADD amenities NVARCHAR(MAX) NULL;
END
GO

IF OBJECT_ID('dbo.Notifications', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Notifications (
        id INT IDENTITY(1,1) PRIMARY KEY,
        userId INT NOT NULL,
        type NVARCHAR(40) NOT NULL,
        title NVARCHAR(150) NOT NULL,
        message NVARCHAR(500) NOT NULL,
        meta NVARCHAR(MAX) NULL,
        isRead BIT NOT NULL DEFAULT 0,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID('dbo.SupportTickets', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SupportTickets (
        id INT IDENTITY(1,1) PRIMARY KEY,
        userId INT NULL,
        subject NVARCHAR(200) NOT NULL,
        category NVARCHAR(50) NOT NULL,
        message NVARCHAR(MAX) NOT NULL,
        status NVARCHAR(20) NOT NULL DEFAULT 'Open',
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID('dbo.AuditLogs', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AuditLogs (
        id INT IDENTITY(1,1) PRIMARY KEY,
        userId INT NULL,
        action NVARCHAR(100) NOT NULL,
        resource NVARCHAR(100) NULL,
        details NVARCHAR(MAX) NULL,
        ipAddress NVARCHAR(45) NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID('dbo.FavoriteRoutes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.FavoriteRoutes (
        id INT IDENTITY(1,1) PRIMARY KEY,
        userId INT NOT NULL,
        sourceCode NVARCHAR(10) NOT NULL,
        destinationCode NVARCHAR(10) NOT NULL,
        label NVARCHAR(100) NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID('dbo.UserPreferences', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.UserPreferences (
        userId INT PRIMARY KEY,
        notifyBooking BIT NOT NULL DEFAULT 1,
        notifyRefund BIT NOT NULL DEFAULT 1,
        notifyDelay BIT NOT NULL DEFAULT 1,
        notifyChart BIT NOT NULL DEFAULT 1,
        gstNumber NVARCHAR(20) NULL,
        gstBusinessName NVARCHAR(150) NULL,
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID('dbo.UserDevices', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.UserDevices (
        id INT IDENTITY(1,1) PRIMARY KEY,
        userId INT NOT NULL,
        deviceLabel NVARCHAR(100) NOT NULL,
        userAgent NVARCHAR(300) NULL,
        lastSeenAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

-- Extended IRCTC schema
IF COL_LENGTH('dbo.Users', 'mfaSecret') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD mfaSecret NVARCHAR(64) NULL;
END
GO

IF COL_LENGTH('dbo.Bookings', 'chartPrepared') IS NULL
BEGIN
    ALTER TABLE dbo.Bookings ADD chartPrepared BIT NOT NULL DEFAULT 0;
END
GO

IF COL_LENGTH('dbo.Users', 'aadhaarVerified') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD aadhaarVerified BIT NOT NULL DEFAULT 0;
END
GO

IF COL_LENGTH('dbo.Users', 'aadhaarVerifiedAt') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD aadhaarVerifiedAt DATETIME2 NULL;
END
GO

IF COL_LENGTH('dbo.Stations', 'latitude') IS NULL
BEGIN
    ALTER TABLE dbo.Stations ADD latitude DECIMAL(9,6) NULL;
END
GO

IF COL_LENGTH('dbo.Stations', 'longitude') IS NULL
BEGIN
    ALTER TABLE dbo.Stations ADD longitude DECIMAL(9,6) NULL;
END
GO

IF OBJECT_ID('dbo.OAuthAccounts', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.OAuthAccounts (
        id INT IDENTITY(1,1) PRIMARY KEY,
        userId INT NOT NULL,
        provider NVARCHAR(20) NOT NULL,
        providerUserId NVARCHAR(100) NOT NULL,
        email NVARCHAR(150) NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_OAuthAccounts_Provider_User UNIQUE (provider, providerUserId)
    );
END
GO

IF OBJECT_ID('dbo.OtpCodes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.OtpCodes (
        id INT IDENTITY(1,1) PRIMARY KEY,
        phone NVARCHAR(15) NOT NULL,
        otpHash NVARCHAR(128) NOT NULL,
        expiresAt DATETIME2 NOT NULL,
        used BIT NOT NULL DEFAULT 0,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID('dbo.UserLoyalty', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.UserLoyalty (
        userId INT PRIMARY KEY,
        points INT NOT NULL DEFAULT 0,
        tier NVARCHAR(20) NOT NULL DEFAULT 'Silver',
        lifetimePoints INT NOT NULL DEFAULT 0,
        updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID('dbo.SavedPaymentMethods', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SavedPaymentMethods (
        id INT IDENTITY(1,1) PRIMARY KEY,
        userId INT NOT NULL,
        type NVARCHAR(20) NOT NULL,
        label NVARCHAR(100) NOT NULL,
        last4 NVARCHAR(4) NULL,
        isDefault BIT NOT NULL DEFAULT 0,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID('dbo.SupportChatMessages', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SupportChatMessages (
        id INT IDENTITY(1,1) PRIMARY KEY,
        userId INT NULL,
        sessionId NVARCHAR(64) NOT NULL,
        sender NVARCHAR(20) NOT NULL,
        message NVARCHAR(MAX) NOT NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID('dbo.SearchCache', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SearchCache (
        cacheKey NVARCHAR(200) PRIMARY KEY,
        payload NVARCHAR(MAX) NOT NULL,
        expiresAt DATETIME2 NOT NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID('dbo.IdempotencyKeys', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.IdempotencyKeys (
        idempotencyKey NVARCHAR(64) NOT NULL,
        userId INT NULL,
        route NVARCHAR(120) NOT NULL,
        statusCode INT NOT NULL,
        responseBody NVARCHAR(MAX) NOT NULL,
        expiresAt DATETIME2 NOT NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_IdempotencyKeys PRIMARY KEY (idempotencyKey, route)
    );
END
GO

IF OBJECT_ID('dbo.OutboxEvents', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.OutboxEvents (
        id INT IDENTITY(1,1) PRIMARY KEY,
        aggregateType NVARCHAR(40) NOT NULL,
        aggregateId INT NOT NULL,
        eventType NVARCHAR(60) NOT NULL,
        payload NVARCHAR(MAX) NOT NULL,
        status NVARCHAR(20) NOT NULL DEFAULT 'Pending',
        attempts INT NOT NULL DEFAULT 0,
        lastError NVARCHAR(500) NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        processedAt DATETIME2 NULL
    );
END
GO

IF OBJECT_ID('dbo.WebhookEvents', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.WebhookEvents (
        id INT IDENTITY(1,1) PRIMARY KEY,
        provider NVARCHAR(30) NOT NULL,
        eventId NVARCHAR(100) NOT NULL,
        eventType NVARCHAR(60) NOT NULL,
        payload NVARCHAR(MAX) NULL,
        processedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_WebhookEvents_Provider_Event UNIQUE (provider, eventId)
    );
END
GO

IF OBJECT_ID('dbo.ReconciliationLog', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ReconciliationLog (
        id INT IDENTITY(1,1) PRIMARY KEY,
        runType NVARCHAR(40) NOT NULL,
        matchedCount INT NOT NULL DEFAULT 0,
        mismatchCount INT NOT NULL DEFAULT 0,
        autoFixedCount INT NOT NULL DEFAULT 0,
        details NVARCHAR(MAX) NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF COL_LENGTH('dbo.Bookings', 'idempotencyKey') IS NULL
BEGIN
    ALTER TABLE dbo.Bookings ADD idempotencyKey NVARCHAR(64) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Bookings_JourneyDate')
BEGIN
    CREATE INDEX IX_Bookings_JourneyDate ON dbo.Bookings(journeyDate);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Bookings_Status_Payment')
BEGIN
    CREATE INDEX IX_Bookings_Status_Payment ON dbo.Bookings(status, paymentStatus);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_OutboxEvents_Status')
BEGIN
    CREATE INDEX IX_OutboxEvents_Status ON dbo.OutboxEvents(status, createdAt);
END
GO
