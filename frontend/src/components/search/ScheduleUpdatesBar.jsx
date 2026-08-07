import { RefreshCw, AlertTriangle, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';

function formatTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function ScheduleUpdatesBar({ updates, loading, onRefresh, journeyDate }) {
  if (!updates?.trains?.length && !loading) return null;

  const delayed = (updates?.trains || []).filter((t) => (t.delayMinutes || 0) > 0);
  const cancelled = (updates?.trains || []).filter((t) => t.cancelled);
  const liveCount = (updates?.trains || []).filter((t) => (
    t.provider === 'ntes' || t.provider === 'railyatra+ntes' || String(t.dataSource || '').includes('ntes')
  )).length;

  return (
    <section className="schedule-updates-bar card" aria-live="polite" aria-label="Real-time schedule updates">
      <div className="schedule-updates-head">
        <strong>
          <Radio size={16} aria-hidden="true" /> Live schedule updates
        </strong>
        <span className="muted">
          {loading ? 'Refreshing…' : `Updated ${formatTime(updates?.updatedAt) || 'just now'}`}
          {liveCount > 0 ? ` · ${liveCount} from NTES` : ' · schedule fallback where NTES unavailable'}
        </span>
        {onRefresh && (
          <button type="button" className="btn btn-outline btn-sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={14} aria-hidden="true" /> Refresh
          </button>
        )}
      </div>

      {cancelled.length > 0 && (
        <p className="schedule-updates-alert is-cancel" role="status">
          <AlertTriangle size={16} aria-hidden="true" />
          {cancelled.length} train(s) may be cancelled or not running today.
        </p>
      )}

      {delayed.length > 0 && (
        <ul className="schedule-updates-list">
          {delayed.slice(0, 6).map((t) => (
            <li key={t.trainNumber}>
              <Link to={`/live-trains?train=${t.trainNumber}&date=${journeyDate}`}>
                <strong>{t.trainNumber}</strong>
                <span>{t.delayMinutes} min late</span>
                {t.currentLocation && <span className="muted"> · {t.currentLocation}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!loading && delayed.length === 0 && cancelled.length === 0 && (
        <p className="muted schedule-updates-ok" role="status">No major delays detected for trains on this page.</p>
      )}
    </section>
  );
}
