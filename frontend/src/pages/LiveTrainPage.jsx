import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrainFront, MapPin, Clock, Gauge } from 'lucide-react';
import { api } from '../api/client';

export default function LiveTrainPage() {
  const [query, setQuery] = useState('');
  const [trains, setTrains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/live-trains')
      .then(setTrains)
      .catch((err) => setError(err.message || 'Could not load live trains'))
      .finally(() => setLoading(false));
  }, []);

  const search = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const results = await api.get(`/live-trains${query ? `?q=${encodeURIComponent(query)}` : ''}`);
      setTrains(results);
    } catch (err) {
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="live-train-page page-shell">
      <div className="container">
        <div className="page-hero-inner">
          <span className="page-hero-badge">Development simulation</span>
          <h1>Live Train Status</h1>
          <p className="muted">Track running position, delay, and next station (simulated for demo).</p>
        </div>

        <form className="card live-train-search" onSubmit={search}>
          <input
            className="input"
            placeholder="Search by train number or name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">Search</button>
        </form>

        {error && <div className="alert alert-error">{error}</div>}
        {loading ? (
          <div className="page-loading"><div className="spinner" aria-label="Loading" /></div>
        ) : (
          <div className="live-train-grid">
            {trains.map((train) => (
              <article key={train.trainId} className="live-train-card card">
                <div className="live-train-top">
                  <TrainFront size={18} aria-hidden="true" />
                  <strong>{train.trainNumber}</strong>
                  <span className={`status status-${train.status?.toLowerCase()}`}>{train.status}</span>
                </div>
                <h3>{train.trainName}</h3>
                <ul className="live-train-meta">
                  <li><MapPin size={14} /> Current: {train.currentLocation}</li>
                  <li><MapPin size={14} /> Next: {train.nextStation}</li>
                  <li><Clock size={14} /> Delay: {train.delayMinutes} min</li>
                  <li><Gauge size={14} /> Speed: {train.speedKmph} km/h</li>
                  <li>Platform: {train.platform}</li>
                </ul>
              </article>
            ))}
          </div>
        )}

        <p className="muted" style={{ marginTop: '1rem' }}>
          Need PNR details? <Link to="/pnr">Check PNR status</Link>
        </p>
      </div>
    </div>
  );
}
