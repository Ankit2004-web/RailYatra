namespace RailYatra.Infrastructure.Etl;

public class RailwayImportOptions
{
    public const string SectionName = "RailwayImport";

    public string RawDataDirectory { get; set; } = "../../../database/data/railway/raw";
    public string PrimarySource { get; set; } = "DataMeet";
    public bool DeactivateMissingTrains { get; set; } = true;
    public int RouteBatchSize { get; set; } = 500;
    public bool EnableScheduledImport { get; set; } = false;
    public string ScheduleCron { get; set; } = "0 2 * * 0";

    public DataMeetSourceOptions DataMeet { get; set; } = new();
    public OgdSourceOptions Ogd { get; set; } = new();
}

public class DataMeetSourceOptions
{
    public string Name { get; set; } = "DataMeet Indian Railways JSON (CC0)";
    public string BaseUrl { get; set; } = "https://raw.githubusercontent.com/datameet/railways/master";
    public string StationsFile { get; set; } = "stations/stations.json";
    public string TrainsFile { get; set; } = "trains/trains.json";
    public string SchedulesFile { get; set; } = "schedules/schedules.json";
    public string Publisher { get; set; } = "DataMeet Community";
    public string LicenseNotes { get; set; } =
        "CC0 — NOT official Ministry of Railways current timetable. Potentially outdated (~2016). Running days and per-stop distance not included.";
    public string DatasetVersion { get; set; } = "2016-08";
}

public class OgdSourceOptions
{
    public bool Enabled { get; set; }
    public string CatalogUrl { get; set; } = "https://www.data.gov.in/catalog/indian-railways-train-time-table";
    public string? ApiKey { get; set; }
    public string? ResourceId { get; set; }
}
