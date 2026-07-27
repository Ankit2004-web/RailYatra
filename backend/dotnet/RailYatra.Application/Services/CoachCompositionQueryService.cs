using RailYatra.Application.DTOs;
using RailYatra.Domain.Interfaces;

namespace RailYatra.Application.Services;

public interface ICoachCompositionQueryService
{
    Task<TrainCoachesResponse?> GetCoachesAsync(string trainNumber, CancellationToken ct = default);
    Task<TrainCapacityResponse> GetCapacityAsync(string trainNumber, CancellationToken ct = default);
    Task<TrainLayoutResponse> GetLayoutAsync(string trainNumber, CancellationToken ct = default);
}

public class CoachCompositionQueryService(ICoachCompositionRepository repo) : ICoachCompositionQueryService
{
    public async Task<TrainCoachesResponse?> GetCoachesAsync(string trainNumber, CancellationToken ct = default)
    {
        var version = await repo.GetActiveVersionAsync(trainNumber, ct);
        var coaches = await repo.GetCoachesAsync(trainNumber, ct);

        return new TrainCoachesResponse(
            trainNumber,
            version?.VersionTag,
            version?.SourceName,
            coaches.Count,
            coaches.Count == 0 ? "Unknown"
                : coaches.All(c => c.CapacityKnown) ? "Known"
                : coaches.Any(c => c.CapacityKnown) ? "Partial" : "Unknown",
            coaches.Select(c => new CoachDto(
                c.CoachNumber,
                c.CoachType?.Code ?? "",
                c.CoachType?.Name,
                c.CoachModel?.Code,
                c.CoachModel?.Name,
                c.CoachPosition,
                c.CapacityKnown ? c.SeatingCapacity : null,
                c.CapacityKnown ? c.SleepingBerths : null,
                c.CapacityKnown,
                c.LadiesCoach, c.DivyangCoach, c.PantryCar, c.GuardCoach, c.ParcelCoach, c.PowerCar
            )).ToList()
        );
    }

    public async Task<TrainCapacityResponse> GetCapacityAsync(string trainNumber, CancellationToken ct = default)
    {
        var cap = await repo.GetCapacityAsync(trainNumber, ct);
        if (cap is null)
            return new TrainCapacityResponse(trainNumber, "Unknown", 0, null, null, null, null, null, null,
                "Official coach composition not imported");

        return new TrainCapacityResponse(
            trainNumber, cap.CapacityStatus, cap.TotalCoaches,
            cap.TotalAcCapacity, cap.TotalSleeperCapacity, cap.TotalChairCapacity,
            cap.TotalGeneralCapacity, cap.TotalReservedCapacity, cap.TotalPassengerCapacity, null);
    }

    public async Task<TrainLayoutResponse> GetLayoutAsync(string trainNumber, CancellationToken ct = default)
    {
        var coaches = await repo.GetCoachesAsync(trainNumber, ct);
        var items = new List<CoachLayoutDto>();

        foreach (var c in coaches)
        {
            if (c.CoachType?.Code is null || c.CoachModel?.Code is null) continue;
            var layout = await repo.GetLayoutAsync(c.CoachType.Code, c.CoachModel.Code, ct);
            items.Add(new CoachLayoutDto(c.CoachNumber, c.CoachType.Code, c.CoachModel.Code,
                layout?.LayoutCode, layout?.LayoutName, layout?.BerthConfiguration));
        }

        return new TrainLayoutResponse(trainNumber, coaches.Count > 0 ? null : "No official composition imported", items);
    }
}
