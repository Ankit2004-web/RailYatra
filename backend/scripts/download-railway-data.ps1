# Download legitimate railway datasets for import
param(
    [ValidateSet('datameet', 'manual')]
    [string]$Target = 'datameet'
)

$rawDir = Join-Path $PSScriptRoot "..\..\database\data\railway\raw"
New-Item -ItemType Directory -Force -Path $rawDir | Out-Null

if ($Target -eq 'datameet') {
    Write-Host "Downloading DataMeet Indian Railways JSON (CC0)"
    Write-Host "Source: https://github.com/datameet/railways"
    Write-Host "License: CC0 — community dataset, NOT official current IR timetable"
    Write-Host ""

    $files = @{
        "datameet-stations.json" = "https://raw.githubusercontent.com/datameet/railways/master/stations.json"
        "datameet-trains.json"   = "https://raw.githubusercontent.com/datameet/railways/master/trains.json"
        "datameet-schedules.json" = "https://raw.githubusercontent.com/datameet/railways/master/schedules.json"
    }

    foreach ($entry in $files.GetEnumerator()) {
        $out = Join-Path $rawDir $entry.Key
        if (Test-Path $out) {
            Write-Host "  Skip (exists): $($entry.Key)"
            continue
        }
        Write-Host "  Downloading $($entry.Key)..."
        curl.exe -L -m 600 -o $out $entry.Value
        if ($LASTEXITCODE -ne 0) { Write-Error "Failed: $($entry.Key)"; exit 1 }
    }
    Write-Host "Download complete."
    exit 0
}

Write-Host @"
Manual download instructions
============================
Official OGD (Ministry of Railways) — POTENTIALLY OUTDATED (last catalog update 2018):
  https://www.data.gov.in/catalog/indian-railways-train-time-table

1. Visit the catalog page and download the ZIP/CSV manually (site may require browser).
2. Place extracted CSV files in: $rawDir
3. Normalize columns per docs/RAILWAY_DATA_DOWNLOAD.md
4. Run: npm run import:railway

Do NOT scrape IRCTC or private endpoints.
"@
