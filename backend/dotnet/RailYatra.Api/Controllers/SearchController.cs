using Microsoft.AspNetCore.Mvc;
using RailYatra.Application.Services;

namespace RailYatra.Api.Controllers;

[ApiController]
[Route("api/search")]
public class SearchController(ITrainQueryService trains) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Search(
        [FromQuery] string from,
        [FromQuery] string to,
        [FromQuery] DateOnly? date,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(from) || string.IsNullOrWhiteSpace(to))
            return BadRequest(new { message = "Query parameters 'from' and 'to' are required" });

        try
        {
            var results = await trains.SearchAsync(from, to, date, ct);
            return Ok(new { from, to, date, count = results.Count, trains = results });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpGet("date")]
    public async Task<IActionResult> SearchByDate(
        [FromQuery] string from,
        [FromQuery] string to,
        [FromQuery] DateOnly date,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(from) || string.IsNullOrWhiteSpace(to))
            return BadRequest(new { message = "Query parameters 'from' and 'to' are required" });

        try
        {
            var results = await trains.SearchByDateAsync(from, to, date, ct);
            return Ok(new { from, to, date, count = results.Count, trains = results });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpGet("running")]
    public async Task<IActionResult> SearchByRunningDay(
        [FromQuery] string from,
        [FromQuery] string to,
        [FromQuery] DayOfWeek day,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(from) || string.IsNullOrWhiteSpace(to))
            return BadRequest(new { message = "Query parameters 'from' and 'to' are required" });

        try
        {
            var results = await trains.SearchByRunningDayAsync(from, to, day, ct);
            return Ok(new { from, to, day = day.ToString(), count = results.Count, trains = results });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }
}
