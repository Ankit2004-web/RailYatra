import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Radio, Search } from 'lucide-react';
import { api } from '../api/client';
import LiveTrainTimeline from '../components/LiveTrainTimeline';
import LiveTrainCatalog from '../components/LiveTrainCatalog';

const REFRESH_MS = 120000;
const CATALOG_PAGE_SIZE = 24;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function useDebouncedValue(value, delayMs = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function LiveTrainPage() {
  const [params, setParams] = useSearchParams();
  const [trainNumber, setTrainNumber] = useState(params.get('train') || '');
  const [journeyDate, setJourneyDate] = useState(params.get('date') || todayIso());
  const [catalogSearch, setCatalogSearch] = useState(params.get('q') || '');
  const debouncedCatalogSearch = useDebouncedValue(catalogSearch);
  const [catalog, setCatalog] = useState({ items: [], totalItems: 0, totalPages: 1, page: 1 });
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [trains, setTrains] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastFetched, setLastFetched] = useState(null);
  const autoRefreshRef = useRef(null);
  const [catalogPage, setCatalogPage] = useState(Number(params.get('page') || 1));

  const syncUrl = useCallback((nextTrain, nextDate, nextQ, nextPage) => {
    const q = new URLSearchParams();
    if (nextTrain) q.set('train', nextTrain);
    if (nextDate) q.set('date', nextDate);
    if (nextQ) q.set('q', nextQ);
    if (nextPage && nextPage > 1) q.set('page', String(nextPage));
    setParams(q, { replace: true });
  }, [setParams]);

  const loadCatalog = useCallback(async (page, search) => {
    setCatalogLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(page),
        pageSize: String(CATALOG_PAGE_SIZE)
      });
      if (search) q.set('q', search);
      const data = await api.get(`/live-trains/catalog?${q}`);
      setCatalog({
        items: data.items || [],
        totalItems: data.totalItems || 0,
        totalPages: data.totalPages || 1,
        page: data.page || page
      });
    } catch {
      setCatalog({ items: [], totalItems: 0, totalPages: 1, page: 1 });
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog(catalogPage, debouncedCatalogSearch);
  }, [catalogPage, debouncedCatalogSearch, loadCatalog]);

  useEffect(() => {
    setCatalogPage(1);
  }, [debouncedCatalogSearch]);

  const fetchLive = useCallback(async (overrideNumber, { updateUrl = true } = {}) => {
    const digits = String(overrideNumber ?? trainNumber).replace(/\D/g, '');
    if (digits.length !== 5) {
      setError('Enter a valid 5-digit train number.');
      return;
    }

    setTrainNumber(digits);
    setLoading(true);
    setError('');
    try {
      const data = await api.get(`/live-trains/${digits}?date=${journeyDate}`);
      setTrains([data]);
      setLastFetched(new Date());
      if (updateUrl) syncUrl(digits, journeyDate, catalogSearch, catalogPage);
    } catch (err) {
      setTrains([]);
      setError(err.message || 'Could not fetch live status for this train.');
    } finally {
      setLoading(false);
    }
  }, [trainNumber, journeyDate, catalogSearch, catalogPage, syncUrl]);

  useEffect(() => {
    const fromUrl = params.get('train');
    if (fromUrl && /^\d{5}$/.test(fromUrl.replace(/\D/g, ''))) {
      fetchLive(fromUrl.replace(/\D/g, ''), { updateUrl: false });
    }
  }, [params, fetchLive]);

  useEffect(() => {
    if (autoRefreshRef.current) window.clearInterval(autoRefreshRef.current);
    if (!trains.length) return undefined;
    autoRefreshRef.current = window.setInterval(() => {
      fetchLive(trains[0]?.trainNumber, { updateUrl: false });
    }, REFRESH_MS);
    return () => {
      if (autoRefreshRef.current) window.clearInterval(autoRefreshRef.current);
    };
  }, [trains, fetchLive]);

  const handleSubmit = (e) => {
    e.preventDefault();
    fetchLive(trainNumber);
  };

  const handleSelectTrain = (number) => {
    fetchLive(number);
    if (window.innerWidth < 960) {
      document.getElementById('live-detail-panel')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="live-train-page page-shell">
      <section className="page-hero">
        <div className="page-hero-inner page-hero-split">
          <div className="page-hero-copy">
            <span className="page-hero-badge">
              <Radio size={14} aria-hidden="true" /> Live for every train
            </span>
            <h1 className="page-hero-title">Live Train Status</h1>
            <p className="page-hero-subtitle">
              Browse all {catalog.totalItems > 0 ? catalog.totalItems.toLocaleString('en-IN') : ''} trains in RailYatra.
              Every route uses verified stations from the app catalog, with optional live NTES delay overlay.
            </p>
          </div>
        </div>
      </section>

      <div className="page-body">
        <form className="card live-train-search" onSubmit={handleSubmit}>
          <div className="live-train-search-row">
            <label className="field" htmlFor="live-train-number">
              <span>Quick track by number</span>
              <input
                id="live-train-number"
                className="input"
                placeholder="e.g. 12021"
                inputMode="numeric"
                maxLength={5}
                value={trainNumber}
                onChange={(ev) => setTrainNumber(ev.target.value.replace(/\D/g, '').slice(0, 5))}
                aria-describedby="live-train-number-hint"
              />
              <span id="live-train-number-hint" className="sr-only">
                Enter a 5 digit train number, or pick any train from the catalog
              </span>
            </label>
            <label className="field" htmlFor="live-journey-date">
              <span>Journey start date</span>
              <input
                id="live-journey-date"
                type="date"
                className="input"
                value={journeyDate}
                onChange={(ev) => setJourneyDate(ev.target.value)}
                required
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <Search size={16} aria-hidden="true" />
              {loading ? 'Tracking…' : 'Track Train'}
            </button>
          </div>
        </form>

        <div className="live-trains-layout">
          <LiveTrainCatalog
            items={catalog.items}
            totalItems={catalog.totalItems}
            page={catalog.page}
            totalPages={catalog.totalPages}
            loading={catalogLoading}
            search={catalogSearch}
            onSearchChange={setCatalogSearch}
            onPageChange={(p) => {
              setCatalogPage(p);
              syncUrl(trainNumber, journeyDate, catalogSearch, p);
            }}
            selectedTrainNumber={trainNumber}
            onSelectTrain={handleSelectTrain}
            journeyDate={journeyDate}
          />

          <div id="live-detail-panel" className="live-trains-detail">
            {error && <div className="alert alert-error" role="alert">{error}</div>}

            {loading && (
              <div className="page-loading"><div className="spinner" aria-label="Loading live status" /></div>
            )}

            {!loading && trains.map((train) => (
              <LiveTrainTimeline
                key={`${train.trainNumber}-${train.lastUpdated}`}
                train={train}
                lastFetched={lastFetched}
                loading={loading}
                onRefresh={() => fetchLive(train.trainNumber, { updateUrl: false })}
              />
            ))}

            {!loading && !trains.length && (
              <div className="card live-trains-empty">
                <h3>Select a train to track</h3>
                <p className="muted">
                  Choose any train from the catalog on the left, or search by number or name.
                  Timelines show RailYatra stations only — not external NTES-only routes.
                </p>
                {catalog.items[0] && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleSelectTrain(catalog.items[0].trainNumber)}
                  >
                    Track {catalog.items[0].trainNumber} — {catalog.items[0].trainName}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <p className="muted" style={{ marginTop: '1rem' }}>
          Need PNR details? <Link to="/pnr">Check PNR status</Link>
        </p>
      </div>
    </div>
  );
}
