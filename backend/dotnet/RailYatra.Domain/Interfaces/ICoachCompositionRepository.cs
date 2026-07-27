using RailYatra.Domain.Entities;

namespace RailYatra.Domain.Interfaces;

public interface ICoachCompositionRepository
{
    Task<CompositionVersion?> GetActiveVersionAsync(string trainNumber, CancellationToken ct = default);
    Task<IReadOnlyList<TrainCoachComposition>> GetCoachesAsync(string trainNumber, CancellationToken ct = default);
    Task<TrainCapacitySummary?> GetCapacityAsync(string trainNumber, CancellationToken ct = default);
    Task<CoachLayout?> GetLayoutAsync(string coachTypeCode, string coachModelCode, CancellationToken ct = default);
}
