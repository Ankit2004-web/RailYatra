using RailYatra.Domain.Entities;

namespace RailYatra.Domain.Interfaces;

public interface IImportRepository
{
    Task<ImportLog> StartLogAsync(ImportLog log, CancellationToken ct = default);
    Task CompleteLogAsync(long logId, ImportLog summary, CancellationToken ct = default);
    Task<DataVersion> CreateDataVersionAsync(DataVersion version, CancellationToken ct = default);
    Task ActivateDataVersionAsync(int versionId, CancellationToken ct = default);
    Task<IReadOnlyList<ImportLog>> GetRecentLogsAsync(int limit, CancellationToken ct = default);
}

public interface IRailwayImportService
{
    Task<ImportLog> RunFullImportAsync(CancellationToken ct = default);
    Task<ImportLog> RunIncrementalImportAsync(CancellationToken ct = default);
}

public interface IRailwayDataDownloader
{
    Task<string> DownloadAsync(string targetDirectory, CancellationToken ct = default);
}
