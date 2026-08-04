import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Ticket, Search, TrainFront, MapPin, Calendar, Users,
  CreditCard, ShieldCheck, Hash, Armchair, CircleAlert
} from 'lucide-react';
import { api } from '../api/client';
import { formatDisplayDate, formatJourneyDay, formatBoardingTime } from '../utils/trainMapper';

function formatPnrDisplay(value) {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}

function statusLabel(status) {
  if (!status) return 'Unknown';
  return status;
}

export default function PnrPage() {
  const location = useLocation();
  const [pnr, setPnr] = useState(() => location.state?.pnr?.replace(/\D/g, '').slice(0, 10) || '');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const digitCount = pnr.replace(/\D/g, '').length;
  const pnrReady = digitCount === 10;

  const weekday = useMemo(() => {
    if (!result?.journeyDate) return '';
    return new Date(`${result.journeyDate}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long' });
  }, [result?.journeyDate]);

  useEffect(() => {
    const digits = (location.state?.pnr || '').replace(/\D/g, '');
    if (digits.length !== 10) return;
    setLoading(true);
    setSearched(true);
    setError('');
    api.get(`/bookings/pnr/${digits}`)
      .then(setResult)
      .catch((err) => setError(err.message || 'PNR not found'))
      .finally(() => setLoading(false));
  }, [location.state?.pnr]);

  const submit = async (e) => {
    e.preventDefault();
    if (!pnrReady) return;
    setError('');
    setResult(null);
    setLoading(true);
    setSearched(true);
    try {
      const data = await api.get(`/bookings/pnr/${pnr.trim()}`);
      setResult(data);
    } catch (err) {
      setError(err.message || 'PNR not found');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setPnr('');
    setResult(null);
    setError('');
    setSearched(false);
  };

  return (
    <div className="pnr-page page-shell">
      <section className="pnr-hero page-hero">
        <div className="pnr-hero-inner page-hero-inner page-hero-split">
          <div className="pnr-hero-copy page-hero-copy">
            <span className="pnr-hero-badge page-hero-badge">
              <ShieldCheck size={14} aria-hidden="true" /> No login required
            </span>
            <h1 className="page-hero-title">PNR Status Enquiry</h1>
            <p className="page-hero-subtitle">
              Check your booking confirmation, train details, passenger list, and payment status
              instantly with your 10-digit PNR number.
            </p>
          </div>

          <form className="pnr-search-card page-hero-panel card" onSubmit={submit}>
            <div className="pnr-search-head">
              <div className="pnr-search-icon" aria-hidden="true">
                <Ticket size={22} />
              </div>
              <div>
                <h2>Enter PNR Number</h2>
                <p className="muted">Found on your ticket confirmation email or My Bookings</p>
              </div>
            </div>

            <div className="pnr-input-wrap">
              <label htmlFor="pnr" className="sr-only">PNR Number</label>
              <Hash size={18} className="pnr-input-icon" aria-hidden="true" />
              <input
                id="pnr"
                className="pnr-input"
                value={formatPnrDisplay(pnr)}
                onChange={(e) => setPnr(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="XXX XXXXXXX"
                inputMode="numeric"
                autoComplete="off"
                required
              />
              <span className={`pnr-digit-count${pnrReady ? ' ready' : ''}`}>
                {digitCount}/10
              </span>
            </div>

            <div className="pnr-search-actions">
              <button type="submit" className="btn btn-primary pnr-submit-btn" disabled={loading || !pnrReady}>
                <Search size={18} aria-hidden="true" />
                {loading ? 'Checking status…' : 'Get PNR Status'}
              </button>
              {(pnr || result || error) && (
                <button type="button" className="btn btn-outline" onClick={reset}>
                  Clear
                </button>
              )}
            </div>
          </form>
        </div>
      </section>

      <div className="pnr-body page-body">
        {error && (
          <div className="pnr-alert pnr-alert-error" role="alert">
            <CircleAlert size={20} aria-hidden="true" />
            <div>
              <strong>PNR not found</strong>
              <p>{error}. Please check the number and try again.</p>
            </div>
          </div>
        )}

        {searched && !loading && !error && !result && null}

        {result && (
          <article className="pnr-ticket card">
            <div className="pnr-ticket-top">
              <div className="pnr-ticket-brand">
                <TrainFront size={20} aria-hidden="true" />
                <span>E-Ticket / PNR Enquiry</span>
              </div>
              <span className={`pnr-status-pill status status-${result.status?.toLowerCase()}`}>
                {statusLabel(result.status)}
              </span>
            </div>

            <div className="pnr-ticket-pnr-row">
              <span className="pnr-ticket-label">PNR Number</span>
              <strong className="pnr-ticket-number">{result.pnrNumber}</strong>
            </div>

            <div className="pnr-train-head">
              <div>
                <span className="pnr-train-no">{result.train?.trainNumber}</span>
                <h2>{result.train?.trainName}</h2>
              </div>
              <span className="pnr-class-badge">{result.classCode}</span>
            </div>

            <div className="pnr-route-strip">
              <div className="pnr-route-station">
                <span className="pnr-route-code">{result.boarding?.code || result.train?.source}</span>
                <span className="pnr-route-label">Boarding</span>
                {result.boarding?.departureTime && (
                  <small>{formatBoardingTime(result.boarding.departureTime)}</small>
                )}
              </div>
              <div className="pnr-route-track" aria-hidden="true">
                <span className="pnr-route-dot" />
                <span className="pnr-route-line" />
                <TrainFront size={16} />
                <span className="pnr-route-line" />
                <span className="pnr-route-dot" />
              </div>
              <div className="pnr-route-station end">
                <span className="pnr-route-code">{result.alighting?.code || result.train?.destination}</span>
                <span className="pnr-route-label">Destination</span>
                {result.alighting?.arrivalTime && (
                  <small>{formatBoardingTime(result.alighting.arrivalTime)}</small>
                )}
              </div>
            </div>

            <div className="pnr-details-grid">
              <div className="pnr-detail-item">
                <Calendar size={16} aria-hidden="true" />
                <div>
                  <span>Journey Date</span>
                  <strong>
                    {formatJourneyDay(result.journeyDate)}
                    {result.boarding?.departureTime ? ` · Boarding ${formatBoardingTime(result.boarding.departureTime)}` : ''}
                  </strong>
                </div>
              </div>
              <div className="pnr-detail-item">
                <Armchair size={16} aria-hidden="true" />
                <div>
                  <span>Class</span>
                  <strong>{result.className || result.classCode}</strong>
                </div>
              </div>
              <div className="pnr-detail-item">
                <CreditCard size={16} aria-hidden="true" />
                <div>
                  <span>Payment</span>
                  <strong>{result.paymentStatus || '—'}</strong>
                </div>
              </div>
              <div className="pnr-detail-item">
                <Ticket size={16} aria-hidden="true" />
                <div>
                  <span>Booking Type</span>
                  <strong>{result.bookingType || 'General'}</strong>
                </div>
              </div>
              {result.quota && (
                <div className="pnr-detail-item">
                  <Users size={16} aria-hidden="true" />
                  <div>
                    <span>Quota</span>
                    <strong>{result.quota}</strong>
                  </div>
                </div>
              )}
              {result.totalPrice != null && (
                <div className="pnr-detail-item">
                  <CreditCard size={16} aria-hidden="true" />
                  <div>
                    <span>Total Fare</span>
                    <strong>₹{Number(result.totalPrice).toLocaleString('en-IN')}</strong>
                  </div>
                </div>
              )}
            </div>

            {result.waitlistPosition > 0 && (
              <div className="pnr-wl-banner">
                Waitlist position: <strong>WL #{result.waitlistPosition}</strong>
              </div>
            )}

            {result.seatNumbers?.length > 0 && (
              <div className="pnr-seats">
                <strong>Seat / Berth</strong>
                <div className="pnr-seat-chips">
                  {result.seatNumbers.map((seat) => (
                    <span key={seat} className="pnr-seat-chip">{seat}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="pnr-passengers">
              <div className="pnr-passengers-head">
                <Users size={18} aria-hidden="true" />
                <h3>Passenger Details</h3>
              </div>
              <div className="pnr-passenger-table-wrap">
                <table className="pnr-passenger-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Age</th>
                      <th>Gender</th>
                      <th>Berth Pref.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result.passengers || []).map((p, i) => (
                      <tr key={`${p.name}-${i}`}>
                        <td>{i + 1}</td>
                        <td>{p.name}</td>
                        <td>{p.age}</td>
                        <td>{p.gender}</td>
                        <td>{p.berthPreference || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pnr-ticket-foot">
              <MapPin size={14} aria-hidden="true" />
              <span>Booked on {formatDisplayDate(result.bookingDate)}</span>
            </div>
          </article>
        )}

        {!result && !error && (
          <div className="pnr-help-grid">
            <div className="pnr-help-card card">
              <Ticket size={20} aria-hidden="true" />
              <h3>Where is my PNR?</h3>
              <p>Your 10-digit PNR appears on the booking confirmation screen, email, and under My Bookings.</p>
            </div>
            <div className="pnr-help-card card">
              <ShieldCheck size={20} aria-hidden="true" />
              <h3>Secure enquiry</h3>
              <p>PNR lookup is public — no account needed. Only share your PNR with people you trust.</p>
            </div>
            <div className="pnr-help-card card">
              <TrainFront size={20} aria-hidden="true" />
              <h3>Need a new ticket?</h3>
              <p>Search trains between stations and book in a few clicks.</p>
              <Link to="/home" className="btn btn-outline btn-sm">Search Trains</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
