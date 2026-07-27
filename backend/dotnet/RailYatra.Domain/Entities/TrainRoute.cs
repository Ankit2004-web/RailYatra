namespace RailYatra.Domain.Entities;

public class TrainRoute
{
    public long Id { get; set; }
    public int TrainMasterId { get; set; }
    public string TrainNumber { get; set; } = string.Empty;
    public int StationSequence { get; set; }
    public int StationId { get; set; }
    public string StationCode { get; set; } = string.Empty;
    public string StationName { get; set; } = string.Empty;
    public string? ArrivalTime { get; set; }
    public string? DepartureTime { get; set; }
    public int? HaltMinutes { get; set; }
    public byte DayNumber { get; set; } = 1;
    public int? DistanceFromSourceKm { get; set; }
    public string? PlatformNumber { get; set; }
    public bool IsTechnicalHalt { get; set; }
    public bool IsCommercialHalt { get; set; } = true;
    public int? DataVersionId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public TrainMaster? TrainMaster { get; set; }
    public Station? Station { get; set; }
}
