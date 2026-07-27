using Microsoft.EntityFrameworkCore;
using RailYatra.Domain.Entities;
using RailYatra.Domain.Interfaces;
using RailYatra.Infrastructure.Persistence;

namespace RailYatra.Infrastructure.Repositories;

public class TrainRepository(RailwayDbContext db) : ITrainRepository
{
    public async Task<IReadOnlyList<TrainMaster>> GetActiveTrainsAsync(int skip, int take, CancellationToken ct = default)
        => await db.TrainMaster
            .AsNoTracking()
            .Include(t => t.TrainType)
            .Include(t => t.Zone)
            .Include(t => t.RunningDays)
            .Where(t => t.TrainStatus == "Active")
            .OrderBy(t => t.TrainNumber)
            .Skip(skip).Take(take)
            .ToListAsync(ct);

    public async Task<TrainMaster?> GetByTrainNumberAsync(string trainNumber, CancellationToken ct = default)
        => await db.TrainMaster
            .AsNoTracking()
            .Include(t => t.TrainType)
            .Include(t => t.Zone)
            .Include(t => t.RunningDays)
            .FirstOrDefaultAsync(t => t.TrainNumber == trainNumber && t.TrainStatus == "Active", ct);

    public async Task<IReadOnlyList<TrainRoute>> GetRouteAsync(string trainNumber, CancellationToken ct = default)
    {
        var train = await db.TrainMaster.AsNoTracking()
            .FirstOrDefaultAsync(t => t.TrainNumber == trainNumber && t.TrainStatus == "Active", ct);
        if (train is null) return [];

        return await db.TrainRoutes.AsNoTracking()
            .Where(r => r.TrainMasterId == train.Id)
            .OrderBy(r => r.StationSequence)
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<TrainSearchResult>> SearchBetweenStationsAsync(
        int fromStationId, int toStationId, DateOnly? date, CancellationToken ct = default)
    {
        var rows = await (
            from t in db.TrainMaster.AsNoTracking()
            join fs in db.TrainRoutes on t.Id equals fs.TrainMasterId
            join ts in db.TrainRoutes on t.Id equals ts.TrainMasterId
            join tt in db.TrainTypes on t.TrainTypeId equals tt.Id into ttj
            from tt in ttj.DefaultIfEmpty()
            where fs.StationId == fromStationId
                  && ts.StationId == toStationId
                  && fs.StationSequence < ts.StationSequence
                  && t.TrainStatus == "Active"
            orderby fs.DepartureTime
            select new
            {
                t.Id,
                t.TrainNumber,
                t.TrainName,
                TrainTypeCode = tt != null ? tt.Code : null,
                TrainTypeName = tt != null ? tt.Name : null,
                t.SuperfastFlag,
                FromCode = fs.StationCode,
                FromName = fs.StationName,
                ToCode = ts.StationCode,
                ToName = ts.StationName,
                DepartureTime = fs.DepartureTime,
                ArrivalTime = ts.ArrivalTime,
                FromSequence = fs.StationSequence,
                ToSequence = ts.StationSequence,
                FromDay = fs.DayNumber,
                ToDay = ts.DayNumber,
                FromDist = fs.DistanceFromSourceKm,
                ToDist = ts.DistanceFromSourceKm
            }).ToListAsync(ct);

        var results = new List<TrainSearchResult>();
        foreach (var row in rows)
        {
            var runningDays = await db.TrainRunningDays.AsNoTracking()
                .Where(d => d.TrainMasterId == row.Id && d.Runs)
                .Select(d => d.DayOfWeek)
                .ToListAsync(ct);

            if (date.HasValue && runningDays.Count > 0)
            {
                var isoDay = date.Value.DayOfWeek == DayOfWeek.Sunday ? (byte)7 : (byte)date.Value.DayOfWeek;
                if (!runningDays.Contains(isoDay)) continue;
            }

            var stops = await db.TrainRoutes.AsNoTracking()
                .Where(r => r.TrainMasterId == row.Id
                            && r.StationSequence > row.FromSequence
                            && r.StationSequence < row.ToSequence)
                .OrderBy(r => r.StationSequence)
                .Select(r => new TrainRouteStopDto
                {
                    Sequence = r.StationSequence,
                    StationCode = r.StationCode,
                    StationName = r.StationName,
                    ArrivalTime = r.ArrivalTime,
                    DepartureTime = r.DepartureTime,
                    HaltMinutes = r.HaltMinutes,
                    DayNumber = r.DayNumber,
                    DistanceFromSourceKm = r.DistanceFromSourceKm
                }).ToListAsync(ct);

            var distance = row.FromDist.HasValue && row.ToDist.HasValue ? row.ToDist - row.FromDist : null;
            results.Add(new TrainSearchResult
            {
                TrainMasterId = row.Id,
                TrainNumber = row.TrainNumber,
                TrainName = row.TrainName,
                TrainTypeCode = row.TrainTypeCode,
                TrainTypeName = row.TrainTypeName,
                FromStationCode = row.FromCode,
                FromStationName = row.FromName,
                ToStationCode = row.ToCode,
                ToStationName = row.ToName,
                DepartureTime = row.DepartureTime,
                ArrivalTime = row.ArrivalTime,
                JourneyMinutes = ComputeJourneyMinutes(row.DepartureTime, row.ArrivalTime, row.FromDay, row.ToDay),
                DistanceKm = distance,
                FromSequence = row.FromSequence,
                ToSequence = row.ToSequence,
                FromDayNumber = row.FromDay,
                ToDayNumber = row.ToDay,
                SuperfastFlag = row.SuperfastFlag,
                RunningDays = runningDays,
                IntermediateStops = stops
            });
        }

        return results;
    }

    public async Task<IReadOnlyList<TrainSearchResult>> SearchByRunningDayAsync(
        int fromStationId, int toStationId, DayOfWeek day, CancellationToken ct = default)
    {
        var isoDay = day == DayOfWeek.Sunday ? (byte)7 : (byte)day;
        var all = await SearchBetweenStationsAsync(fromStationId, toStationId, null, ct);
        return all.Where(r => r.RunningDays.Count == 0 || r.RunningDays.Contains(isoDay)).ToList();
    }

    private static int? ComputeJourneyMinutes(string? dep, string? arr, byte fromDay, byte toDay)
    {
        if (string.IsNullOrWhiteSpace(dep) || string.IsNullOrWhiteSpace(arr)) return null;
        if (!TimeSpan.TryParse(dep, out var d) || !TimeSpan.TryParse(arr, out var a)) return null;
        var dayDiff = toDay - fromDay;
        var minutes = (int)(a - d).TotalMinutes + dayDiff * 1440;
        return minutes >= 0 ? minutes : null;
    }
}
