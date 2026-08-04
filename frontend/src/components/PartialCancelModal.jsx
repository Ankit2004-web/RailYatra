import { useState } from 'react';
import { UserMinus } from 'lucide-react';
import { api } from '../api/client';

export default function PartialCancelModal({ booking, open, onClose, onDone }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open || !booking) return null;

  const remove = async (passengerId, name) => {
    if (!window.confirm(`Remove ${name} from this booking?`)) return;
    setLoading(true);
    setError('');
    try {
      await api.delete(`/bookings/${booking.id}/passengers/${passengerId}`);
      onDone?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not remove passenger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="card partial-cancel-modal">
        <h2><UserMinus size={18} /> Partial cancellation</h2>
        <p className="muted">Remove individual passengers from PNR {booking.pnr || booking.pnrNumber}</p>
        <ul className="partial-cancel-list">
          {(booking.passengers || []).map((p) => (
            <li key={p.id}>
              <span>{p.name} ({p.age}, {p.gender})</span>
              <button type="button" className="btn btn-outline btn-sm" disabled={loading || (booking.passengers?.length <= 1)} onClick={() => remove(p.id, p.name)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        {error && <p className="alert alert-error">{error}</p>}
        <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
