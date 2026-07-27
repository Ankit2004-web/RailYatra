using Microsoft.AspNetCore.Mvc;
using RailYatra.Application.Services;

namespace RailYatra.Api.Controllers;

/// <summary>Alias routes per API spec: /api/train/{trainNo}</summary>
[ApiController]
[Route("api/train")]
public class TrainController(ITrainQueryService trains, ICoachCompositionQueryService coaches) : ControllerBase
{
    [HttpGet("{trainNo}")]
    public async Task<IActionResult> GetTrain(string trainNo, CancellationToken ct)
    {
        var train = await trains.GetTrainAsync(trainNo, ct);
        return train is null ? NotFound(new { message = $"Train {trainNo} not found" }) : Ok(train);
    }

    [HttpGet("{trainNo}/route")]
    public async Task<IActionResult> GetRoute(string trainNo, CancellationToken ct)
    {
        var route = await trains.GetRouteAsync(trainNo, ct);
        if (route.Count == 0)
            return NotFound(new { message = $"Route for train {trainNo} not found" });
        return Ok(new { trainNumber = trainNo, stopCount = route.Count, stops = route });
    }

    [HttpGet("{trainNo}/coaches")]
    public async Task<IActionResult> GetCoaches(string trainNo, CancellationToken ct)
    {
        var result = await coaches.GetCoachesAsync(trainNo, ct);
        return Ok(result);
    }

    [HttpGet("{trainNo}/capacity")]
    public async Task<IActionResult> GetCapacity(string trainNo, CancellationToken ct)
    {
        var result = await coaches.GetCapacityAsync(trainNo, ct);
        return Ok(result);
    }

    [HttpGet("{trainNo}/layout")]
    public async Task<IActionResult> GetLayout(string trainNo, CancellationToken ct)
    {
        var result = await coaches.GetLayoutAsync(trainNo, ct);
        return Ok(result);
    }
}
