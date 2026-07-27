using Hangfire;
using RailYatra.Application;
using RailYatra.Infrastructure;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((ctx, cfg) => cfg
    .ReadFrom.Configuration(ctx.Configuration)
    .WriteTo.Console()
    .WriteTo.File("logs/railyatra-api-.log", rollingInterval: RollingInterval.Day));

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "RailYatra Master Data API", Version = "v1" });
});

builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

var app = builder.Build();

app.UseSerilogRequestLogging();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "RailYatra Master Data API v1"));
}

app.UseCors();
app.UseHangfireDashboard("/hangfire");
app.MapControllers();

app.MapGet("/health", () => Results.Ok(new { status = "healthy", service = "RailYatra.MasterData.Api" }));

Log.Information("RailYatra Master Data API starting on {Urls}", builder.Configuration["Urls"] ?? "http://localhost:5080");
app.Run();
