import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Armchair, CreditCard, Users, UserPlus, Trash2, LayoutGrid
} from 'lucide-react';
import { api } from '../api/client';
import ProtectedRoute from '../components/ProtectedRoute';
import CaptchaField from '../components/CaptchaField';
import CoachChartModal from '../components/search/CoachChartModal';
import { formatDisplayDate } from '../utils/trainMapper';
import { formatIrctcAvailability, irctcAvailabilityClass } from '../utils/irctcAvailability';

const STEPS = [
  { num: 1, label: 'Class' },
  { num: 2, label: 'Passengers' },
  { num: 3, label: 'Pay' }
];

const BERTH_OPTIONS = [
  'No Preference',
  'Lower',
  'Middle',
  'Upper',
  'Side Lower',
  'Side Upper'
];

function BookingStepper({ step }) {
  return (
    <div className="booking-stepper" role="list" aria-label="Booking progress">
      {STEPS.map(({ num, label }) => {
        const active = step === num;
        const done = step > num;
        return (
          <div
            key={num}
            role="listitem"
            className={`booking-step ${active ? 'active' : ''} ${done ? 'done' : ''}`}
            aria-current={active ? 'step' : undefined}
          >
            <div className="booking-step-circle">{num}</div>
            <span className="booking-step-label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function BookingContent() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const trainId = params.get('trainId');
  const date = params.get('date');
  const source = params.get('source') || '';
  const destination = params.get('destination') || '';

  const [train, setTrain] = useState(location.state?.train || null);
  const [classCode, setClassCode] = useState(location.state?.classCode || '');
  const [passengers, setPassengers] = useState([
    { name: '', age: '', gender: 'Male', berthPreference: 'No Preference' }
  ]);
  const [captcha, setCaptcha] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [chartOpen, setChartOpen] = useState(false);

  useEffect(() => {
    if (!trainId) {
      navigate('/');
      return;
    }
    if (!train) {
      api.get(`/trains/${trainId}`).then(setTrain).catch(() => navigate('/'));
    }
  }, [trainId, train, navigate]);

  useEffect(() => {
    if (location.state?.classCode) {
      setClassCode(location.state.classCode);
    }
  }, [location.state?.classCode]);

  const classes = train?.classes || [];
  const selectedClass = classes.find((c) => c.classCode === classCode);
  const total = selectedClass ? Number(selectedClass.price) * passengers.length : 0;

  const weekday = useMemo(() => {
    if (!date) return '';
    return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long' });
  }, [date]);

  const routeLabel = `${source || train?.from?.stationCode || train?.source || '—'} → ${destination || train?.to?.stationCode || train?.destination || '—'}`;
  const backUrl = `/search?source=${encodeURIComponent(source)}&destination=${encodeURIComponent(destination)}&date=${date}`;

  const addPassenger = () => {
    if (passengers.length >= 6) return;
    setPassengers([
      ...passengers,
      { name: '', age: '', gender: 'Male', berthPreference: 'No Preference' }
    ]);
  };

  const removePassenger = (idx) => {
    if (passengers.length <= 1) return;
    setPassengers(passengers.filter((_, i) => i !== idx));
  };

  const updatePassenger = (idx, key, value) => {
    setPassengers(passengers.map((p, i) => (i === idx ? { ...p, [key]: value } : p)));
  };

  const payAndConfirm = async (booking) => {
    const order = await api.post('/payments/create-order', { bookingId: booking.id, amount: booking.totalPrice });
    if (order.devMode) {
      const confirmed = await api.post('/payments/dev-confirm', { bookingId: booking.id });
      return confirmed.booking;
    }
    return booking;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        trainId: Number(trainId),
        journeyDate: date,
        classCode,
        passengers: passengers.map((p) => ({ ...p, age: Number(p.age) })),
        bookingType: 'General',
        quota: 'General',
        joinWaitlist: false,
        joinRac: false,
        seatNumbers: [],
        ...captcha
      };

      if (train?.fromStopSequence) {
        payload.fromStopSequence = train.fromStopSequence;
        payload.toStopSequence = train.toStopSequence;
        payload.fromStationId = train.fromStationId;
        payload.toStationId = train.toStationId;
      }

      const booking = await api.post('/bookings', payload);
      const final = await payAndConfirm(booking);
      navigate('/bookings', { state: { message: `Booked! PNR ${final.pnrNumber}` } });
    } catch (err) {
      setError(err.message || 'Booking failed');
    } finally {
      setLoading(false);
    }
  };

  if (!train) {
    return <div className="page-loading"><div className="spinner" aria-label="Loading" /></div>;
  }

  return (
    <div className="booking-page">
      <section className="booking-hero" aria-label="Booking header">
        <div className="booking-hero-media" aria-hidden="true">
          <img src="/search-train-banner.png" alt="" className="booking-hero-img" />
        </div>
        <div className="booking-hero-gradient" aria-hidden="true" />

        <div className="booking-hero-inner">
          <Link to={backUrl} className="booking-back-link">
            <ArrowLeft size={14} aria-hidden="true" />
            Back to results
          </Link>
          <h1 className="booking-hero-title">Book {train.trainName}</h1>
          <p className="booking-hero-meta">
            <strong>{routeLabel}</strong>
            {' · '}
            {formatDisplayDate(date)}
            {weekday ? ` · ${weekday}` : ''}
          </p>
          <BookingStepper step={step} />
        </div>
      </section>

      <div className="booking-body">
        <form className="booking-card" onSubmit={submit}>
          {step === 1 && (
            <>
              <div className="booking-card-head">
                <div className="booking-card-icon" aria-hidden="true">
                  <Armchair size={22} />
                </div>
                <div>
                  <h2>Select class</h2>
                  <p>Choose a class that suits your journey</p>
                </div>
              </div>

              {classes.length === 0 ? (
                <p className="booking-empty-classes">Class availability unavailable for this train.</p>
              ) : (
                <>
                  <div className="booking-irctc-toolbar">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setChartOpen(true)}
                    >
                      <LayoutGrid size={16} aria-hidden="true" />
                      Charts / Vacancy
                    </button>
                  </div>

                  <div className="irctc-booking-class-table-wrap">
                    <table className="irctc-table irctc-booking-class-table">
                      <thead>
                        <tr>
                          <th aria-label="Select" />
                          <th>Class</th>
                          <th>Fare</th>
                          <th>Availability</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classes.map((c) => {
                          const selected = classCode === c.classCode;
                          const avl = formatIrctcAvailability(c.availableSeats);
                          return (
                            <tr
                              key={c.classCode}
                              className={selected ? 'selected' : ''}
                              onClick={() => setClassCode(c.classCode)}
                            >
                              <td>
                                <input
                                  type="radio"
                                  name="travelClass"
                                  checked={selected}
                                  onChange={() => setClassCode(c.classCode)}
                                  aria-label={`Select ${c.classCode}`}
                                />
                              </td>
                              <td>
                                <strong>{c.classCode}</strong>
                                <span className="irctc-class-name">{c.className || c.classCode}</span>
                              </td>
                              <td>₹{Number(c.price).toLocaleString('en-IN')}</td>
                              <td>
                                <span className={irctcAvailabilityClass(avl.tone)}>{avl.text}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <button
                type="button"
                className="booking-btn-primary"
                disabled={!classCode}
                onClick={() => setStep(2)}
              >
                Continue <ArrowRight size={18} aria-hidden="true" />
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="booking-card-head">
                <div className="booking-card-icon" aria-hidden="true">
                  <Users size={22} />
                </div>
                <div>
                  <h2>Passenger details</h2>
                  <p>Enter details for all travellers on this booking</p>
                </div>
              </div>

              <div className="booking-passenger-list">
                {passengers.map((p, i) => (
                  <div key={i} className="booking-passenger-card">
                    <div className="booking-passenger-head">
                      <h3>Passenger {i + 1}</h3>
                      {passengers.length > 1 && (
                        <button
                          type="button"
                          className="booking-passenger-remove"
                          onClick={() => removePassenger(i)}
                        >
                          <Trash2 size={14} aria-hidden="true" /> Remove
                        </button>
                      )}
                    </div>
                    <div className="booking-form-grid">
                      <div className="field field-full">
                        <label htmlFor={`pname-${i}`}>Full name</label>
                        <input
                          id={`pname-${i}`}
                          className="input"
                          value={p.name}
                          onChange={(e) => updatePassenger(i, 'name', e.target.value)}
                          required
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`page-${i}`}>Age</label>
                        <input
                          id={`page-${i}`}
                          className="input"
                          type="number"
                          min="1"
                          max="120"
                          value={p.age}
                          onChange={(e) => updatePassenger(i, 'age', e.target.value)}
                          required
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`pgender-${i}`}>Gender</label>
                        <select
                          id={`pgender-${i}`}
                          className="input"
                          value={p.gender}
                          onChange={(e) => updatePassenger(i, 'gender', e.target.value)}
                        >
                          <option>Male</option>
                          <option>Female</option>
                          <option>Other</option>
                        </select>
                      </div>
                      <div className="field field-full">
                        <label htmlFor={`pberth-${i}`}>Berth preference</label>
                        <select
                          id={`pberth-${i}`}
                          className="input"
                          value={p.berthPreference}
                          onChange={(e) => updatePassenger(i, 'berthPreference', e.target.value)}
                        >
                          {BERTH_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {passengers.length < 6 && (
                <button type="button" className="btn btn-outline btn-sm booking-add-passenger" onClick={addPassenger}>
                  <UserPlus size={16} aria-hidden="true" /> Add passenger
                </button>
              )}

              <div className="booking-btn-row">
                <button type="button" className="booking-btn-back" onClick={() => setStep(1)}>
                  <ArrowLeft size={16} aria-hidden="true" /> Back
                </button>
                <button type="button" className="booking-btn-primary" onClick={() => setStep(3)}>
                  Continue to Payment <ArrowRight size={18} aria-hidden="true" />
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="booking-card-head">
                <div className="booking-card-icon" aria-hidden="true">
                  <CreditCard size={22} />
                </div>
                <div>
                  <h2>Review &amp; pay</h2>
                  <p>Confirm your booking details before payment</p>
                </div>
              </div>

              <div className="booking-summary">
                <div className="booking-summary-row">
                  <span>Train</span>
                  <span>{train.trainName} ({train.trainNumber})</span>
                </div>
                <div className="booking-summary-row">
                  <span>Route</span>
                  <span>{routeLabel}</span>
                </div>
                <div className="booking-summary-row">
                  <span>Date</span>
                  <span>{formatDisplayDate(date)}{weekday ? ` · ${weekday}` : ''}</span>
                </div>
                <div className="booking-summary-row">
                  <span>Class</span>
                  <span>{selectedClass?.className || classCode}</span>
                </div>
                <div className="booking-summary-row">
                  <span>Passengers</span>
                  <span>{passengers.length}</span>
                </div>
                <div className="booking-summary-row">
                  <span>Base fare ({classCode} × {passengers.length})</span>
                  <span>₹{total.toLocaleString('en-IN')}</span>
                </div>
                <div className="booking-summary-total">
                  <span>Total amount</span>
                  <span>₹{total.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <CaptchaField onChange={setCaptcha} />
              {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}

              <div className="booking-btn-row" style={{ marginTop: 24 }}>
                <button type="button" className="booking-btn-back" onClick={() => setStep(2)}>
                  <ArrowLeft size={16} aria-hidden="true" /> Back
                </button>
                <button type="submit" className="booking-btn-primary" disabled={loading}>
                  {loading ? 'Processing…' : 'Confirm & Pay'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>

      <CoachChartModal
        open={chartOpen}
        onClose={() => setChartOpen(false)}
        trainNumber={train.trainNumber}
        trainName={train.trainName}
        journeyDate={date}
        boardingStation={source || train?.sourceStation?.code || train?.source}
        classes={classes}
        initialClassCode={classCode}
      />
    </div>
  );
}

export default function BookingPage() {
  return (
    <ProtectedRoute>
      <BookingContent />
    </ProtectedRoute>
  );
}
