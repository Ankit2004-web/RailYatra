import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { api } from '../api/client';
import TrainCard, { TrainCardSkeleton } from '../components/TrainCard';
import SearchFilters, { defaultFilters } from '../components/SearchFilters';
import SearchSummary from '../components/search/SearchSummary';
import EmptyState from '../components/search/EmptyState';
import ErrorState from '../components/search/ErrorState';
import MobileFilterDrawer from '../components/search/MobileFilterDrawer';
import TrainRouteModal from '../components/search/TrainRouteModal';
import CoachChartModal from '../components/search/CoachChartModal';
import { useAuth } from '../context/AuthContext';
import {
  applyTrainFilters,
  activeFilterCount,
  countByDuration
} from '../utils/trainFilters';
import {
  collectAvailableClasses,
  collectClassPrices,
  collectTrainTypes,
  mapTrainApiResponseToViewModel
} from '../utils/trainMapper';

const PAGE_SIZES = [10, 20, 50];

export default function SearchResultsPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const source = params.get('source') || '';
  const destination = params.get('destination') || '';
  const date = params.get('date') || '';
  const urlClass = params.get('class') || '';
  const flexDays = params.get('flexDays') || '';
  const routeAware = params.get('routeAware') === '1';

  const [trains, setTrains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [routeModal, setRouteModal] = useState(null);
  const [chartModal, setChartModal] = useState(null);
  const [filters, setFilters] = useState(defaultFilters(urlClass));
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters(urlClass));
  const [sortBy, setSortBy] = useState('departure-early');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [selectedClasses, setSelectedClasses] = useState({});
  const [searchMeta, setSearchMeta] = useState(null);

  const searchContext = useMemo(() => ({
    fromCode: searchMeta?.from?.code || '',
    fromName: searchMeta?.from?.name || source,
    toCode: searchMeta?.to?.code || '',
    toName: searchMeta?.to?.name || destination
  }), [searchMeta, source, destination]);

  const weekday = date
    ? new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long' })
    : '';

  const fetchTrains = useCallback(() => {
    if (!source || !destination || !date) return;

    setLoading(true);
    setError(false);
    setPage(1);
    const q = new URLSearchParams({ source, destination, date });
    if (urlClass) q.set('class', urlClass);
    if (flexDays) q.set('flexDays', flexDays);

    api.get(`/trains/search?${q}`)
      .then((data) => {
        if (Array.isArray(data)) {
          setTrains(data);
          setSearchMeta(null);
        } else {
          setTrains(data.trains || []);
          setSearchMeta(data.searchMeta || null);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [source, destination, date, urlClass, flexDays]);

  useEffect(() => {
    if (!source || !destination || !date) {
      navigate('/home');
      return;
    }
    fetchTrains();
  }, [source, destination, date, urlClass, flexDays, navigate, fetchTrains]);

  const classOptions = useMemo(() => collectAvailableClasses(trains), [trains]);
  const classPrices = useMemo(() => collectClassPrices(trains), [trains]);
  const trainTypes = useMemo(() => collectTrainTypes(trains), [trains]);
  const durationCounts = useMemo(() => {
    const vms = trains.map((t) => mapTrainApiResponseToViewModel(t, date));
    return countByDuration(vms);
  }, [trains, date]);

  const filtered = useMemo(
    () => applyTrainFilters(trains, appliedFilters, sortBy, date, searchContext),
    [trains, appliedFilters, sortBy, date, searchContext]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const filterCount = activeFilterCount(appliedFilters);

  const applyFilters = () => {
    setAppliedFilters({ ...filters });
    setPage(1);
  };

  const clearFilters = () => {
    const d = defaultFilters();
    setFilters(d);
    setAppliedFilters(d);
    setPage(1);
  };

  const handleClassSelect = (trainId, classCode) => {
    setSelectedClasses((prev) => ({ ...prev, [trainId]: classCode }));
  };

  const showChart = (train, classCode) => {
    setChartModal({
      trainNumber: train.trainNumber,
      trainName: train.trainName,
      classes: train.classes || [],
      classCode: classCode || train.classes?.[0]?.classCode || ''
    });
  };

  const showRoute = async (trainId) => {
    try {
      const data = await api.get(`/trains/${trainId}/route`);
      setRouteModal(data);
    } catch {
      setRouteModal({ error: 'Could not load route details.' });
    }
  };

  const handleBook = (train, classCode) => {
    const id = train.trainId || train.id;
    const selected = classCode || selectedClasses[id] || train.classes?.[0]?.classCode;
    if (!user) {
      navigate('/login', {
        state: { from: `/book?trainId=${id}&date=${date}&source=${encodeURIComponent(source)}&destination=${encodeURIComponent(destination)}` }
      });
      return;
    }
    navigate(
      `/book?trainId=${id}&date=${date}&source=${encodeURIComponent(source)}&destination=${encodeURIComponent(destination)}`,
      { state: { train, classCode: selected } }
    );
  };

  const renderPagination = () => {
    if (loading || error || filtered.length === 0) return null;

    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, safePage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);
    for (let p = start; p <= end; p += 1) pages.push(p);

    return (
      <div className="search-pagination card">
        <span className="pagination-info">
          Showing {(safePage - 1) * pageSize + 1} – {Math.min(safePage * pageSize, filtered.length)} of {filtered.length} trains
        </span>
        <div className="pagination-controls" role="navigation" aria-label="Pagination">
          <button type="button" className="page-btn" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} aria-label="Previous page">
            <ChevronLeft size={16} />
          </button>
          {pages.map((p) => (
            <button
              key={p}
              type="button"
              className={`page-btn ${safePage === p ? 'active' : ''}`}
              onClick={() => setPage(p)}
              aria-current={safePage === p ? 'page' : undefined}
            >
              {p}
            </button>
          ))}
          <button type="button" className="page-btn" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} aria-label="Next page">
            <ChevronRight size={16} />
          </button>
        </div>
        <label className="page-size-select">
          Trains per page:
          <select className="input" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
    );
  };

  return (
    <div className="search-results-page">
      <div className="results-container page">
        <SearchSummary
          source={source}
          destination={destination}
          date={date}
          weekday={weekday}
          trainCount={filtered.length}
          loading={loading}
          sortBy={sortBy}
          onSortChange={(v) => { setSortBy(v); setPage(1); }}
          routeAware={routeAware}
        />

        <button
          type="button"
          className="mobile-filter-trigger"
          onClick={() => setMobileFiltersOpen(true)}
        >
          <SlidersHorizontal size={16} />
          Filters
          {filterCount > 0 && <span className="filter-badge">{filterCount}</span>}
        </button>

        <div className="results-layout">
          <SearchFilters
            filters={filters}
            onChange={setFilters}
            onApply={applyFilters}
            onClear={clearFilters}
            classOptions={classOptions}
            classPrices={classPrices}
            trainTypes={trainTypes}
            durationCounts={durationCounts}
          />

          <main className="train-results">
            <div className="train-results-list">
              {loading && Array.from({ length: 4 }).map((_, i) => <TrainCardSkeleton key={i} />)}

              {!loading && error && <ErrorState onRetry={fetchTrains} />}

              {!loading && !error && filtered.length === 0 && (
                <EmptyState hasFilters={filterCount > 0} onClearFilters={clearFilters} />
              )}

              {!loading && !error && paginated.map((train) => {
                const id = train.trainId || train.id;
                return (
                  <TrainCard
                    key={id}
                    train={train}
                    journeyDate={date}
                    searchContext={searchContext}
                    selectedClass={selectedClasses[id]}
                    onClassSelect={handleClassSelect}
                    onBook={handleBook}
                    onRoute={showRoute}
                    onChart={showChart}
                  />
                );
              })}
            </div>

            {renderPagination()}
          </main>
        </div>

        <MobileFilterDrawer
          open={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
          filters={filters}
          onChange={setFilters}
          onApply={applyFilters}
          onClear={clearFilters}
          classOptions={classOptions}
          classPrices={classPrices}
          trainTypes={trainTypes}
          durationCounts={durationCounts}
        />

        <TrainRouteModal
          data={routeModal}
          onClose={() => setRouteModal(null)}
          highlightFrom={source}
          highlightTo={destination}
        />

        <CoachChartModal
          open={!!chartModal}
          onClose={() => setChartModal(null)}
          trainNumber={chartModal?.trainNumber}
          trainName={chartModal?.trainName}
          journeyDate={date}
          boardingStation={source}
          classes={chartModal?.classes || []}
          initialClassCode={chartModal?.classCode || ''}
        />
      </div>
    </div>
  );
}
