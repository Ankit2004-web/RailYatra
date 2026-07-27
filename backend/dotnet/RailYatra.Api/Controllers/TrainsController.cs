using Microsoft.AspNetCore.Mvc;
using RailYatra.Application.Services;

namespace RailYatra.Api.Controllers;

[ApiController]
[Route("api/trains")]
public class TrainsController(ITrainQueryService trains) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetTrains([FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        pageSize = Math.Clamp(pageSize, 1, 200);
        var result = await trains.GetTrainsAsync(page, pageSize, ct);
        return Ok(new { page, pageSize, count = result.Count, data = result });
    }

    [HttpGet("{trainNo}")]
    public async Task<IActionResult> GetTrain(string trainNo, CancellationToken ct = default)
    {
        var train = await trains.GetTrainAsync(trainNo, ct);
        return train is null ? NotFound(new { message = $"Train {trainNo} not found" }) : Ok(train);
    }

    [HttpGet("{trainNo}/route")]
    public async Task<IActionResult> GetRoute(string trainNo, CancellationToken ct = default)
    {
        var route = await trains.GetRouteAsync(trainNo, ct);
        if (route.Count == 0)
            return NotFound(new { message = $"Route for train {trainNo} not found" });
        return Ok(new { trainNumber = trainNo, stopCount = route.Count, stops = route });
    }
}
