import { Link } from 'react-router-dom';
import { TrainFront } from 'lucide-react';

export default function EmptyState({ hasFilters, onClearFilters }) {
  return (
    <div className="state-panel empty-state-panel card" role="status">
      <div className="state-icon" aria-hidden="true">
        <TrainFront size={40} strokeWidth={1.2} />
      </div>
      <h3>No trains found</h3>
      <p className="muted">
        We couldn&apos;t find trains matching your current search or filters.
      </p>
      <div className="state-actions">
        <Link to="/" className="btn btn-primary">Modify Search</Link>
        {hasFilters && (
          <button type="button" className="btn btn-outline" onClick={onClearFilters}>
            Clear Filters
          </button>
        )}
      </div>
    </div>
  );
}
