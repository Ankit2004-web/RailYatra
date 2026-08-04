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
