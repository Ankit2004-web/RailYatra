using Microsoft.EntityFrameworkCore;
using RailYatra.Domain.Entities;
using RailYatra.Domain.Interfaces;
using RailYatra.Infrastructure.Persistence;

namespace RailYatra.Infrastructure.Repositories;

public class ImportRepository(RailwayDbContext db) : IImportRepository
{
    public async Task<ImportLog> StartLogAsync(ImportLog log, CancellationToken ct = default)
    {
        db.ImportLogs.Add(log);
        await db.SaveChangesAsync(ct);
        return log;
    }

    public async Task CompleteLogAsync(long logId, ImportLog summary, CancellationToken ct = default)
    {
        var log = await db.ImportLogs.FindAsync([logId], ct)
            ?? throw new InvalidOperationException($"Import log {logId} not found");

        log.Status = summary.Status;
        log.CompletedAt = summary.CompletedAt ?? DateTime.UtcNow;
        log.ExecutionTimeMs = summary.ExecutionTimeMs;
        log.InsertedCount = summary.InsertedCount;
        log.UpdatedCount = summary.UpdatedCount;
        log.DeletedCount = summary.DeletedCount;
        log.SkippedCount = summary.SkippedCount;
        log.ErrorCount = summary.ErrorCount;
        log.Message = summary.Message;
        log.ErrorDetails = summary.ErrorDetails;
        await db.SaveChangesAsync(ct);
    }

    public async Task<DataVersion> CreateDataVersionAsync(DataVersion version, CancellationToken ct = default)
    {
        db.DataVersion.Add(version);
        await db.SaveChangesAsync(ct);
        return version;
    }

    public async Task ActivateDataVersionAsync(int versionId, CancellationToken ct = default)
    {
        await db.DataVersion.Where(v => v.IsActive).ExecuteUpdateAsync(s => s.SetProperty(v => v.IsActive, false), ct);
        await db.DataVersion.Where(v => v.Id == versionId).ExecuteUpdateAsync(s => s.SetProperty(v => v.IsActive, true), ct);
    }

    public async Task<IReadOnlyList<ImportLog>> GetRecentLogsAsync(int limit, CancellationToken ct = default)
        => await db.ImportLogs.AsNoTracking().OrderByDescending(l => l.StartedAt).Take(limit).ToListAsync(ct);
}
