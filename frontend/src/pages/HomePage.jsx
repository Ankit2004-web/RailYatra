import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight, Search, TrainFront, MapPin, ShieldCheck,
  Route, Ticket, ArrowUpRight, Calendar, Radio, Headphones, Tag, XCircle, Bell
} from 'lucide-react';
import StationAutocomplete from '../components/StationAutocomplete';
import Modal from '../components/Modal';
import VoiceSearchButton from '../components/VoiceSearchButton';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { getMaxBookingDate, getTodayIso } from '../utils/bookingPolicy';

import { CLASS_OPTIONS } from '../constants/search';

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
  const location = useLocation();
  const { user } = useAuth();
  const today = getTodayIso();
  const maxBookingDate = getMaxBookingDate();
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState(() => {
    const initial = getTodayIso();
    return initial;
  });
  const [flexDays, setFlexDays] = useState(0);
  const [classCode, setClassCode] = useState('');
  const [routeAware, setRouteAware] = useState(true);
  const [recent, setRecent] = useState([]);
  const [routeModalOpen, setRouteModalOpen] = useState(false);
  const [searchHighlight, setSearchHighlight] = useState(false);
  const [upcoming, setUpcoming] = useState(null);

  useEffect(() => {
    if (!user) return;
    api.get('/bookings')
      .then((bookings) => {
        const next = (bookings || [])
          .filter((b) => ['Confirmed', 'RAC', 'Waitlisted', 'Pending'].includes(b.status))
          .filter((b) => String(b.journeyDate || '').slice(0, 10) >= today)
          .sort((a, b) => String(a.journeyDate).localeCompare(String(b.journeyDate)))[0];
        setUpcoming(next || null);
      })
      .catch(() => {});
  }, [user, today]);

  useEffect(() => {
    setRecent(loadRecent());
    const saved = localStorage.getItem('railyatra_route_aware');
    if (saved != null) setRouteAware(saved === 'true');

    const hash = location.hash.replace('#', '');
    if (hash === 'plan-journey') {
      setRouteModalOpen(true);
    }
  }, [location.hash]);

  const startRouteSearch = () => {
    setRouteModalOpen(false);
    setRouteAware(true);
    localStorage.setItem('railyatra_route_aware', 'true');
    setSearchHighlight(true);

    window.setTimeout(() => {
      document.getElementById('plan-journey')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => {
        document.getElementById('source')?.focus({ preventScroll: true });
      }, 450);
    }, 150);

    window.setTimeout(() => setSearchHighlight(false), 4000);
  };

  const swap = () => {
    setSource(destination);
    setDestination(source);
  };

  const runSearch = (src, dest, dt, cls) => {
    if (!src || !dest || !dt) return;
    const params = new URLSearchParams({ source: src, destination: dest, date: dt });
    if (cls) params.set('class', cls);
    if (routeAware) params.set('routeAware', '1');
    if (flexDays > 0) params.set('flexDays', String(flexDays));
    saveRecent({ source: src, destination: dest, date: dt, classCode: cls || '' });
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

          <form
            id="plan-journey"
            className={`home-search-card card${searchHighlight ? ' search-highlight' : ''}`}
            onSubmit={submit}
          >
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
                  max={maxBookingDate}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <p className="muted home-date-hint">Book up to 60 days in advance. Only trains running on the selected day are shown.</p>
              <div className="field">
                <label htmlFor="class">Class</label>
                <select id="class" className="input" value={classCode} onChange={(e) => setClassCode(e.target.value)}>
                  {CLASS_OPTIONS.map((o) => (
                    <option key={o.value || 'all'} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="flex">Flexible ± days</label>
                <select id="flex" className="input" value={flexDays} onChange={(e) => setFlexDays(Number(e.target.value))}>
                  <option value={0}>Exact date</option>
                  <option value={1}>± 1 day</option>
                  <option value={2}>± 2 days</option>
                  <option value={3}>± 3 days</option>
                </select>
              </div>
            </div>

            <label className="route-aware-toggle" htmlFor="route-aware">
              <input
                id="route-aware"
                type="checkbox"
                checked={routeAware}
                onChange={(e) => setRouteAware(e.target.checked)}
              />
              <span className="toggle-track" aria-hidden="true" />
              <span>Direct trains only (route-aware search)</span>
            </label>

            <VoiceSearchButton onResult={(text) => {
              const parts = text.split(/ to | से | towards /i);
              if (parts[0]) setSource(parts[0].trim().toUpperCase().slice(0, 10));
              if (parts[1]) setDestination(parts[1].trim().toUpperCase().slice(0, 10));
            }} />

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
                      onClick={() => runSearch(r.source, r.destination, r.date, r.classCode || classCode)}
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

      <section className="home-dashboard container">
        <h2 className="home-dashboard-title">Quick actions</h2>
        <div className="home-dashboard-grid">
          <button type="button" className="home-dash-card card" onClick={() => document.getElementById('plan-journey')?.scrollIntoView({ behavior: 'smooth' })}>
            <Search size={20} /><span>Search Train</span>
          </button>
          <Link to="/pnr" className="home-dash-card card"><Ticket size={20} /><span>PNR Status</span></Link>
          <Link to="/live-trains" className="home-dash-card card"><Radio size={20} /><span>Live Train Status</span></Link>
          <Link to="/book" className="home-dash-card card"><TrainFront size={20} /><span>Book Ticket</span></Link>
          <Link to="/bookings" className="home-dash-card card"><XCircle size={20} /><span>Cancel Ticket</span></Link>
          <Link to="/offers" className="home-dash-card card"><Tag size={20} /><span>Offers</span></Link>
          <Link to="/support" className="home-dash-card card"><Headphones size={20} /><span>Support</span></Link>
          <Link to="/bookings" className="home-dash-card card"><Bell size={20} /><span>Notifications</span></Link>
        </div>

        {upcoming && (
          <div className="home-upcoming card">
            <h3>Upcoming journey</h3>
            <p>
              <strong>{upcoming.train?.trainNumber || upcoming.trainNumber}</strong>
              {' · '}{upcoming.source} → {upcoming.destination}
              {' · '}{String(upcoming.journeyDate).slice(0, 10)}
              {' · '}PNR {upcoming.pnr}
            </p>
            <Link to="/bookings" className="btn btn-outline btn-sm">View booking</Link>
          </div>
        )}

        <div className="home-popular-routes card">
          <h3>Popular routes</h3>
          <div className="recent-chips">
            {[
              { source: 'NDLS', destination: 'BCT', label: 'Delhi → Mumbai' },
              { source: 'NDLS', destination: 'HWH', label: 'Delhi → Kolkata' },
              { source: 'BCT', destination: 'SBC', label: 'Mumbai → Bengaluru' },
              { source: 'MAS', destination: 'HYB', label: 'Chennai → Hyderabad' }
            ].map((r) => (
              <button
                key={r.label}
                type="button"
                className="recent-chip"
                onClick={() => runSearch(r.source, r.destination, date, classCode)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="home-features" id="features">
        <div className="home-features-inner">
          <button
            type="button"
            className="home-feature-card card home-feature-link"
            onClick={() => setRouteModalOpen(true)}
          >
            <div className="feature-card-top">
              <div className="feature-icon"><Route size={22} /></div>
              <span className="feature-arrow" aria-hidden="true">
                <ArrowUpRight size={18} />
              </span>
            </div>
            <h3>Route-aware search</h3>
            <p>Find trains that stop at both your boarding and alighting stations.</p>
            <div className="feature-illustration feature-illustration-route" aria-hidden="true">
              <span className="fi-pin" /><span className="fi-line" /><TrainFront size={14} /><span className="fi-line" /><span className="fi-pin" />
            </div>
          </button>

          <Link to="/pnr" className="home-feature-card card home-feature-link">
            <div className="feature-card-top">
              <div className="feature-icon"><Ticket size={22} /></div>
              <span className="feature-arrow" aria-hidden="true">
                <ArrowUpRight size={18} />
              </span>
            </div>
            <h3>PNR tracking</h3>
            <p>Check booking status anytime with your 10-digit PNR number.</p>
            <div className="feature-illustration feature-illustration-pnr" aria-hidden="true">
              <span className="fi-pnr-box">PNR — — — — — — — — — —</span>
              <Search size={14} />
            </div>
          </Link>

          <Link to="/login" className="home-feature-card card home-feature-link">
            <div className="feature-card-top">
              <div className="feature-icon"><ShieldCheck size={22} /></div>
              <span className="feature-arrow" aria-hidden="true">
                <ArrowUpRight size={18} />
              </span>
            </div>
            <h3>Secure booking</h3>
            <p>Login, select seats, and pay with simulated or Razorpay checkout.</p>
            <div className="feature-illustration feature-illustration-secure" aria-hidden="true">
              <ShieldCheck size={16} />
              <span className="fi-card" />
            </div>
          </Link>
        </div>
      </section>

      <Modal open={routeModalOpen} onClose={() => setRouteModalOpen(false)} title="Route-aware search" size="md">
        <div className="route-modal">
          <p>
            Route-aware search finds trains that stop at <strong>both</strong> your boarding station
            and your destination — not just trains that run on that overall route.
          </p>
          <div className="route-modal-example card">
            <div className="route-modal-stops">
              <span><MapPin size={14} aria-hidden="true" /> CNB (Kanpur)</span>
              <span className="route-modal-line" aria-hidden="true" />
              <span><TrainFront size={14} aria-hidden="true" /> Train stops here</span>
              <span className="route-modal-line" aria-hidden="true" />
              <span><MapPin size={14} aria-hidden="true" /> MGS (Mughal Sarai)</span>
            </div>
            <p className="muted">Only trains halting at both stations appear in results.</p>
          </div>
          <ul className="route-modal-list">
            <li>Enter <strong>From</strong> and <strong>To</strong> station codes or names</li>
            <li>Pick your journey date and class</li>
            <li>Keep the route-aware option enabled for accurate results</li>
          </ul>
          <button type="button" className="btn btn-primary btn-block" onClick={startRouteSearch}>
            <Search size={18} aria-hidden="true" /> Start searching
          </button>
        </div>
      </Modal>
    </div>
  );
}
