namespace RailYatra.Domain.Entities;

public class TrainMaster
{
    public int Id { get; set; }
    public string TrainNumber { get; set; } = string.Empty;
    public string TrainName { get; set; } = string.Empty;
    public string? NormalizedName { get; set; }
    public int? TrainTypeId { get; set; }
    public int? ZoneId { get; set; }
    public int SourceStationId { get; set; }
    public string SourceStationCode { get; set; } = string.Empty;
    public string SourceStationName { get; set; } = string.Empty;
    public int DestinationStationId { get; set; }
    public string DestinationStationCode { get; set; } = string.Empty;
    public string DestinationStationName { get; set; } = string.Empty;
    public string DepartureTimeFromSource { get; set; } = string.Empty;
    public string ArrivalTimeAtDestination { get; set; } = string.Empty;
    public int? TotalDistanceKm { get; set; }
    public int? TotalJourneyMinutes { get; set; }
    public string TrainStatus { get; set; } = "Active";
    public bool? PantryAvailable { get; set; }
    public bool? ReservationAvailable { get; set; }
    public bool SuperfastFlag { get; set; }
    public int? DataVersionId { get; set; }
    public int? LegacyTrainId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public TrainType? TrainType { get; set; }
    public Zone? Zone { get; set; }
    public Station? SourceStation { get; set; }
    public Station? DestinationStation { get; set; }
    public DataVersion? DataVersion { get; set; }
    public ICollection<TrainRoute> Routes { get; set; } = [];
    public ICollection<TrainRunningDay> RunningDays { get; set; } = [];
}
