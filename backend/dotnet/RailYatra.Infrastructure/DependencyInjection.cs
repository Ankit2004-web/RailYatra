using Hangfire;
using Hangfire.SqlServer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using RailYatra.Domain.Interfaces;
using RailYatra.Infrastructure.Etl;
using RailYatra.Infrastructure.Persistence;
using RailYatra.Infrastructure.Repositories;

namespace RailYatra.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<RailwayImportOptions>(configuration.GetSection(RailwayImportOptions.SectionName));

        var connectionString = configuration.GetConnectionString("RailwayDb")
            ?? "Server=(localdb)\\MSSQLLocalDB;Database=RailwayReservation;Trusted_Connection=True;TrustServerCertificate=True";

        services.AddDbContext<RailwayDbContext>(options =>
            options.UseSqlServer(connectionString, sql => sql.EnableRetryOnFailure(3)));

        services.AddHttpClient<IRailwayDataDownloader, DatameetDataDownloader>();
        services.AddScoped<ITrainRepository, TrainRepository>();
        services.AddScoped<IStationRepository, StationRepository>();
        services.AddScoped<IImportRepository, ImportRepository>();
        services.AddScoped<ICoachCompositionRepository, CoachCompositionRepository>();
        services.AddScoped<IRailwayImportService, DatameetRailwayImportService>();

        services.AddHangfire(cfg => cfg
            .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
            .UseSimpleAssemblyNameTypeSerializer()
            .UseRecommendedSerializerSettings()
            .UseSqlServerStorage(connectionString, new SqlServerStorageOptions
            {
                SchemaName = "Hangfire",
                PrepareSchemaIfNecessary = true
            }));

        services.AddHangfireServer();
        services.AddHostedService<RailwayImportScheduler>();

        return services;
    }
}

public class RailwayImportScheduler(IServiceProvider services, IConfiguration config) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var options = config.GetSection(RailwayImportOptions.SectionName).Get<RailwayImportOptions>();
        if (options?.EnableScheduledImport != true) return;

        RecurringJob.AddOrUpdate(
            "railway-incremental-import",
            () => RunIncrementalImport(services),
            options.ScheduleCron);

        await Task.Delay(Timeout.Infinite, stoppingToken);
    }

    public static async Task RunIncrementalImport(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var importer = scope.ServiceProvider.GetRequiredService<IRailwayImportService>();
        await importer.RunIncrementalImportAsync();
    }
}
