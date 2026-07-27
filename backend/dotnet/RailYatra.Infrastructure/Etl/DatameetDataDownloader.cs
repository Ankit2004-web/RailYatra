using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RailYatra.Domain.Interfaces;

namespace RailYatra.Infrastructure.Etl;

public class DatameetDataDownloader(HttpClient http, IOptions<RailwayImportOptions> options, ILogger<DatameetDataDownloader> logger)
    : IRailwayDataDownloader
{
    public async Task<string> DownloadAsync(string targetDirectory, CancellationToken ct = default)
    {
        Directory.CreateDirectory(targetDirectory);
        var cfg = options.Value.DataMeet;
        var files = new[]
        {
            (cfg.StationsFile, "datameet-stations.json"),
            (cfg.TrainsFile, "datameet-trains.json"),
            (cfg.SchedulesFile, "datameet-schedules.json")
        };

        foreach (var (remote, local) in files)
        {
            var url = $"{cfg.BaseUrl.TrimEnd('/')}/{remote}";
            var path = Path.Combine(targetDirectory, local);
            logger.LogInformation("Downloading {Url} -> {Path}", url, path);
            await using var stream = await http.GetStreamAsync(url, ct);
            await using var file = File.Create(path);
            await stream.CopyToAsync(file, ct);
        }

        return targetDirectory;
    }

    public static string ComputeDirectoryHash(string directory)
    {
        using var sha = SHA256.Create();
        var files = new[] { "datameet-stations.json", "datameet-trains.json", "datameet-schedules.json" }
            .Select(f => Path.Combine(directory, f))
            .Where(File.Exists)
            .OrderBy(f => f);

        foreach (var file in files)
        {
            var bytes = File.ReadAllBytes(file);
            sha.TransformBlock(bytes, 0, bytes.Length, null, 0);
        }

        sha.TransformFinalBlock([], 0, 0);
        return Convert.ToHexString(sha.Hash!)[..32];
    }
}
