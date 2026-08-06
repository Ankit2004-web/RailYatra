import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrainFront, MapPin, Clock, Radio, Search, RefreshCw } from 'lucide-react';
import { api } from '../api/client';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatUpdatedAt(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
}

export default function LiveTrainPage() {
  const [trainNumber, setTrainNumber] = useState('');
  const [journeyDate, setJourneyDate] = useState(todayIso());
  const [trains, setTrains] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [hint, setHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastFetched, setLastFetched] = useState(null);

  const loadSuggestions = async () => {
    try {
      const data = await api.get('/live-trains');
      if (data.mode === 'suggestions') {
        setSuggestions(data.suggestions || []);
        setHint(data.message || '');
      }
    } catch {
      setSuggestions([]);
    }
  };

  useEffect(() => {
    loadSuggestions();
  }, []);

  const fetchLive = async (e, overrideNumber) => {
    if (e) e.preventDefault();
    const digits = String(overrideNumber ?? trainNumber).replace(/\D/g, '');
    if (digits.length !== 5) {
      setError('Enter a valid 5-digit train number.');
      return;
    }

    setLoading(true);
    setError('');
    setTrains([]);
    try {
      const q = new URLSearchParams({ q: digits, date: journeyDate });
      const data = await api.get(`/live-trains?${q}`);
      if (data.mode === 'live') {
        setTrains(data.trains || []);
        setLastFetched(new Date());
        if (!data.trains?.length) setError('No live status found for this train on the selected date.');
      } else {
        setSuggestions(data.suggestions || []);
        setHint(data.message || '');
        setError('Could not fetch live status.');
      }
    } catch (err) {
      setError(err.message || 'Could not fetch live status from NTES');
    } finally {
      setLoading(false);
    }
  };

  const providerLabel = useMemo(
    () => (trains[0]?.provider === 'ntes' ? 'Indian Railways NTES' : 'Live feed'),
    [trains]
  );

  return (
    <div className="live-train-page page-shell">
      <section className="page-hero">
        <div className="page-hero-inner page-hero-split">
          <div className="page-hero-copy">
            <span className="page-hero-badge">
              <Radio size={14} aria-hidden="true" /> Live from NTES
            </span>
            <h1 className="page-hero-title">Live Train Status</h1>
            <p className="page-hero-subtitle">
              Real-time running position, delay, and next station from Indian Railways
              National Train Enquiry System (NTES).
            </p>
          </div>
        </div>
      </section>

      <div className="page-body">
        <form className="card live-train-search" onSubmit={fetchLive}>
          <div className="live-train-search-row">
            <label className="field">
              <span>Train number</span>
              <input
                className="input"
                placeholder="e.g. 12301"
                inputMode="numeric"
                maxLength={5}
                value={trainNumber}
                onChange={(e) => setTrainNumber(e.target.value.replace(/\D/g, '').slice(0, 5))}
                required
              />
            </label>
            <label className="field">
              <span>Journey start date</span>
              <input
                type="date"
                className="input"
                value={journeyDate}
                onChange={(e) => setJourneyDate(e.target.value)}
                required
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <Search size={16} aria-hidden="true" />
              {loading ? 'Fetching…' : 'Track Train'}
            </button>
          </div>
        </form>

        {error && <div className="alert alert-error" role="alert">{error}</div>}

        {loading && (
          <div className="page-loading"><div className="spinner" aria-label="Loading" /></div>
        )}

        {!loading && trains.length > 0 && (
          <>
            <div className="live-train-meta-bar">
              <span>Source: <strong>{providerLabel}</strong></span>
              {lastFetched && <span>Fetched: {formatUpdatedAt(lastFetched.toISOString())}</span>}
              <button type="button" className="btn btn-outline btn-sm" onClick={fetchLive}>
                <RefreshCw size={14} aria-hidden="true" /> Refresh
              </button>
            </div>
            <div className="live-train-grid">
              {trains.map((train) => (
                <article key={`${train.trainNumber}-${train.lastUpdated}`} className="live-train-card card">
                  <div className="live-train-top">
                    <TrainFront size={18} aria-hidden="true" />
                    <strong>{train.trainNumber}</strong>
                    <span className={`status status-${train.status?.toLowerCase()}`}>{train.status}</span>
                  </div>
                  <h3>{train.trainName}</h3>
                  {train.source && train.destination && (
                    <p className="muted live-train-route">{train.source} → {train.destination}</p>
                  )}
                  {train.notice && (
                    <p className="alert alert-info" style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                      {train.notice}
                    </p>
                  )}
                  <ul className="live-train-meta">
                    <li><MapPin size={14} aria-hidden="true" /> Current: {train.currentLocation}</li>
                    <li><MapPin size={14} aria-hidden="true" /> Next: {train.nextStation}</li>
                    <li><Clock size={14} aria-hidden="true" /> Delay: {train.delayMinutes} min</li>
                    {train.platform && <li>Platform: {train.platform}</li>}
                    <li>Last NTES update: {formatUpdatedAt(train.lastUpdated)}</li>
                  </ul>
                  {train.events?.length > 0 && (
                    <div className="live-train-events">
                      <strong>Recent updates</strong>
                      <ul>
                        {train.events.slice(-5).reverse().map((ev) => (
                          <li key={`${ev.type}-${ev.station}-${ev.raw}`}>
                            {ev.type} — {ev.station}{ev.code ? ` (${ev.code})` : ''}
                            {ev.delay ? ` · delay ${ev.delay}` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </>
        )}

        {!loading && !trains.length && suggestions.length > 0 && (
          <div className="card live-train-suggestions">
            <h3>Popular trains</h3>
            {hint && <p className="muted">{hint}</p>}
            <div className="live-train-suggestion-grid">
              {suggestions.map((s) => (
                <button
                  key={s.trainNumber}
                  type="button"
                  className="live-train-suggestion"
                  onClick={() => {
                    setTrainNumber(s.trainNumber);
                    fetchLive(undefined, s.trainNumber);
                  }}
                >
                  <strong>{s.trainNumber}</strong>
                  <span>{s.trainName}</span>
                  <small>{s.route}</small>
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="muted" style={{ marginTop: '1rem' }}>
          Need PNR details? <Link to="/pnr">Check PNR status</Link>
        </p>
      </div>
    </div>
  );
}
