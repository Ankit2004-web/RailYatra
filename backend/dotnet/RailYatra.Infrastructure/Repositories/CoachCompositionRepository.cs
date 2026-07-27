using Microsoft.EntityFrameworkCore;
using RailYatra.Domain.Entities;
using RailYatra.Domain.Interfaces;
using RailYatra.Infrastructure.Persistence;

namespace RailYatra.Infrastructure.Repositories;

public class CoachCompositionRepository(RailwayDbContext db) : ICoachCompositionRepository
{
    public async Task<CompositionVersion?> GetActiveVersionAsync(string trainNumber, CancellationToken ct = default)
        => await db.CompositionVersion.AsNoTracking()
            .Where(v => v.TrainNumber == trainNumber && v.IsActive)
            .OrderByDescending(v => v.ImportedAt)
            .FirstOrDefaultAsync(ct);

    public async Task<IReadOnlyList<TrainCoachComposition>> GetCoachesAsync(string trainNumber, CancellationToken ct = default)
    {
        var version = await GetActiveVersionAsync(trainNumber, ct);
        if (version is null) return [];

        return await db.TrainCoachComposition.AsNoTracking()
            .Include(c => c.CoachType)
            .Include(c => c.CoachModel)
            .Where(c => c.CompositionVersionId == version.Id)
            .OrderBy(c => c.CoachPosition)
            .ToListAsync(ct);
    }

    public async Task<TrainCapacitySummary?> GetCapacityAsync(string trainNumber, CancellationToken ct = default)
    {
        var version = await GetActiveVersionAsync(trainNumber, ct);
        if (version is null) return null;

        return await db.TrainCapacity.AsNoTracking()
            .FirstOrDefaultAsync(c => c.TrainNumber == trainNumber && c.CompositionVersionId == version.Id, ct);
    }

    public async Task<CoachLayout?> GetLayoutAsync(string coachTypeCode, string coachModelCode, CancellationToken ct = default)
        => await (
            from layout in db.CoachLayouts.AsNoTracking()
            join coachType in db.CoachTypeDefinitions on layout.CoachTypeId equals coachType.Id
            join coachModel in db.CoachModels on layout.CoachModelId equals coachModel.Id
            where coachType.Code == coachTypeCode && coachModel.Code == coachModelCode
            select layout).FirstOrDefaultAsync(ct);
}
