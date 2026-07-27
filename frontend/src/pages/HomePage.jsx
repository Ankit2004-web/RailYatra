import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight, Search, TrainFront, MapPin, ShieldCheck,
  Route, Ticket, ArrowUpRight, Calendar, Tag
} from 'lucide-react';
import StationAutocomplete from '../components/StationAutocomplete';

const CLASS_OPTIONS = [
  { value: '', label: 'All Classes' },
  { value: 'SL', label: 'SL - Sleeper' },
  { value: '3A', label: '3A - AC 3 Tier' },
  { value: '2A', label: '2A - AC 2 Tier' },
  { value: '1A', label: '1A - AC First' },
  { value: '2S', label: '2S - Second Sitting' },
  { value: 'CC', label: 'CC - Chair Car' }
];

const RECENT_KEY = 'railyatra_recent_searches';
const MAX_RECENT = 5;

function loadRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecent(entry) {
  const list = loadRecent().filter(
    (r) => !(r.source === entry.source && r.destination === entry.destination)
  );
  list.unshift(entry);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
}

export default function HomePage() {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState(today);
  const [classCode, setClassCode] = useState('');
  const [routeAware, setRouteAware] = useState(true);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    setRecent(loadRecent());
    const saved = localStorage.getItem('railyatra_route_aware');
    if (saved != null) setRouteAware(saved === 'true');
    if (window.location.hash === '#offers') {
      document.getElementById('offers')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const swap = () => {
    setSource(destination);
    setDestination(source);
  };

  const runSearch = (src, dest, dt, cls) => {
    if (!src || !dest || !dt) return;
    const params = new URLSearchParams({ source: src, destination: dest, date: dt });
    if (cls) params.set('class', cls);
    saveRecent({ source: src, destination: dest, date: dt });
    setRecent(loadRecent());
    navigate(`/search?${params}`);
  };

  const submit = (e) => {
    e.preventDefault();
    localStorage.setItem('railyatra_route_aware', String(routeAware));
    runSearch(source, destination, date, classCode);
  };

  const clearRecent = () => {
    localStorage.removeItem(RECENT_KEY);
    setRecent([]);
  };

  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero-overlay" aria-hidden="true" />

        <div className="home-hero-inner">
          <div className="home-hero-copy">
            <div className="hero-brand-lockup">
              <img src="/logo.png" alt="RailYatra — Your journey, simplified" className="hero-logo" />
            </div>
            <span className="hero-badge">India-wide train search</span>
            <h1>RailYatra — find trains. Book smarter.</h1>
            <p>
              Search across thousands of stations and trains with route-aware results.
              Powered by imported open railway master data.
            </p>
            <div className="hero-stats">
              <div className="hero-stat">
                <TrainFront size={18} aria-hidden="true" />
                <span><strong>10K+</strong> Trains</span>
              </div>
              <div className="hero-stat">
                <MapPin size={18} aria-hidden="true" />
                <span><strong>8K+</strong> Stations</span>
              </div>
              <div className="hero-stat">
                <ShieldCheck size={18} aria-hidden="true" />
                <span><strong>100%</strong> Secure &amp; Reliable</span>
              </div>
            </div>
          </div>

          <form className="home-search-card card" onSubmit={submit}>
            <h2>Plan your journey</h2>

            <div className="home-search-row home-search-stations">
              <StationAutocomplete
                id="source"
                label="From"
                value={source}
                onChange={setSource}
                placeholder="Source station"
                required
                icon={MapPin}
              />
              <button type="button" className="home-swap-btn" onClick={swap} aria-label="Swap stations">
                <ArrowLeftRight size={16} />
              </button>
              <StationAutocomplete
                id="destination"
                label="To"
                value={destination}
                onChange={setDestination}
                placeholder="Destination station"
                required
                icon={MapPin}
              />
            </div>

            <div className="home-search-row home-search-meta">
              <div className="field field-icon">
                <label htmlFor="date"><Calendar size={14} aria-hidden="true" /> Journey date</label>
                <input
                  id="date"
                  type="date"
                  className="input"
                  value={date}
                  min={today}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="class">Class</label>
                <select id="class" className="input" value={classCode} onChange={(e) => setClassCode(e.target.value)}>
                  {CLASS_OPTIONS.map((o) => (
                    <option key={o.value || 'all'} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <label className="route-aware-toggle">
              <input
                type="checkbox"
                checked={routeAware}
                onChange={(e) => setRouteAware(e.target.checked)}
              />
              <span className="toggle-track" aria-hidden="true" />
              <span>Search with boarding &amp; alighting stations (Route-aware)</span>
            </label>

            <button type="submit" className="btn btn-primary btn-block btn-search-trains">
              <Search size={18} aria-hidden="true" /> Search Trains
            </button>

            {recent.length > 0 && (
              <div className="recent-searches">
                <div className="recent-head">
                  <span>Recent searches</span>
                  <button type="button" className="link-btn" onClick={clearRecent}>Clear all</button>
                </div>
                <div className="recent-chips">
                  {recent.map((r) => (
                    <button
                      key={`${r.source}-${r.destination}-${r.date}`}
                      type="button"
                      className="recent-chip"
                      onClick={() => runSearch(r.source, r.destination, r.date, classCode)}
                    >
                      {r.source} → {r.destination}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>
      </section>

      <section className="home-features" id="features">
        <div className="home-features-inner">
          <article className="home-feature-card card">
            <div className="feature-card-top">
              <div className="feature-icon"><Route size={22} /></div>
              <Link to="/" className="feature-arrow" aria-label="Route-aware search">
                <ArrowUpRight size={18} />
              </Link>
            </div>
            <h3>Route-aware search</h3>
            <p>Find trains that stop at both your boarding and alighting stations.</p>
            <div className="feature-illustration feature-illustration-route" aria-hidden="true">
              <span className="fi-pin" /><span className="fi-line" /><TrainFront size={14} /><span className="fi-line" /><span className="fi-pin" />
            </div>
          </article>

          <article className="home-feature-card card">
            <div className="feature-card-top">
              <div className="feature-icon"><Ticket size={22} /></div>
              <Link to="/pnr" className="feature-arrow" aria-label="PNR tracking">
                <ArrowUpRight size={18} />
              </Link>
            </div>
            <h3>PNR tracking</h3>
            <p>Check booking status anytime with your 10-digit PNR number.</p>
            <div className="feature-illustration feature-illustration-pnr" aria-hidden="true">
              <span className="fi-pnr-box">PNR — — — — — — — — — —</span>
              <Search size={14} />
            </div>
          </article>

          <article className="home-feature-card card">
            <div className="feature-card-top">
              <div className="feature-icon"><ShieldCheck size={22} /></div>
              <Link to="/login" className="feature-arrow" aria-label="Secure booking">
                <ArrowUpRight size={18} />
              </Link>
            </div>
            <h3>Secure booking</h3>
            <p>Login, select seats, and pay with simulated or Razorpay checkout.</p>
            <div className="feature-illustration feature-illustration-secure" aria-hidden="true">
              <ShieldCheck size={16} />
              <span className="fi-card" />
            </div>
          </article>
        </div>
      </section>

      <section className="home-offers" id="offers">
        <div className="home-offers-inner card">
          <Tag size={20} className="offers-icon" aria-hidden="true" />
          <div>
            <h3>Offers &amp; deals</h3>
            <p className="muted">Seasonal fare discounts and partner offers — coming soon.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
