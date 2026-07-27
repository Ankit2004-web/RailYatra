using Microsoft.AspNetCore.Mvc;
using RailYatra.Application.Services;

namespace RailYatra.Api.Controllers;

[ApiController]
[Route("api/station")]
public class StationsController(IStationQueryService stations) : ControllerBase
{
    [HttpGet("{stationCode}")]
    public async Task<IActionResult> GetStation(string stationCode, CancellationToken ct = default)
    {
        var station = await stations.GetStationAsync(stationCode, ct);
        return station is null
            ? NotFound(new { message = $"Station {stationCode} not found" })
            : Ok(station);
    }
}
