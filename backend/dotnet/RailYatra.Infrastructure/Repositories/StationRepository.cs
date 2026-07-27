using Microsoft.EntityFrameworkCore;
using RailYatra.Domain.Entities;
using RailYatra.Domain.Interfaces;
using RailYatra.Infrastructure.Persistence;

namespace RailYatra.Infrastructure.Repositories;

public class StationRepository(RailwayDbContext db) : IStationRepository
{
    public async Task<Station?> GetByCodeAsync(string code, CancellationToken ct = default)
        => await db.Stations.AsNoTracking()
            .Include(s => s.Zone)
            .FirstOrDefaultAsync(s => s.Code == code.ToUpperInvariant() && s.IsActive, ct);

    public async Task<Station?> ResolveAsync(string query, CancellationToken ct = default)
    {
        var term = query.Trim();
        if (string.IsNullOrEmpty(term)) return null;

        var upper = term.ToUpperInvariant();
        var exact = await db.Stations.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Code == upper && s.IsActive, ct);
        if (exact is not null) return exact;

        var like = $"%{term}%";
        return await db.Stations.AsNoTracking()
            .Where(s => s.IsActive && (EF.Functions.Like(s.Name, like) || EF.Functions.Like(s.City, like)))
            .OrderBy(s => s.Name)
            .FirstOrDefaultAsync(ct);
    }

    public async Task<IReadOnlyList<Station>> SearchAsync(string query, int limit, CancellationToken ct = default)
    {
        var like = $"%{query.Trim()}%";
        return await db.Stations.AsNoTracking()
            .Where(s => s.IsActive && (EF.Functions.Like(s.Code, like) || EF.Functions.Like(s.Name, like)))
            .OrderBy(s => s.Name)
            .Take(limit)
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<TrainMaster>> GetTrainsAtStationAsync(string stationCode, CancellationToken ct = default)
    {
        var station = await GetByCodeAsync(stationCode, ct);
        if (station is null) return [];

        return await (
            from r in db.TrainRoutes.AsNoTracking()
            join t in db.TrainMaster.AsNoTracking() on r.TrainMasterId equals t.Id
            where r.StationId == station.Id && t.TrainStatus == "Active"
            select t).Distinct().OrderBy(t => t.TrainNumber).ToListAsync(ct);
    }
}
