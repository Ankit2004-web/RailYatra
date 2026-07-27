using Microsoft.Extensions.DependencyInjection;
using RailYatra.Application.Services;

namespace RailYatra.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<ITrainQueryService, TrainQueryService>();
        services.AddScoped<IStationQueryService, StationQueryService>();
        services.AddScoped<ICoachCompositionQueryService, CoachCompositionQueryService>();
        return services;
    }
}
