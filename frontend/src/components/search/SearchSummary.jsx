import { useState } from 'react';
import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import { formatDisplayDate } from '../../utils/trainMapper';
import ResultsToolbar from './ResultsToolbar';
import InlineSearchForm from './InlineSearchForm';

export default function SearchSummary({
  source,
  destination,
  date,
  weekday,
  trainCount,
  loading,
  sortBy,
  onSortChange,
  routeAware,
  classCode,
  flexDays,
  onModifySearch
}) {
  const [showModify, setShowModify] = useState(false);

  const handleSearch = (payload) => {
    onModifySearch(payload);
    setShowModify(false);
  };

  return (
    <section className="search-summary card" aria-label="Search summary">
      <div className="search-summary-media" aria-hidden="true">
        <img
          src="/search-train-banner.png"
          alt=""
          className="search-summary-bg-img"
        />
      </div>
      <div className="search-summary-gradient" aria-hidden="true" />

      <div className="search-summary-content">
        <div className="search-summary-top">
          <div className="search-summary-route-block">
            <h1 className="search-route-title">
              {source} <span className="route-arrow" aria-hidden="true">→</span> {destination}
            </h1>
            <p className="search-hero-meta">
              {formatDisplayDate(date)} · {weekday} · {loading ? 'Searching…' : `${trainCount} train(s) found`}
              {classCode ? ` · Class ${classCode}` : ''}
              {routeAware ? ' · Route-aware search' : ' · All matching trains'}
            </p>
          </div>

          <button
            type="button"
            className={`modify-search-btn${showModify ? ' is-open' : ''}`}
            onClick={() => setShowModify((open) => !open)}
            aria-expanded={showModify}
            aria-controls="inline-search-panel"
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
            {showModify ? 'Hide search' : 'Modify search'}
            {showModify ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
          </button>
        </div>

        {showModify && (
          <div id="inline-search-panel" className="search-summary-modify">
            <InlineSearchForm
              initial={{ source, destination, date, classCode, routeAware, flexDays }}
              onSearch={handleSearch}
              onCancel={() => setShowModify(false)}
            />
          </div>
        )}

        <div className="search-summary-actions">
          <ResultsToolbar sortBy={sortBy} onSortChange={onSortChange} />
        </div>
      </div>
    </section>
  );
}
