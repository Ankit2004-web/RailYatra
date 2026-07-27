import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import ProtectedRoute from '../components/ProtectedRoute';

function BookingsContent() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/bookings')
      .then(setBookings)
      .finally(() => setLoading(false));
  }, []);

  const cancel = async (id) => {
    if (!window.confirm('Cancel this booking?')) return;
    await api.put(`/bookings/${id}`, { status: 'Cancelled' });
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'Cancelled' } : b)));
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div className="container page">
      <h1>My Bookings</h1>
      {bookings.length === 0 ? (
        <div className="empty-state card">
          <h3>No bookings yet</h3>
          <Link to="/" className="btn btn-primary">Search Trains</Link>
        </div>
      ) : (
        <div className="booking-list">
          {bookings.map((b) => (
            <article key={b.id} className="booking-card card">
              <div className="booking-card-head">
                <div>
                  <span className="pnr">PNR {b.pnrNumber}</span>
                  <h3>{b.train?.trainName} ({b.train?.trainNumber})</h3>
                  <p className="muted">{b.train?.source} → {b.train?.destination} · {b.journeyDate}</p>
                </div>
                <span className={`status status-${b.status?.toLowerCase()}`}>{b.status}</span>
              </div>
              <div className="booking-meta">
                <span>Class: {b.classCode}</span>
                <span>₹{Number(b.totalPrice).toLocaleString('en-IN')}</span>
                <span>{b.passengers?.length || 0} passenger(s)</span>
              </div>
              {['Confirmed', 'Pending'].includes(b.status) && (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => cancel(b.id)}>
                  Cancel
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BookingsPage() {
  return (
    <ProtectedRoute>
      <BookingsContent />
    </ProtectedRoute>
  );
}
