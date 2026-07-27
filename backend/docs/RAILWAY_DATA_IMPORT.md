# Railway Data Import Guide

## Policy

- Import only from **Government of India Open Data**, **Ministry of Railways public datasets**, or **files you manually provide and verify**.
- **Do not** scrape IRCTC or private endpoints.
- **Do not** commit large raw datasets to git — use `data/railway/raw/` locally.

## Current bundled dataset

The repository includes a **DEVELOPMENT / TEST** dataset in `data/railway/processed/`:

| File | Rows (approx) | Notes |
|------|---------------|-------|
| `states.csv` | 14 | Representative Indian states/UTs |
| `stations.csv` | 24 | Major + DEVA–DEVE test stations |
| `trains.csv` | 8 | Includes spec train **10001** |
| `train_stops.csv` | 31 | Multi-stop routes with day offsets |
| `train_classes.csv` | 19 | Class availability per train |

**This is NOT official Indian Railways timetable data.**

## Folder layout

```
data/railway/
  raw/         ← downloaded open-government files (gitignored)
  processed/   ← normalized CSV for importer
  archive/     ← previous snapshots
  RailwayDataImportReport.json  ← generated after import
```

## Commands

```bash
# Apply schema (base + master-data extensions)
npm run db:sync

# Import processed CSVs (idempotent upsert)
npm run import:railway

# Custom directory
node database/import/run-import.js --dir path/to/csv/folder

# Link legacy seed data to normalized columns
npm run db:migrate-master

# Full setup: sync + seed + auto migrate
npm run db:setup
```

## Import order (automatic)

1. States  
2. Cities (if CSV present)  
3. Railway zones (if CSV present)  
4. Stations  
5. Train types (if CSV present)  
6. Trains  
7. Running days  
8. Train stops / schedules  
9. Train classes  
10. Fare rule seed (if empty)

## CSV column reference

### `states.csv`
`code,name,isUnionTerritory`

### `stations.csv`
`code,name,city,state,zoneCode,latitude,longitude,isJunction,isActive`

### `trains.csv`
`trainNumber,trainName,trainTypeCode,sourceCode,destinationCode,runningDays,isActive`

`runningDays`: `Daily`, `Mon`, `Mon,Wed,Fri`, or `1234567` (ISO Mon=1)

### `train_stops.csv`
`trainNumber,stopSequence,stationCode,arrivalTime,departureTime,arrivalDayOffset,departureDayOffset,haltMinutes,distanceKm`

### `train_classes.csv`
`trainNumber,classCode,isAvailable,defaultCoachCount,defaultSeatCapacity`

## Idempotent upsert keys

| Entity | Natural key |
|--------|-------------|
| Station | `code` |
| Train | `trainNumber` |
| Train stop | `trainNumber` + `stopSequence` |
| Running day | `trainId` + `dayOfWeek` |
| Train class | `trainId` + `classCode` |

Running import twice must **not** duplicate records.

## Validation report

After import, see:

- `data/railway/RailwayDataImportReport.json`
- Console summary (inserted / updated / skipped / failed)
- `GET /api/admin/data-import/status` (admin auth required)

## Provenance registry

Each import creates/updates `DataImportSources`:

| Field | Description |
|-------|-------------|
| `sourceName` | Dataset name |
| `sourceUrl` | Download URL if applicable |
| `publisher` | e.g. data.gov.in |
| `datasetVersion` | Version string |
| `downloadedAt` | When file was obtained |
| `importedAt` | When import ran |
| `fileHash` | SHA-256 of combined files (when available) |
| `recordCount` | Total rows processed |
| `status` | Success / Partial / Failed |
| `notes` | License, warnings |

## Obtaining legitimate nationwide data

1. Search [data.gov.in](https://data.gov.in) for railway station/train datasets.
2. Verify **license** and **update frequency**.
3. Download to `data/railway/raw/`.
4. Normalize columns to match processed format (or extend parsers in `database/import/`).
5. Run import and review report.

If automatic download URLs are unstable, document manual steps only — do not scrape.

## Troubleshooting

| Issue | Action |
|-------|--------|
| `Station not found for code X` | Import stations before train_stops; check code spelling |
| Duplicate train on re-import | Should update, not insert — check `trainNumber` uniqueness |
| Search returns empty | Run `npm run db:migrate-master`; verify `TrainStops.stationId` populated |
| SQL connection failed | Ensure LocalDB/SQL Server running; check `database/connection.js` |
| Invalid stop order | Importer logs error; source must not be after destination on route |

## Optional download script

If a stable open-data URL is identified, add `scripts/download-railway-data.ps1` that downloads **only** authorized files to `data/railway/raw/`. Never bypass authentication or rate limits.
