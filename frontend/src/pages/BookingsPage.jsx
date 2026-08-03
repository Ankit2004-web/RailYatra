import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, TrainFront, Calendar, Ticket, Users,
  CreditCard, Download, XCircle, Search, MapPin, Armchair,
  CheckCircle2, Clock, Ban
} from 'lucide-react';
import { api } from '../api/client';
import ProtectedRoute from '../components/ProtectedRoute';
import { formatDisplayDate } from '../utils/trainMapper';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'cancelled', label: 'Cancelled' }
];

function matchesFilter(booking, filter) {
  const today = new Date().toISOString().split('T')[0];
  if (filter === 'all') return true;
  if (filter === 'cancelled') return booking.status === 'Cancelled';
  if (filter === 'confirmed') return booking.status === 'Confirmed';
  if (filter === 'upcoming') {
    return booking.journeyDate >= today && !['Cancelled'].includes(booking.status);
  }
  return true;
}

async function downloadTicket(bookingId, pnrNumber) {
  const token = api.getToken();
  const response = await fetch(`/api/bookings/${bookingId}/ticket`, {
    headers: token ? { 'x-auth-token': token } : {}
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.msg || 'Could not download ticket');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `ticket-${pnrNumber}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function BookingCard({ booking, onCancel, onDownload, downloading }) {
  const passengerCount = booking.passengers?.length || 0;

  return (
    <article className="my-booking-card card">
      <div className="my-booking-top">
        <div className="my-booking-brand">
          <Ticket size={16} aria-hidden="true" />
          <span>PNR {booking.pnrNumber}</span>
        </div>
        <span className={`status status-${booking.status?.toLowerCase()}`}>
          {booking.status}
        </span>
      </div>

      <div className="my-booking-main">
        <div className="my-booking-train">
          <span className="my-booking-train-no">{booking.train?.trainNumber}</span>
          <h3>{booking.train?.trainName}</h3>
          <div className="my-booking-route">
            <MapPin size={14} aria-hidden="true" />
            <span>{booking.train?.source} → {booking.train?.destination}</span>
          </div>
        </div>
        <span className="my-booking-class">{booking.classCode}</span>
      </div>

      <div className="my-booking-meta-grid">
        <div className="my-booking-meta-item">
          <Calendar size={15} aria-hidden="true" />
          <div>
            <span>Journey</span>
            <strong>{formatDisplayDate(booking.journeyDate)}</strong>
          </div>
        </div>
        <div className="my-booking-meta-item">
          <Users size={15} aria-hidden="true" />
          <div>
            <span>Passengers</span>
            <strong>{passengerCount}</strong>
          </div>
        </div>
        <div className="my-booking-meta-item">
          <CreditCard size={15} aria-hidden="true" />
          <div>
            <span>Fare</span>
            <strong>₹{Number(booking.totalPrice).toLocaleString('en-IN')}</strong>
          </div>
        </div>
        <div className="my-booking-meta-item">
          <Armchair size={15} aria-hidden="true" />
          <div>
            <span>Class</span>
            <strong>{booking.className || booking.classCode}</strong>
          </div>
        </div>
      </div>

      {booking.waitlistPosition > 0 && (
        <div className="my-booking-wl">Waitlist position: WL #{booking.waitlistPosition}</div>
      )}

      {booking.refund?.refundAmount != null && booking.status === 'Cancelled' && (
        <div className="my-booking-refund">
          Refund: ₹{Number(booking.refund.refundAmount).toLocaleString('en-IN')}
          {booking.refund.refundPercent != null ? ` (${booking.refund.refundPercent}%)` : ''}
        </div>
      )}

      <div className="my-booking-actions">
        <Link to={`/pnr`} state={{ pnr: booking.pnrNumber }} className="btn btn-outline btn-sm">
          <Search size={14} aria-hidden="true" /> PNR Status
        </Link>
        {booking.status === 'Confirmed' && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={downloading}
            onClick={() => onDownload(booking)}
          >
            <Download size={14} aria-hidden="true" />
            {downloading ? 'Downloading…' : 'E-Ticket'}
          </button>
        )}
        {['Confirmed', 'Pending', 'Waitlisted', 'RAC'].includes(booking.status) && (
          <button
            type="button"
            className="btn btn-ghost btn-sm my-booking-cancel"
            onClick={() => onCancel(booking.id)}
          >
            <XCircle size={14} aria-hidden="true" /> Cancel
          </button>
        )}
      </div>

      <p className="my-booking-foot muted">
        Booked on {formatDisplayDate(booking.bookingDate)} · {booking.paymentStatus}
      </p>
    </article>
  );
}

function BookingsContent() {
  const location = useLocation();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState(location.state?.message || '');
  const [downloadingId, setDownloadingId] = useState(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    api.get('/bookings')
      .then(setBookings)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filtered = useMemo(
    () => bookings.filter((b) => matchesFilter(b, filter)),
    [bookings, filter]
  );

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      total: bookings.length,
      upcoming: bookings.filter((b) => b.journeyDate >= today && b.status !== 'Cancelled').length,
      confirmed: bookings.filter((b) => b.status === 'Confirmed').length
    };
  }, [bookings]);

  const cancel = async (id) => {
    if (!window.confirm('Cancel this booking?')) return;
    setActionError('');
    try {
      await api.put(`/bookings/${id}`, { status: 'Cancelled' });
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'Cancelled' } : b)));
      setToast('Booking cancelled successfully');
    } catch (err) {
      setActionError(err.message || 'Cancellation failed');
    }
  };

  const handleDownload = async (booking) => {
    setActionError('');
    setDownloadingId(booking.id);
    try {
      await downloadTicket(booking.id, booking.pnrNumber);
    } catch (err) {
      setActionError(err.message || 'Download failed');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="my-bookings-page">
        <div className="page-loading"><div className="spinner" aria-label="Loading" /></div>
      </div>
    );
  }

  return (
    <div className="my-bookings-page page-shell">
      <section className="my-bookings-hero page-hero">
        <div className="my-bookings-hero-inner page-hero-inner page-hero-split">
          <div className="page-hero-copy">
            <span className="my-bookings-badge page-hero-badge">
              <LayoutDashboard size={14} aria-hidden="true" /> Your trips
            </span>
            <h1 className="page-hero-title">My Bookings</h1>
            <p className="page-hero-subtitle">View upcoming journeys, download e-tickets, check PNR status, or cancel bookings.</p>
          </div>
          <div className="my-bookings-stats">
            <div className="my-bookings-stat">
              <strong>{stats.total}</strong>
              <span>Total</span>
            </div>
            <div className="my-bookings-stat">
              <strong>{stats.upcoming}</strong>
              <span>Upcoming</span>
            </div>
            <div className="my-bookings-stat">
              <strong>{stats.confirmed}</strong>
              <span>Confirmed</span>
            </div>
          </div>
        </div>
      </section>

      <div className="my-bookings-body page-body">
        {toast && (
          <div className="my-bookings-toast" role="status">
            <CheckCircle2 size={18} aria-hidden="true" />
            {toast}
          </div>
        )}

        {actionError && (
          <div className="my-bookings-alert" role="alert">{actionError}</div>
        )}

        {bookings.length > 0 && (
          <div className="my-bookings-toolbar">
            <div className="my-bookings-filters" role="tablist" aria-label="Filter bookings">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.id}
                  className={`my-bookings-filter${filter === f.id ? ' active' : ''}`}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <Link to="/" className="btn btn-primary btn-sm">
              <Search size={14} aria-hidden="true" /> Book another trip
            </Link>
          </div>
        )}

        {bookings.length === 0 ? (
          <div className="my-bookings-empty card">
            <div className="my-bookings-empty-icon" aria-hidden="true">
              <TrainFront size={36} />
            </div>
            <h2>No bookings yet</h2>
            <p>Search trains, pick your class, and complete payment to see tickets here.</p>
            <Link to="/" className="btn btn-primary">Search Trains</Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="my-bookings-empty card">
            <Ban size={32} aria-hidden="true" />
            <h2>No bookings in this filter</h2>
            <p>Try another tab or book a new journey.</p>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setFilter('all')}>
              Show all
            </button>
          </div>
        ) : (
          <div className="my-bookings-list">
            {filtered.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                onCancel={cancel}
                onDownload={handleDownload}
                downloading={downloadingId === b.id}
              />
            ))}
          </div>
        )}

        {bookings.length > 0 && (
          <div className="my-bookings-help card">
            <Clock size={18} aria-hidden="true" />
            <p>
              Need help? Check <Link to="/pnr">PNR Status</Link> without logging in, or visit{' '}
              <Link to="/contact">Contact Us</Link> for support.
            </p>
          </div>
        )}
      </div>
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
