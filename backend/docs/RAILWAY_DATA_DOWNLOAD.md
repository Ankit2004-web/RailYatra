# Railway Data Download Guide

## Data classification

| Priority | Source | Status |
|----------|--------|--------|
| **1 — Official OGD** | [data.gov.in — Indian Railways Train Time Table](https://www.data.gov.in/catalog/indian-railways-train-time-table) | Catalog updated **2018**; direct API/download often requires browser/API key |
| **2 — Official IR public** | [indianrail.gov.in](https://indianrail.gov.in/) | Static public pages only — **do not scrape** protected systems |
| **3 — Open development** | [datameet/railways](https://github.com/datameet/railways) (CC0) | **Imported by this project** — ~5208 trains, ~8990 stations, ~417k stops |

## What we actually imported

### DataMeet Indian Railways JSON (CC0)

| Field | Value |
|-------|-------|
| **Publisher** | DataMeet Community |
| **URL** | https://github.com/datameet/railways |
| **License** | CC0 (public domain dedication) |
| **Dataset era** | ~2016 compilation |
| **Official?** | **NO** — community-compiled from public sources |
| **Complete?** | **PARTIAL** — reservation-style trains only |
| **Current?** | **POTENTIALLY OUTDATED** |

### Missing from DataMeet source (left NULL — not fabricated)

- Running days (day-of-week)
- Per-stop distance (only train total distance)
- Platform numbers
- Halt duration (computed where arr/dep both present)

## Automatic download + import

```bash
npm run download:railway    # downloads JSON to data/railway/raw/
npm run import:datameet     # sync schema + bulk import (~10–30 min)
```

## Manual official OGD download (when portal works)

1. Open https://www.data.gov.in/catalog/indian-railways-train-time-table
2. Click **Zip Download** on the desired resource (e.g. timetable as on 01.11.2017)
3. Extract CSV to `data/railway/raw/ogd/`
4. Normalize columns to match `docs/RAILWAY_DATA_IMPORT.md`
5. Extend `RailwayDataImporter.js` or add `OgdTimetableParser.js`
6. Run `npm run import:railway -- --dir data/railway/processed`

### OGD API (optional)

Register at data.gov.in → Profile → API Key, then:

```
https://data.gov.in/api/datastore/export/csv?resource_id=RESOURCE_ID&api-key=YOUR_KEY
```

Replace `RESOURCE_ID` from the resource page metadata.

## Files after download

```
data/railway/raw/
  datameet-stations.json   (~1.8 MB, 8990 stations)
  datameet-trains.json     (~14 MB, 5208 trains)
  datameet-schedules.json  (~78 MB, 417080 stop records)
  RailwayDataImportReport.json  (generated after import)
```

## Do NOT

- Scrape IRCTC or authenticated endpoints
- Bypass CAPTCHA
- Claim DataMeet or 2018 OGD data is the current official nationwide timetable
