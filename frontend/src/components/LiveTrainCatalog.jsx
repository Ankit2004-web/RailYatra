import { ChevronLeft, ChevronRight, Clock, MapPin, Radio, Search, TrainFront } from 'lucide-react';

export default function LiveTrainCatalog({
  items,
  totalItems,
  page,
  totalPages,
  loading,
  search,
  onSearchChange,
  onPageChange,
  selectedTrainNumber,
  onSelectTrain,
  journeyDate
}) {
  return (
    <aside className="live-catalog card" aria-label="All trains catalog">
      <div className="live-catalog-head">
        <div>
          <h2>All Trains</h2>
          <p className="muted">
            {totalItems.toLocaleString('en-IN')} trains · RailYatra stations only
          </p>
        </div>
        <span className="live-catalog-badge">
          <Radio size={14} aria-hidden="true" /> Live ready
        </span>
      </div>

      <label className="live-catalog-search" htmlFor="live-catalog-q">
        <Search size={16} aria-hidden="true" />
        <input
          id="live-catalog-q"
          className="input"
          placeholder="Search number, name, or route…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search all trains"
        />
      </label>

      <div className="live-catalog-list" role="list" aria-busy={loading}>
        {loading && (
          <div className="live-catalog-loading" aria-live="polite">Loading trains…</div>
        )}

        {!loading && items.length === 0 && (
          <p className="muted live-catalog-empty">No trains matched your search.</p>
        )}

        {!loading && items.map((train) => {
          const active = selectedTrainNumber === train.trainNumber;
          return (
            <button
              key={train.trainId || train.trainNumber}
              type="button"
              role="listitem"
              className={`live-catalog-item${active ? ' is-active' : ''}`}
              onClick={() => onSelectTrain(train.trainNumber)}
              aria-pressed={active}
            >
              <div className="live-catalog-item-top">
                <strong>{train.trainNumber}</strong>
                {train.trainTypeCode && (
                  <span className="live-catalog-type">{train.trainTypeCode}</span>
                )}
              </div>
              <span className="live-catalog-name">{train.trainName}</span>
              <span className="live-catalog-route">
                <MapPin size={12} aria-hidden="true" />
                {train.route}
              </span>
              <div className="live-catalog-meta">
                {train.departureTime && (
                  <span><Clock size={12} aria-hidden="true" /> {train.departureTime}</span>
                )}
                {train.stopCount > 0 && (
                  <span>{train.stopCount} app station{train.stopCount === 1 ? '' : 's'}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {totalPages > 1 && (
        <nav className="live-catalog-pagination" aria-label="Train catalog pages">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft size={14} />
          </button>
          <span>Page {page} of {totalPages}</span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight size={14} />
          </button>
        </nav>
      )}

      <p className="muted live-catalog-foot">
        Tracking for {journeyDate}. Routes use RailYatra catalog stations only.
      </p>
    </aside>
  );
}

export function LiveTrainCatalogSkeleton() {
  return (
    <div className="live-catalog card" aria-hidden="true">
      <div className="live-catalog-head"><div className="sk-line" style={{ width: '40%' }} /></div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="live-catalog-item skeleton" />
      ))}
    </div>
  );
}
