using System.Diagnostics;
using System.Text.Json;
using EFCore.BulkExtensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RailYatra.Domain.Entities;
using RailYatra.Domain.Enums;
using RailYatra.Domain.Interfaces;
using RailYatra.Infrastructure.Persistence;

namespace RailYatra.Infrastructure.Etl;

public class DatameetRailwayImportService(
    RailwayDbContext db,
    IImportRepository importRepo,
    IRailwayDataDownloader downloader,
    IOptions<RailwayImportOptions> options,
    ILogger<DatameetRailwayImportService> logger) : IRailwayImportService
{
    private readonly List<string> _errors = [];

    public Task<ImportLog> RunFullImportAsync(CancellationToken ct = default)
        => RunImportAsync(ImportMode.Full, forceDownload: true, ct);

    public async Task<ImportLog> RunIncrementalImportAsync(CancellationToken ct = default)
    {
        var rawDir = ResolveRawDirectory();
        if (!HasRequiredFiles(rawDir))
            await downloader.DownloadAsync(rawDir, ct);

        var hash = DatameetDataDownloader.ComputeDirectoryHash(rawDir);
        var existing = await db.DataVersion.AsNoTracking()
            .FirstOrDefaultAsync(v => v.FileHash == hash, ct);

        if (existing is not null)
        {
            logger.LogInformation("Incremental import skipped — dataset hash unchanged ({Hash})", hash);
            return await importRepo.StartLogAsync(new ImportLog
            {
                ImportType = ImportMode.Incremental,
                Status = ImportStatus.Completed,
                StartedAt = DateTime.UtcNow,
                CompletedAt = DateTime.UtcNow,
                Message = "No changes detected — import skipped",
                SkippedCount = 1
            }, ct);
        }

        return await RunImportAsync(ImportMode.Incremental, forceDownload: false, ct);
    }

    private async Task<ImportLog> RunImportAsync(string mode, bool forceDownload, CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();
        var rawDir = ResolveRawDirectory();
        if (forceDownload || !HasRequiredFiles(rawDir))
            await downloader.DownloadAsync(rawDir, ct);

        var hash = DatameetDataDownloader.ComputeDirectoryHash(rawDir);
        var cfg = options.Value.DataMeet;
        var versionTag = $"datameet-{DateTime.UtcNow:yyyyMMdd-HHmmss}";

        var version = await importRepo.CreateDataVersionAsync(new DataVersion
        {
            VersionTag = versionTag,
            SourceName = cfg.Name,
            SourceUrl = cfg.BaseUrl,
            Publisher = cfg.Publisher,
            LicenseNotes = cfg.LicenseNotes,
            DatasetVersion = cfg.DatasetVersion,
            FileHash = hash,
            ImportMode = mode,
            IsActive = false,
            ImportedAt = DateTime.UtcNow,
            Notes = "Running days and per-stop distance not in source — left null"
        }, ct);

        var log = await importRepo.StartLogAsync(new ImportLog
        {
            DataVersionId = version.Id,
            ImportType = mode,
            Status = ImportStatus.Started,
            StartedAt = DateTime.UtcNow,
            SourceFile = rawDir
        }, ct);

        var inserted = 0;
        var updated = 0;
        var skipped = 0;
        var deleted = 0;

        try
        {
            await EnsureReferenceDataAsync(ct);
            await using var tx = await db.Database.BeginTransactionAsync(ct);

            var stationMap = await ImportStationsAsync(rawDir, version.Id, ct);
            var trainMap = await ImportTrainsAsync(rawDir, stationMap, version.Id, ct);
            var routeCount = await ImportRoutesAsync(rawDir, stationMap, trainMap, version.Id, ct);
            deleted = await DeactivateMissingTrainsAsync(version.Id, ct);

            version.StationCount = stationMap.Count;
            version.TrainCount = trainMap.Count;
            version.RouteCount = routeCount;
            db.DataVersion.Update(version);
            await db.SaveChangesAsync(ct);
            await importRepo.ActivateDataVersionAsync(version.Id, ct);
            await tx.CommitAsync(ct);

            inserted = log.InsertedCount;
            updated = log.UpdatedCount;
            skipped = log.SkippedCount;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Railway import failed");
            _errors.Add(ex.Message);
            log.Status = ImportStatus.Failed;
            log.ErrorDetails = string.Join("\n", _errors.Take(100));
            log.Message = ex.Message;
            sw.Stop();
            log.ExecutionTimeMs = sw.ElapsedMilliseconds;
            log.CompletedAt = DateTime.UtcNow;
            log.ErrorCount = _errors.Count;
            await importRepo.CompleteLogAsync(log.Id, log, ct);
            throw;
        }

        sw.Stop();
        log.Status = _errors.Count > 0 ? ImportStatus.Partial : ImportStatus.Completed;
        log.ExecutionTimeMs = sw.ElapsedMilliseconds;
        log.CompletedAt = DateTime.UtcNow;
        log.InsertedCount = inserted;
        log.UpdatedCount = updated;
        log.SkippedCount = skipped;
        log.DeletedCount = deleted;
        log.ErrorCount = _errors.Count;
        log.Message = $"Imported {trainMapSafeCount(version)} trains from {cfg.Name}";
        log.ErrorDetails = _errors.Count > 0 ? string.Join("\n", _errors.Take(200)) : null;
        await importRepo.CompleteLogAsync(log.Id, log, ct);
        return log;
    }

    private static int trainMapSafeCount(DataVersion v) => v.TrainCount ?? 0;

    private string ResolveRawDirectory()
    {
        var path = options.Value.RawDataDirectory;
        if (Path.IsPathRooted(path)) return path;
        return Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, path));
    }

    private static bool HasRequiredFiles(string dir)
        => File.Exists(Path.Combine(dir, "datameet-stations.json"))
           && File.Exists(Path.Combine(dir, "datameet-trains.json"))
           && File.Exists(Path.Combine(dir, "datameet-schedules.json"));

    private async Task EnsureReferenceDataAsync(CancellationToken ct)
    {
        if (!await db.TrainTypes.AnyAsync(ct))
        {
            db.TrainTypes.AddRange(
                new TrainType { Code = "RAJ", Name = "Rajdhani" },
                new TrainType { Code = "SHAT", Name = "Shatabdi" },
                new TrainType { Code = "DUR", Name = "Duronto" },
                new TrainType { Code = "VB", Name = "Vande Bharat" },
                new TrainType { Code = "SF", Name = "Superfast" },
                new TrainType { Code = "EXP", Name = "Express" },
                new TrainType { Code = "PASS", Name = "Passenger" });
            await db.SaveChangesAsync(ct);
        }
    }

    private async Task<Dictionary<string, int>> ImportStationsAsync(string rawDir, int versionId, CancellationToken ct)
    {
        var json = await File.ReadAllTextAsync(Path.Combine(rawDir, "datameet-stations.json"), ct);
        using var doc = JsonDocument.Parse(json);
        var map = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        foreach (var feature in doc.RootElement.GetProperty("features").EnumerateArray())
        {
            var props = feature.GetProperty("properties");
            var code = RailwayNormalizer.NormalizeCode(props.GetProperty("code").GetString());
            var name = RailwayNormalizer.NormalizeName(props.GetProperty("name").GetString());
            if (code is null || name is null) continue;

            var state = props.TryGetProperty("state", out var st) ? RailwayNormalizer.NormalizeName(st.GetString()) : null;
            var zoneCode = props.TryGetProperty("zone", out var z) ? RailwayNormalizer.NormalizeCode(z.GetString()) : null;
            int? zoneId = null;
            if (zoneCode is not null)
            {
                var zone = await db.Zones.FirstOrDefaultAsync(x => x.Code == zoneCode, ct);
                if (zone is null)
                {
                    zone = new Zone { Code = zoneCode, Name = zoneCode };
                    db.Zones.Add(zone);
                    await db.SaveChangesAsync(ct);
                }
                zoneId = zone.Id;
            }

            decimal? lat = null, lng = null;
            if (feature.TryGetProperty("geometry", out var geom)
                && geom.TryGetProperty("coordinates", out var coords)
                && coords.GetArrayLength() >= 2)
            {
                lng = coords[0].GetDecimal();
                lat = coords[1].GetDecimal();
            }

            var city = props.TryGetProperty("address", out var addr)
                ? RailwayNormalizer.NormalizeName(addr.GetString()?.Split(',')[0]) ?? name
                : name;

            var existing = await db.Stations.FirstOrDefaultAsync(s => s.Code == code, ct);
            if (existing is null)
            {
                existing = new Station
                {
                    Code = code,
                    Name = name,
                    City = city[..Math.Min(city.Length, 120)],
                    State = state ?? "",
                    NormalizedName = name.ToLowerInvariant(),
                    ZoneId = zoneId,
                    Latitude = lat,
                    Longitude = lng,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                db.Stations.Add(existing);
                await db.SaveChangesAsync(ct);
            }
            else
            {
                existing.Name = name;
                existing.City = city[..Math.Min(city.Length, 120)];
                existing.State = state ?? existing.State;
                existing.NormalizedName = name.ToLowerInvariant();
                existing.ZoneId = zoneId ?? existing.ZoneId;
                existing.Latitude = lat ?? existing.Latitude;
                existing.Longitude = lng ?? existing.Longitude;
                existing.IsActive = true;
                existing.UpdatedAt = DateTime.UtcNow;
                await db.SaveChangesAsync(ct);
            }

            map[code] = existing.Id;
        }

        return map;
    }

    private async Task<Dictionary<string, int>> ImportTrainsAsync(
        string rawDir, Dictionary<string, int> stationMap, int versionId, CancellationToken ct)
    {
        var json = await File.ReadAllTextAsync(Path.Combine(rawDir, "datameet-trains.json"), ct);
        using var doc = JsonDocument.Parse(json);
        var typeMap = await db.TrainTypes.ToDictionaryAsync(t => t.Code, t => t.Id, ct);
        var map = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        foreach (var feature in doc.RootElement.GetProperty("features").EnumerateArray())
        {
            var p = feature.GetProperty("properties");
            var trainNumber = RailwayNormalizer.NormalizeTrainNumber(p.GetProperty("number").GetString());
            var trainName = RailwayNormalizer.NormalizeName(p.GetProperty("name").GetString());
            var srcCode = RailwayNormalizer.NormalizeCode(p.GetProperty("from_station_code").GetString());
            var dstCode = RailwayNormalizer.NormalizeCode(p.GetProperty("to_station_code").GetString());

            if (trainNumber is null || trainName is null || srcCode is null || dstCode is null) continue;
            if (!stationMap.TryGetValue(srcCode, out var srcId) || !stationMap.TryGetValue(dstCode, out var dstId))
            {
                _errors.Add($"Train {trainNumber}: unknown station {srcCode}/{dstCode}");
                continue;
            }

            var src = await db.Stations.AsNoTracking().FirstAsync(s => s.Id == srcId, ct);
            var dst = await db.Stations.AsNoTracking().FirstAsync(s => s.Id == dstId, ct);
            var typeCode = RailwayNormalizer.MapTrainTypeCode(p.TryGetProperty("type", out var tp) ? tp.GetString() : null);
            typeMap.TryGetValue(typeCode, out var typeId);

            var dep = RailwayNormalizer.NormalizeTime(p.TryGetProperty("departure", out var d) ? d.GetString() : null) ?? "00:00";
            var arr = RailwayNormalizer.NormalizeTime(p.TryGetProperty("arrival", out var a) ? a.GetString() : null) ?? "00:00";
            var durH = RailwayNormalizer.ParseInt(p.TryGetProperty("duration_h", out var dh) ? dh.GetString() : null) ?? 0;
            var durM = RailwayNormalizer.ParseInt(p.TryGetProperty("duration_m", out var dm) ? dm.GetString() : null) ?? 0;
            var distance = RailwayNormalizer.ParseInt(p.TryGetProperty("distance", out var dist) ? dist.GetString() : null);
            var journeyMin = RailwayNormalizer.JourneyMinutes(dep, arr, durH, durM);

            var superfast = typeCode is "SF" or "RAJ" or "SHAT" or "DUR" or "VB";
            var pantry = p.TryGetProperty("pantry", out var pan) && pan.ValueKind == JsonValueKind.True ? true : (bool?)null;
            var reservation = p.TryGetProperty("classes", out _) ? true : (bool?)null;

            var existing = await db.TrainMaster
                .FirstOrDefaultAsync(t => t.TrainNumber == trainNumber && t.DataVersionId == versionId, ct);

            if (existing is null)
            {
                existing = new TrainMaster
                {
                    TrainNumber = trainNumber,
                    TrainName = trainName,
                    NormalizedName = trainName.ToLowerInvariant(),
                    TrainTypeId = typeId == 0 ? null : typeId,
                    SourceStationId = srcId,
                    SourceStationCode = src.Code,
                    SourceStationName = src.Name,
                    DestinationStationId = dstId,
                    DestinationStationCode = dst.Code,
                    DestinationStationName = dst.Name,
                    DepartureTimeFromSource = dep,
                    ArrivalTimeAtDestination = arr,
                    TotalDistanceKm = distance,
                    TotalJourneyMinutes = journeyMin,
                    TrainStatus = TrainStatus.Active,
                    PantryAvailable = pantry,
                    ReservationAvailable = reservation,
                    SuperfastFlag = superfast,
                    DataVersionId = versionId,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                db.TrainMaster.Add(existing);
            }
            else
            {
                existing.TrainName = trainName;
                existing.TrainTypeId = typeId == 0 ? null : typeId;
                existing.TotalDistanceKm = distance;
                existing.TotalJourneyMinutes = journeyMin;
                existing.SuperfastFlag = superfast;
                existing.UpdatedAt = DateTime.UtcNow;
            }

            await db.SaveChangesAsync(ct);
            map[trainNumber] = existing.Id;
        }

        return map;
    }

    private async Task<int> ImportRoutesAsync(
        string rawDir, Dictionary<string, int> stationMap, Dictionary<string, int> trainMap, int versionId, CancellationToken ct)
    {
        var json = await File.ReadAllTextAsync(Path.Combine(rawDir, "datameet-schedules.json"), ct);
        var schedules = JsonSerializer.Deserialize<List<ScheduleRow>>(json) ?? [];
        var byTrain = schedules
            .Where(s => trainMap.ContainsKey(RailwayNormalizer.NormalizeTrainNumber(s.train_number) ?? ""))
            .GroupBy(s => RailwayNormalizer.NormalizeTrainNumber(s.train_number)!)
            .ToDictionary(g => g.Key, g => g.OrderBy(x => x.id).ToList());

        var allRoutes = new List<TrainRoute>();
        var allDistances = new List<RouteDistance>();
        var batchSize = options.Value.RouteBatchSize;

        foreach (var (trainNumber, rows) in byTrain)
        {
            var trainMasterId = trainMap[trainNumber];
            var existingRoutes = await db.TrainRoutes.Where(r => r.TrainMasterId == trainMasterId).ToListAsync(ct);
            if (existingRoutes.Count > 0)
                db.TrainRoutes.RemoveRange(existingRoutes);

            var train = await db.TrainMaster.AsNoTracking().FirstAsync(t => t.Id == trainMasterId, ct);
            TrainRoute? prev = null;

            for (var i = 0; i < rows.Count; i++)
            {
                var row = rows[i];
                var code = RailwayNormalizer.NormalizeCode(row.station_code);
                if (code is null || !stationMap.TryGetValue(code, out var stationId)) continue;

                var seq = i + 1;
                var arr = RailwayNormalizer.NormalizeTime(row.arrival);
                var dep = RailwayNormalizer.NormalizeTime(row.departure);
                var day = (byte)Math.Max(1, (RailwayNormalizer.ParseInt(row.day) ?? 1));
                var halt = RailwayNormalizer.HaltMinutes(arr, dep);
                var isLast = seq == rows.Count;
                var dist = isLast ? train.TotalDistanceKm : null;

                var route = new TrainRoute
                {
                    TrainMasterId = trainMasterId,
                    TrainNumber = trainNumber,
                    StationSequence = seq,
                    StationId = stationId,
                    StationCode = code,
                    StationName = RailwayNormalizer.NormalizeName(row.station_name) ?? code,
                    ArrivalTime = arr,
                    DepartureTime = dep,
                    HaltMinutes = halt,
                    DayNumber = day,
                    DistanceFromSourceKm = dist,
                    PlatformNumber = null,
                    IsTechnicalHalt = false,
                    IsCommercialHalt = true,
                    DataVersionId = versionId,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                allRoutes.Add(route);

                if (prev is not null && dist.HasValue && prev.DistanceFromSourceKm.HasValue)
                {
                    allDistances.Add(new RouteDistance
                    {
                        TrainMasterId = trainMasterId,
                        FromStationId = prev.StationId,
                        ToStationId = stationId,
                        FromSequence = prev.StationSequence,
                        ToSequence = seq,
                        DistanceKm = dist - prev.DistanceFromSourceKm,
                        DataVersionId = versionId
                    });
                }

                prev = route;
            }
        }

        foreach (var batch in allRoutes.Chunk(batchSize))
            await db.BulkInsertAsync(batch.ToList(), cancellationToken: ct);

        foreach (var batch in allDistances.Chunk(batchSize))
            await db.BulkInsertAsync(batch.ToList(), cancellationToken: ct);

        return allRoutes.Count;
    }

    private async Task<int> DeactivateMissingTrainsAsync(int versionId, CancellationToken ct)
    {
        if (!options.Value.DeactivateMissingTrains) return 0;
        return await db.TrainMaster
            .Where(t => t.TrainStatus == TrainStatus.Active && t.DataVersionId != versionId)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.TrainStatus, TrainStatus.Inactive), ct);
    }

    private sealed class ScheduleRow
    {
        public int id { get; set; }
        public string train_number { get; set; } = "";
        public string station_code { get; set; } = "";
        public string? station_name { get; set; }
        public string? arrival { get; set; }
        public string? departure { get; set; }
        public string? day { get; set; }
    }
}
