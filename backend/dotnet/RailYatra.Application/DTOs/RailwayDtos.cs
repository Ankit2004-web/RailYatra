namespace RailYatra.Application.DTOs;

public record TrainSummaryDto(
    string TrainNumber,
    string TrainName,
    string? TrainType,
    string? Zone,
    string SourceStationCode,
    string SourceStationName,
    string DestinationStationCode,
    string DestinationStationName,
    string DepartureTime,
    string ArrivalTime,
    int? TotalDistanceKm,
    int? TotalJourneyMinutes,
    string TrainStatus,
    bool? PantryAvailable,
    bool? ReservationAvailable,
    bool SuperfastFlag,
    IReadOnlyList<string> RunningDays);

public record TrainDetailDto(
    string TrainNumber,
    string TrainName,
    string? TrainTypeCode,
    string? TrainTypeName,
    string? ZoneCode,
    string? ZoneName,
    string SourceStationCode,
    string SourceStationName,
    string DestinationStationCode,
    string DestinationStationName,
    string DepartureTimeFromSource,
    string ArrivalTimeAtDestination,
    int? TotalDistanceKm,
    int? TotalJourneyMinutes,
    string TrainStatus,
    bool? PantryAvailable,
    bool? ReservationAvailable,
    bool SuperfastFlag,
    IReadOnlyList<string> RunningDays);

public record RouteStopDto(
    int StationSequence,
    string StationCode,
    string StationName,
    string? ArrivalTime,
    string? DepartureTime,
    int? HaltMinutes,
    byte DayNumber,
    int? DistanceFromSourceKm,
    string? PlatformNumber,
    bool IsTechnicalHalt,
    bool IsCommercialHalt);

public record StationDto(
    string Code,
    string Name,
    string City,
    string State,
    string? ZoneCode,
    decimal? Latitude,
    decimal? Longitude,
    bool IsJunction,
    bool IsActive);

public record SearchResultDto(
    string TrainNumber,
    string TrainName,
    string? TrainType,
    string FromStationCode,
    string FromStationName,
    string ToStationCode,
    string ToStationName,
    string? DepartureTime,
    string? ArrivalTime,
    int? JourneyMinutes,
    int? DistanceKm,
    IReadOnlyList<string> RunningDays,
    IReadOnlyList<RouteStopDto> IntermediateStops);

public record ImportStatusDto(
    long LogId,
    string ImportType,
    string Status,
    DateTime StartedAt,
    DateTime? CompletedAt,
    long? ExecutionTimeMs,
    int InsertedCount,
    int UpdatedCount,
    int DeletedCount,
    int SkippedCount,
    int ErrorCount,
    string? Message);
