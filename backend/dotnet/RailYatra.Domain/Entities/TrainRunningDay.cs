namespace RailYatra.Domain.Entities;

public class TrainRunningDay
{
    public int Id { get; set; }
    public int? TrainId { get; set; }
    public int? TrainMasterId { get; set; }
    public byte DayOfWeek { get; set; }
    public bool Runs { get; set; } = true;

    public TrainMaster? TrainMaster { get; set; }
}
