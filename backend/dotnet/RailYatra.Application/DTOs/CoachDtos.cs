namespace RailYatra.Application.DTOs;

public record CoachDto(
    string CoachNumber,
    string CoachType,
    string? CoachTypeName,
    string? CoachModel,
    string? CoachModelName,
    int CoachPosition,
    int? SeatingCapacity,
    int? SleepingBerths,
    bool CapacityKnown,
    bool LadiesCoach,
    bool DivyangCoach,
    bool PantryCar,
    bool GuardCoach,
    bool ParcelCoach,
    bool PowerCar);

public record TrainCoachesResponse(
    string TrainNumber,
    string? CompositionVersion,
    string? CompositionSource,
    int CoachCount,
    string CapacityStatus,
    IReadOnlyList<CoachDto> Coaches);

public record TrainCapacityResponse(
    string TrainNumber,
    string CapacityStatus,
    int TotalCoaches,
    int? TotalAcCapacity,
    int? TotalSleeperCapacity,
    int? TotalChairCapacity,
    int? TotalGeneralCapacity,
    int? TotalReservedCapacity,
    int? TotalPassengerCapacity,
    string? Message);

public record CoachLayoutDto(
    string CoachNumber,
    string CoachType,
    string CoachModel,
    string? LayoutCode,
    string? LayoutName,
    string? BerthConfiguration);

public record TrainLayoutResponse(
    string TrainNumber,
    string? Message,
    IReadOnlyList<CoachLayoutDto> Coaches);
