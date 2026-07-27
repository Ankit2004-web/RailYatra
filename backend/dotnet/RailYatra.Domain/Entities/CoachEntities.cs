namespace RailYatra.Domain.Entities;

public class CoachModel
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
}

public class CoachTypeDefinition
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? IrCategory { get; set; }
    public int? TravelClassId { get; set; }
    public bool IsPassengerCoach { get; set; } = true;
    public bool IsAcCoach { get; set; }
    public bool IsSleeperCoach { get; set; }
    public bool IsChairCoach { get; set; }
    public bool IsReservedCoach { get; set; } = true;
}

public class CoachCapacityRule
{
    public int Id { get; set; }
    public int CoachTypeId { get; set; }
    public int CoachModelId { get; set; }
    public int? SeatingCapacity { get; set; }
    public int? SleepingBerths { get; set; }
    public int? CoupeCount { get; set; }
    public int? CabinCount { get; set; }
    public int? TotalBerths { get; set; }
    public string SourceReference { get; set; } = string.Empty;
    public CoachTypeDefinition? CoachType { get; set; }
    public CoachModel? CoachModel { get; set; }
}

public class CoachLayout
{
    public int Id { get; set; }
    public int CoachTypeId { get; set; }
    public int CoachModelId { get; set; }
    public string LayoutCode { get; set; } = string.Empty;
    public string LayoutName { get; set; } = string.Empty;
    public string? BerthConfiguration { get; set; }
    public string? SeatingConfiguration { get; set; }
}

public class CompositionVersion
{
    public int Id { get; set; }
    public string VersionTag { get; set; } = string.Empty;
    public string TrainNumber { get; set; } = string.Empty;
    public string SourceName { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime ImportedAt { get; set; }
}

public class TrainCoachComposition
{
    public long Id { get; set; }
    public string TrainNumber { get; set; } = string.Empty;
    public string? TrainName { get; set; }
    public int? CompositionVersionId { get; set; }
    public string CoachNumber { get; set; } = string.Empty;
    public int CoachTypeId { get; set; }
    public int? CoachModelId { get; set; }
    public int CoachPosition { get; set; }
    public int? SeatingCapacity { get; set; }
    public int? SleepingBerths { get; set; }
    public bool CapacityKnown { get; set; }
    public bool LadiesCoach { get; set; }
    public bool DivyangCoach { get; set; }
    public bool PantryCar { get; set; }
    public bool GuardCoach { get; set; }
    public bool ParcelCoach { get; set; }
    public bool PowerCar { get; set; }
    public CoachTypeDefinition? CoachType { get; set; }
    public CoachModel? CoachModel { get; set; }
}

public class TrainCapacitySummary
{
    public int Id { get; set; }
    public string TrainNumber { get; set; } = string.Empty;
    public int? CompositionVersionId { get; set; }
    public int TotalCoaches { get; set; }
    public int? TotalAcCapacity { get; set; }
    public int? TotalSleeperCapacity { get; set; }
    public int? TotalChairCapacity { get; set; }
    public int? TotalGeneralCapacity { get; set; }
    public int? TotalReservedCapacity { get; set; }
    public int? TotalPassengerCapacity { get; set; }
    public string CapacityStatus { get; set; } = "Unknown";
    public DateTime CalculatedAt { get; set; }
}
