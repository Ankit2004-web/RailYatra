namespace RailYatra.Domain.Enums;

public static class TrainStatus
{
    public const string Active = "Active";
    public const string Cancelled = "Cancelled";
    public const string Inactive = "Inactive";
}

public static class ImportMode
{
    public const string Full = "Full";
    public const string Incremental = "Incremental";
}

public static class ImportStatus
{
    public const string Started = "Started";
    public const string Completed = "Completed";
    public const string Failed = "Failed";
    public const string Partial = "Partial";
}
