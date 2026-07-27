namespace RailYatra.Domain.Entities;

public class DataVersion
{
    public int Id { get; set; }
    public string VersionTag { get; set; } = string.Empty;
    public string SourceName { get; set; } = string.Empty;
    public string? SourceUrl { get; set; }
    public string? Publisher { get; set; }
    public string? LicenseNotes { get; set; }
    public string? DatasetVersion { get; set; }
    public string? FileHash { get; set; }
    public string ImportMode { get; set; } = "Full";
    public bool IsActive { get; set; }
    public int? TrainCount { get; set; }
    public int? RouteCount { get; set; }
    public int? StationCount { get; set; }
    public DateTime ImportedAt { get; set; }
    public string? Notes { get; set; }

    public ICollection<ImportLog> ImportLogs { get; set; } = [];
}
