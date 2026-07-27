import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { formatDisplayDate } from '../../utils/trainMapper';
import ResultsToolbar from './ResultsToolbar';

export default function SearchSummary({
  source,
  destination,
  date,
  weekday,
  trainCount,
  loading,
  sortBy,
  onSortChange
}) {
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
          <Link to="/" className="modify-link">
            <ArrowLeft size={14} aria-hidden="true" />
            Modify search
          </Link>
          <h1 className="search-route-title">
            {source} <span className="route-arrow" aria-hidden="true">→</span> {destination}
          </h1>
          <p className="search-hero-meta">
            {formatDisplayDate(date)} · {weekday} · {loading ? 'Searching…' : `${trainCount} train(s) found`}
          </p>
        </div>

        <div className="search-summary-actions">
          <ResultsToolbar sortBy={sortBy} onSortChange={onSortChange} />
        </div>
      </div>
    </section>
  );
}
