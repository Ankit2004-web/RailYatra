using RailYatra.Domain.Entities;

namespace RailYatra.Domain.Interfaces;

public interface IStationRepository
{
    Task<Station?> GetByCodeAsync(string code, CancellationToken ct = default);
    Task<Station?> ResolveAsync(string query, CancellationToken ct = default);
    Task<IReadOnlyList<Station>> SearchAsync(string query, int limit, CancellationToken ct = default);
    Task<IReadOnlyList<TrainMaster>> GetTrainsAtStationAsync(string stationCode, CancellationToken ct = default);
}
