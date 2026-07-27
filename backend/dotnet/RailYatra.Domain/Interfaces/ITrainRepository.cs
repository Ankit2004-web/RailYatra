using RailYatra.Domain.Entities;

namespace RailYatra.Domain.Interfaces;

public interface ITrainRepository
{
    Task<IReadOnlyList<TrainMaster>> GetActiveTrainsAsync(int skip, int take, CancellationToken ct = default);
    Task<TrainMaster?> GetByTrainNumberAsync(string trainNumber, CancellationToken ct = default);
    Task<IReadOnlyList<TrainRoute>> GetRouteAsync(string trainNumber, CancellationToken ct = default);
    Task<IReadOnlyList<TrainSearchResult>> SearchBetweenStationsAsync(
        int fromStationId, int toStationId, DateOnly? date, CancellationToken ct = default);
    Task<IReadOnlyList<TrainSearchResult>> SearchByRunningDayAsync(
        int fromStationId, int toStationId, DayOfWeek day, CancellationToken ct = default);
}

public sealed class TrainSearchResult
{
    public int TrainMasterId { get; init; }
    public string TrainNumber { get; init; } = string.Empty;
    public string TrainName { get; init; } = string.Empty;
    public string? TrainTypeCode { get; init; }
    public string? TrainTypeName { get; init; }
    public string FromStationCode { get; init; } = string.Empty;
    public string FromStationName { get; init; } = string.Empty;
    public string ToStationCode { get; init; } = string.Empty;
    public string ToStationName { get; init; } = string.Empty;
    public string? DepartureTime { get; init; }
    public string? ArrivalTime { get; init; }
    public int? JourneyMinutes { get; init; }
    public int? DistanceKm { get; init; }
    public int FromSequence { get; init; }
    public int ToSequence { get; init; }
    public byte FromDayNumber { get; init; }
    public byte ToDayNumber { get; init; }
    public bool SuperfastFlag { get; init; }
    public IReadOnlyList<byte> RunningDays { get; init; } = [];
    public IReadOnlyList<TrainRouteStopDto> IntermediateStops { get; init; } = [];
}

public sealed class TrainRouteStopDto
{
    public int Sequence { get; init; }
    public string StationCode { get; init; } = string.Empty;
    public string StationName { get; init; } = string.Empty;
    public string? ArrivalTime { get; init; }
    public string? DepartureTime { get; init; }
    public int? HaltMinutes { get; init; }
    public byte DayNumber { get; init; }
    public int? DistanceFromSourceKm { get; init; }
}
