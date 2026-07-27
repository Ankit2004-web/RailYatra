using Microsoft.AspNetCore.Mvc;
using RailYatra.Application.DTOs;
using RailYatra.Domain.Interfaces;

namespace RailYatra.Api.Controllers;

[ApiController]
[Route("api/import")]
public class ImportController(IRailwayImportService importer, IImportRepository importRepo) : ControllerBase
{
    [HttpPost("full")]
    public async Task<ActionResult<ImportStatusDto>> RunFullImport(CancellationToken ct)
    {
        var log = await importer.RunFullImportAsync(ct);
        return Ok(Map(log));
    }

    [HttpPost("incremental")]
    public async Task<ActionResult<ImportStatusDto>> RunIncrementalImport(CancellationToken ct)
    {
        var log = await importer.RunIncrementalImportAsync(ct);
        return Ok(Map(log));
    }

    [HttpGet("logs")]
    public async Task<ActionResult<IReadOnlyList<ImportStatusDto>>> GetLogs([FromQuery] int limit = 20, CancellationToken ct = default)
    {
        var logs = await importRepo.GetRecentLogsAsync(Math.Clamp(limit, 1, 100), ct);
        return Ok(logs.Select(Map).ToList());
    }

    private static ImportStatusDto Map(Domain.Entities.ImportLog log) => new(
        log.Id, log.ImportType, log.Status, log.StartedAt, log.CompletedAt, log.ExecutionTimeMs,
        log.InsertedCount, log.UpdatedCount, log.DeletedCount, log.SkippedCount, log.ErrorCount, log.Message);
}
