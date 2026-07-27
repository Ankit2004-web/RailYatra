namespace RailYatra.Domain.Entities;

public class ImportLog
{
    public long Id { get; set; }
    public int? DataVersionId { get; set; }
    public string ImportType { get; set; } = string.Empty;
    public string Status { get; set; } = "Started";
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public long? ExecutionTimeMs { get; set; }
    public int InsertedCount { get; set; }
    public int UpdatedCount { get; set; }
    public int DeletedCount { get; set; }
    public int SkippedCount { get; set; }
    public int ErrorCount { get; set; }
    public string? SourceFile { get; set; }
    public string? Message { get; set; }
    public string? ErrorDetails { get; set; }

    public DataVersion? DataVersion { get; set; }
}
