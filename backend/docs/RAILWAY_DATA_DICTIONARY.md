# Railway Data Dictionary

## States

| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | Surrogate key |
| code | NVARCHAR(10) | Optional state code |
| name | NVARCHAR(100) | State/UT name (unique) |
| isUnionTerritory | BIT | UT flag |
| createdAt, updatedAt | DATETIME2 | Audit |

## Cities

| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| name | NVARCHAR(100) | City name |
| stateId | INT FK → States | |
| latitude, longitude | DECIMAL | Optional coordinates |

## RailwayZones

| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| code | NVARCHAR(10) | e.g. NR, WR (unique) |
| name | NVARCHAR(100) | Zone name |
| headquarters | NVARCHAR(100) | Optional HQ city |

## Stations

| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| code | NVARCHAR(10) | **Unique** station code (NDLS) |
| name | NVARCHAR(150) | Display name |
| normalizedName | NVARCHAR(150) | Lowercase trimmed for search |
| cityId | INT FK | Optional |
| stateId | INT FK | Optional |
| zoneId | INT FK | Optional |
| city, state | NVARCHAR | Legacy text columns (seed compat) |
| latitude, longitude, elevation | | Optional |
| isJunction | BIT | Junction flag |
| isActive | BIT | Active for search |

**Indexes:** unique on `code`; indexes on `normalizedName`, `stateId`, `cityId`, `zoneId`.

## TrainTypes

| Column | Type | Description |
|--------|------|-------------|
| code | NVARCHAR(20) | RAJ, SF, EXP, etc. |
| name | NVARCHAR(100) | Rajdhani, Superfast, … |

## Trains

| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| trainNumber | NVARCHAR(10) | **Unique** service number |
| trainName | NVARCHAR(200) | |
| normalizedName | NVARCHAR(200) | Search helper |
| trainTypeId | INT FK | Optional |
| sourceStationId | INT FK | First stop (expected) |
| destinationStationId | INT FK | Last stop (expected) |
| source, destination | NVARCHAR | Legacy text (compat) |
| isActive | BIT | |
| dataSourceId | INT FK → DataImportSources | Provenance |
| runningDays | NVARCHAR | Legacy string; prefer TrainRunningDays |
| journeyDate | DATE | Legacy demo field |
| departureTime, arrivalTime | NVARCHAR | Legacy summary times |

## TrainRunningDays

| Column | Type | Description |
|--------|------|-------------|
| trainId | INT FK | |
| dayOfWeek | TINYINT | 1=Monday … 7=Sunday (ISO) |
| runs | BIT | 1 if train runs that day from source |

**Unique:** `(trainId, dayOfWeek)`

## TrainStops (critical)

| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| trainId | INT FK | |
| stationId | INT FK | Resolved station |
| stationCode, stationName | NVARCHAR | Denormalized / legacy |
| stopOrder | INT | Sequence along route (1-based) |
| arrivalTime | NVARCHAR(5) | HH:mm or null at origin |
| departureTime | NVARCHAR(5) | HH:mm or null at destination |
| arrivalDayOffset | INT | Days after source departure |
| departureDayOffset | INT | Days after source departure |
| haltMinutes | INT | Optional |
| distanceKm | INT | Cumulative from source |

**Unique:** `(trainId, stopOrder)`

## TravelClasses

| Column | Type | Description |
|--------|------|-------------|
| code | NVARCHAR(5) | 1A, 2A, 3A, SL, CC, EC, 2S, 3E |
| name | NVARCHAR(50) | Display name |

## TrainClasses

| Column | Type | Description |
|--------|------|-------------|
| trainId | INT FK | |
| classCode | NVARCHAR(5) | Legacy code column |
| travelClassId | INT FK | Optional normalized FK |
| isAvailable | BIT | |
| price | DECIMAL | Legacy demo price |
| totalSeats, availableSeats | INT | Legacy inventory |

## Quotas

| Column | Type | Description |
|--------|------|-------------|
| code | NVARCHAR(10) | GN, TQ, LD, SS |
| name | NVARCHAR(50) | General, Tatkal, … |

## DataImportSources

| Column | Type | Description |
|--------|------|-------------|
| sourceName | NVARCHAR(200) | |
| sourceUrl | NVARCHAR(500) | |
| publisher | NVARCHAR(200) | |
| datasetVersion | NVARCHAR(50) | |
| downloadedAt, importedAt | DATETIME2 | |
| fileHash | NVARCHAR(64) | SHA-256 |
| recordCount | INT | |
| status | NVARCHAR(50) | |
| notes | NVARCHAR(MAX) | License / warnings |

## FareRules (simulation)

| Column | Type | Description |
|--------|------|-------------|
| travelClassId | INT FK | |
| trainTypeId | INT FK | Optional override |
| baseRatePerKm | DECIMAL | |
| minimumFare | DECIMAL | |
| reservationCharge | DECIMAL | |
| superfastCharge | DECIMAL | |
| effectiveFrom, effectiveTo | DATE | |

## TrainSegmentFares (future exact fares)

| Column | Type | Description |
|--------|------|-------------|
| trainId, fromStationId, toStationId | INT FK | Segment |
| travelClassId, quotaId | INT FK | |
| fare | DECIMAL | Authorized amount |
| effectiveFrom, effectiveTo | DATE | |
| sourceId | INT FK | DataImportSources |

## TrainJourneys

| Column | Type | Description |
|--------|------|-------------|
| trainId | INT FK | |
| sourceDepartureDate | DATE | Unique with trainId |
| status | NVARCHAR(20) | Scheduled, Cancelled, Completed |

## JourneyCoaches / JourneySeats

Per-journey physical inventory scaffold for segment allocation.

## Bookings (extended)

| Column | Type | Description |
|--------|------|-------------|
| pnr | NVARCHAR(10) | Unique |
| trainJourneyId | INT FK | Optional future link |
| fromStationId, toStationId | INT FK | Boarding/alighting |
| travelClassId, quotaId | INT FK | |
| bookingStatus, paymentStatus | NVARCHAR | |

## BookingSeatAllocations

| Column | Type | Description |
|--------|------|-------------|
| bookingPassengerId | INT FK | |
| journeySeatId | INT FK | |
| fromStopSequence | INT | Inclusive |
| toStopSequence | INT | Exclusive |
| bookingStatus | NVARCHAR | |

## BookingCancellations / Refunds / Payments

Standard audit tables for cancellation charges and refund processing.
