namespace RailYatra.Domain.Entities;

public class Station
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string? NormalizedName { get; set; }
    public int? ZoneId { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public bool IsJunction { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Zone? Zone { get; set; }
    public ICollection<TrainRoute> Routes { get; set; } = [];
}
