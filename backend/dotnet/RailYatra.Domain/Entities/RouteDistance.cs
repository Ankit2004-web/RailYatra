namespace RailYatra.Domain.Entities;

public class RouteDistance
{
    public long Id { get; set; }
    public int TrainMasterId { get; set; }
    public int FromStationId { get; set; }
    public int ToStationId { get; set; }
    public int FromSequence { get; set; }
    public int ToSequence { get; set; }
    public int? DistanceKm { get; set; }
    public int? DataVersionId { get; set; }

    public TrainMaster? TrainMaster { get; set; }
}
