using Microsoft.EntityFrameworkCore;
using RailYatra.Domain.Entities;

namespace RailYatra.Infrastructure.Persistence;

public class RailwayDbContext(DbContextOptions<RailwayDbContext> options) : DbContext(options)
{
    public DbSet<Station> Stations => Set<Station>();
    public DbSet<Zone> Zones => Set<Zone>();
    public DbSet<TrainType> TrainTypes => Set<TrainType>();
    public DbSet<TrainMaster> TrainMaster => Set<TrainMaster>();
    public DbSet<TrainRoute> TrainRoutes => Set<TrainRoute>();
    public DbSet<TrainRunningDay> TrainRunningDays => Set<TrainRunningDay>();
    public DbSet<RouteDistance> RouteDistances => Set<RouteDistance>();
    public DbSet<DataVersion> DataVersion => Set<DataVersion>();
    public DbSet<ImportLog> ImportLogs => Set<ImportLog>();
    public DbSet<CoachModel> CoachModels => Set<CoachModel>();
    public DbSet<CoachTypeDefinition> CoachTypeDefinitions => Set<CoachTypeDefinition>();
    public DbSet<CoachCapacityRule> CoachCapacityRules => Set<CoachCapacityRule>();
    public DbSet<CoachLayout> CoachLayouts => Set<CoachLayout>();
    public DbSet<CompositionVersion> CompositionVersion => Set<CompositionVersion>();
    public DbSet<TrainCoachComposition> TrainCoachComposition => Set<TrainCoachComposition>();
    public DbSet<TrainCapacitySummary> TrainCapacity => Set<TrainCapacitySummary>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Station>(e =>
        {
            e.ToTable("Stations");
            e.HasKey(x => x.Id);
            e.Property(x => x.Code).HasMaxLength(20);
            e.HasOne(x => x.Zone).WithMany().HasForeignKey(x => x.ZoneId).IsRequired(false);
        });

        modelBuilder.Entity<Zone>(e =>
        {
            e.ToTable("Zones");
            e.HasKey(x => x.Id);
        });

        modelBuilder.Entity<TrainType>(e =>
        {
            e.ToTable("TrainTypes");
            e.HasKey(x => x.Id);
        });

        modelBuilder.Entity<TrainMaster>(e =>
        {
            e.ToTable("TrainMaster");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.TrainNumber);
            e.HasOne(x => x.TrainType).WithMany().HasForeignKey(x => x.TrainTypeId);
            e.HasOne(x => x.Zone).WithMany().HasForeignKey(x => x.ZoneId);
            e.HasOne(x => x.SourceStation).WithMany().HasForeignKey(x => x.SourceStationId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.DestinationStation).WithMany().HasForeignKey(x => x.DestinationStationId).OnDelete(DeleteBehavior.Restrict);
            e.HasMany(x => x.RunningDays).WithOne(x => x.TrainMaster).HasForeignKey(x => x.TrainMasterId);
        });

        modelBuilder.Entity<TrainRoute>(e =>
        {
            e.ToTable("TrainRoutes");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TrainMasterId, x.StationId });
            e.HasOne(x => x.TrainMaster).WithMany(x => x.Routes).HasForeignKey(x => x.TrainMasterId);
            e.HasOne(x => x.Station).WithMany(x => x.Routes).HasForeignKey(x => x.StationId);
        });

        modelBuilder.Entity<TrainRunningDay>(e =>
        {
            e.ToTable("TrainRunningDays");
            e.HasKey(x => x.Id);
        });

        modelBuilder.Entity<RouteDistance>(e =>
        {
            e.ToTable("RouteDistances");
            e.HasKey(x => x.Id);
        });

        modelBuilder.Entity<DataVersion>(e =>
        {
            e.ToTable("DataVersion");
            e.HasKey(x => x.Id);
        });

        modelBuilder.Entity<ImportLog>(e =>
        {
            e.ToTable("ImportLogs");
            e.HasKey(x => x.Id);
        });

        modelBuilder.Entity<CoachModel>(e => { e.ToTable("CoachModels"); e.HasKey(x => x.Id); });
        modelBuilder.Entity<CoachTypeDefinition>(e => { e.ToTable("CoachTypes"); e.HasKey(x => x.Id); });
        modelBuilder.Entity<CoachCapacityRule>(e => { e.ToTable("CoachCapacityRules"); e.HasKey(x => x.Id); });
        modelBuilder.Entity<CoachLayout>(e => { e.ToTable("CoachLayouts"); e.HasKey(x => x.Id); });
        modelBuilder.Entity<CompositionVersion>(e => { e.ToTable("CompositionVersion"); e.HasKey(x => x.Id); });
        modelBuilder.Entity<TrainCoachComposition>(e =>
        {
            e.ToTable("TrainCoachComposition");
            e.HasKey(x => x.Id);
            e.HasOne(x => x.CoachType).WithMany().HasForeignKey(x => x.CoachTypeId);
            e.HasOne(x => x.CoachModel).WithMany().HasForeignKey(x => x.CoachModelId);
        });
        modelBuilder.Entity<TrainCapacitySummary>(e => { e.ToTable("TrainCapacity"); e.HasKey(x => x.Id); });
    }
}
