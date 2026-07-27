using RailYatra.Application.DTOs;
using RailYatra.Domain.Interfaces;

namespace RailYatra.Application.Services;

public interface ITrainQueryService
{
    Task<IReadOnlyList<TrainSummaryDto>> GetTrainsAsync(int page, int pageSize, CancellationToken ct = default);
    Task<TrainDetailDto?> GetTrainAsync(string trainNumber, CancellationToken ct = default);
    Task<IReadOnlyList<RouteStopDto>> GetRouteAsync(string trainNumber, CancellationToken ct = default);
    Task<IReadOnlyList<SearchResultDto>> SearchAsync(string from, string to, DateOnly? date, CancellationToken ct = default);
    Task<IReadOnlyList<SearchResultDto>> SearchByDateAsync(string from, string to, DateOnly date, CancellationToken ct = default);
    Task<IReadOnlyList<SearchResultDto>> SearchByRunningDayAsync(string from, string to, DayOfWeek day, CancellationToken ct = default);
}

public interface IStationQueryService
{
    Task<StationDto?> GetStationAsync(string stationCode, CancellationToken ct = default);
}

public class TrainQueryService(ITrainRepository trains, IStationRepository stations) : ITrainQueryService
{
    private static readonly string[] DayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    public async Task<IReadOnlyList<TrainSummaryDto>> GetTrainsAsync(int page, int pageSize, CancellationToken ct = default)
    {
        var skip = Math.Max(0, (page - 1) * pageSize);
        var rows = await trains.GetActiveTrainsAsync(skip, pageSize, ct);
        return rows.Select(MapSummary).ToList();
    }

    public async Task<TrainDetailDto?> GetTrainAsync(string trainNumber, CancellationToken ct = default)
    {
        var train = await trains.GetByTrainNumberAsync(trainNumber, ct);
        return train is null ? null : MapDetail(train);
    }

    public async Task<IReadOnlyList<RouteStopDto>> GetRouteAsync(string trainNumber, CancellationToken ct = default)
    {
        var route = await trains.GetRouteAsync(trainNumber, ct);
        return route.Select(r => new RouteStopDto(
            r.StationSequence, r.StationCode, r.StationName,
            r.ArrivalTime, r.DepartureTime, r.HaltMinutes, r.DayNumber,
            r.DistanceFromSourceKm, r.PlatformNumber, r.IsTechnicalHalt, r.IsCommercialHalt)).ToList();
    }

    public Task<IReadOnlyList<SearchResultDto>> SearchAsync(string from, string to, DateOnly? date, CancellationToken ct = default)
        => SearchInternalAsync(from, to, date, null, ct);

    public Task<IReadOnlyList<SearchResultDto>> SearchByDateAsync(string from, string to, DateOnly date, CancellationToken ct = default)
        => SearchInternalAsync(from, to, date, null, ct);

    public async Task<IReadOnlyList<SearchResultDto>> SearchByRunningDayAsync(string from, string to, DayOfWeek day, CancellationToken ct = default)
    {
        var fromStation = await stations.ResolveAsync(from, ct)
            ?? throw new KeyNotFoundException($"Station not found: {from}");
        var toStation = await stations.ResolveAsync(to, ct)
            ?? throw new KeyNotFoundException($"Station not found: {to}");

        var results = await trains.SearchByRunningDayAsync(fromStation.Id, toStation.Id, day, ct);
        return results.Select(MapSearch).ToList();
    }

    private async Task<IReadOnlyList<SearchResultDto>> SearchInternalAsync(
        string from, string to, DateOnly? date, DayOfWeek? day, CancellationToken ct)
    {
        var fromStation = await stations.ResolveAsync(from, ct)
            ?? throw new KeyNotFoundException($"Station not found: {from}");
        var toStation = await stations.ResolveAsync(to, ct)
            ?? throw new KeyNotFoundException($"Station not found: {to}");

        var results = await trains.SearchBetweenStationsAsync(fromStation.Id, toStation.Id, date, ct);
        return results.Select(MapSearch).ToList();
    }

    private static TrainSummaryDto MapSummary(Domain.Entities.TrainMaster t) => new(
        t.TrainNumber, t.TrainName, t.TrainType?.Name, t.Zone?.Code,
        t.SourceStationCode, t.SourceStationName, t.DestinationStationCode, t.DestinationStationName,
        t.DepartureTimeFromSource, t.ArrivalTimeAtDestination, t.TotalDistanceKm, t.TotalJourneyMinutes,
        t.TrainStatus, t.PantryAvailable, t.ReservationAvailable, t.SuperfastFlag,
        MapRunningDays(t.RunningDays));

    private static TrainDetailDto MapDetail(Domain.Entities.TrainMaster t) => new(
        t.TrainNumber, t.TrainName, t.TrainType?.Code, t.TrainType?.Name, t.Zone?.Code, t.Zone?.Name,
        t.SourceStationCode, t.SourceStationName, t.DestinationStationCode, t.DestinationStationName,
        t.DepartureTimeFromSource, t.ArrivalTimeAtDestination, t.TotalDistanceKm, t.TotalJourneyMinutes,
        t.TrainStatus, t.PantryAvailable, t.ReservationAvailable, t.SuperfastFlag,
        MapRunningDays(t.RunningDays));

    private static SearchResultDto MapSearch(TrainSearchResult r) => new(
        r.TrainNumber, r.TrainName, r.TrainTypeName,
        r.FromStationCode, r.FromStationName, r.ToStationCode, r.ToStationName,
        r.DepartureTime, r.ArrivalTime, r.JourneyMinutes, r.DistanceKm,
        r.RunningDays.Select(d => DayNames[d - 1]).ToList(),
        r.IntermediateStops.Select(s => new RouteStopDto(
            s.Sequence, s.StationCode, s.StationName, s.ArrivalTime, s.DepartureTime,
            s.HaltMinutes, s.DayNumber, s.DistanceFromSourceKm, null, false, true)).ToList());

    private static IReadOnlyList<string> MapRunningDays(IEnumerable<Domain.Entities.TrainRunningDay> days)
    {
        var list = days.Where(d => d.Runs).Select(d => DayNames[d.DayOfWeek - 1]).ToList();
        return list.Count > 0 ? list : ["Daily (source not specified)"];
    }
}

public class StationQueryService(IStationRepository stations) : IStationQueryService
{
    public async Task<StationDto?> GetStationAsync(string stationCode, CancellationToken ct = default)
    {
        var s = await stations.GetByCodeAsync(stationCode, ct);
        if (s is null) return null;
        return new StationDto(s.Code, s.Name, s.City, s.State, s.Zone?.Code, s.Latitude, s.Longitude, s.IsJunction, s.IsActive);
    }
}
