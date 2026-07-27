import { Link } from 'react-router-dom';
import { RefreshCw, AlertCircle } from 'lucide-react';

export default function ErrorState({ onRetry }) {
  return (
    <div className="state-panel error-state-panel card" role="alert">
      <div className="state-icon error" aria-hidden="true">
        <AlertCircle size={40} strokeWidth={1.5} />
      </div>
      <h3>Unable to load trains</h3>
      <p className="muted">
        We couldn&apos;t retrieve train information right now. Please try again.
      </p>
      <div className="state-actions">
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          <RefreshCw size={16} /> Retry
        </button>
        <Link to="/" className="btn btn-outline">Modify Search</Link>
      </div>
    </div>
  );
}
