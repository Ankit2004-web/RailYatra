import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Armchair, CreditCard, Users, UserPlus, Trash2, LayoutGrid
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { completeBookingPayment } from '../utils/paymentFlow';
import CaptchaField from '../components/CaptchaField';
import CoachChartModal from '../components/search/CoachChartModal';
import { SavedPassengerPicker } from '../components/SavedPassengersPanel';
import PaymentOffersPanel from '../components/PaymentOffersPanel';
import { formatDisplayDate } from '../utils/trainMapper';
import { savedPassengerToBooking } from '../utils/passengerForm';
import { formatIrctcAvailability, irctcAvailabilityClass } from '../utils/irctcAvailability';
import { getAppliedOfferDetails } from '../utils/offerEngine';
import { calculatePaymentBreakdown } from '../utils/paymentBreakdown';
import {
  calculateMealTotal,
  MEAL_PRICES,
  trainProvidesMeals
} from '../utils/mealService';
import {
  BOOKING_TYPE_OPTIONS,
  QUOTA_OPTIONS,
  isSoldOut,
  isTatkalEligible
} from '../utils/bookingOptions';

const STEPS = [
  { num: 1, label: 'Class' },
  { num: 2, label: 'Passengers' },
  { num: 3, label: 'Review' },
  { num: 4, label: 'Pay' }
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
  const { user } = useAuth();
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
    { name: '', age: '', gender: 'Male', berthPreference: 'No Preference', nationality: 'Indian', mobile: '', email: '', idType: 'Aadhaar', idNumber: '', foodPreference: 'None', insuranceOptIn: false, isSeniorCitizen: false, isDivyang: false }
  ]);
  const [captcha, setCaptcha] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const bookingIdempotencyKey = useRef(null);
  const [step, setStep] = useState(1);
  const [chartOpen, setChartOpen] = useState(false);
  const [promoCode, setPromoCode] = useState(() => localStorage.getItem('railyatra_promo') || '');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [quota, setQuota] = useState('General');
  const [bookingType, setBookingType] = useState('General');
  const [joinWaitlist, setJoinWaitlist] = useState(false);
  const [joinRac, setJoinRac] = useState(false);

  useEffect(() => {
    if (!trainId) {
      navigate('/home');
      return;
    }
    if (!train) {
      api.get(`/trains/${trainId}`).then(setTrain).catch(() => navigate('/home'));
    }
  }, [trainId, train, navigate]);

  useEffect(() => {
    if (location.state?.classCode) {
      setClassCode(location.state.classCode);
    }
  }, [location.state?.classCode]);

  useEffect(() => {
    if (step !== 4) return;
    api.get('/payments/config')
      .then(setPaymentConfig)
      .catch(() => setPaymentConfig({ devMode: true }));
  }, [step]);

  const classes = train?.classes || [];
  const selectedClass = classes.find((c) => c.classCode === classCode);
  const mealsAvailable = trainProvidesMeals(train?.trainName, train?.trainTypeCode, classCode);
  const soldOut = isSoldOut(selectedClass, passengers.length);
  const tatkalEligible = isTatkalEligible(date);
  const baseTotal = selectedClass ? Number(selectedClass.price) * passengers.length : 0;
  const mealTotal = mealsAvailable ? calculateMealTotal(passengers) : 0;
  const offerCtx = { total: baseTotal, classCode, journeyDate: date, paymentMethod };
  const appliedOffer = getAppliedOfferDetails(promoCode, offerCtx);
  const discount = appliedOffer.savings || 0;
  const ticketFare = Math.max(baseTotal - discount, 0);
  const paymentBreakdown = useMemo(
    () => calculatePaymentBreakdown({
      ticketFare,
      passengerCount: passengers.length,
      mealFare: mealTotal
    }),
    [ticketFare, passengers.length, mealTotal]
  );
  const payableTotal = paymentBreakdown.totalFare;

  useEffect(() => {
    if (!mealsAvailable) {
      setPassengers((prev) => prev.map((p) => (
        p.foodPreference && p.foodPreference !== 'None'
          ? { ...p, foodPreference: 'None' }
          : p
      )));
    }
  }, [mealsAvailable, classCode]);

  const weekday = useMemo(() => {
    if (!date) return '';
    return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long' });
  }, [date]);

  const routeLabel = `${source || train?.from?.stationCode || train?.source || '—'} → ${destination || train?.to?.stationCode || train?.destination || '—'}`;
  const backUrl = `/search?source=${encodeURIComponent(source)}&destination=${encodeURIComponent(destination)}&date=${date}`;

  const addPassengerFromSaved = (saved) => {
    const mapped = savedPassengerToBooking(saved);
    const emptyIndex = passengers.findIndex((p) => !p.name.trim());
    if (emptyIndex >= 0) {
      setPassengers(passengers.map((p, i) => (i === emptyIndex ? mapped : p)));
      return;
    }
    if (passengers.length >= 6) return;
    setPassengers([...passengers, mapped]);
  };

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

  const payAndConfirm = async (booking) => completeBookingPayment(booking, user, {
    trainNumber: train.trainNumber,
    description: `${train.trainName} (${train.trainNumber}) · ${classCode}`
  }, { idempotencyKey: bookingIdempotencyKey.current, paymentMethod });

  const submit = async (e) => {
    e.preventDefault();
    if (submittingRef.current || loading) return;
    submittingRef.current = true;
    setError('');
    setLoading(true);
    if (!bookingIdempotencyKey.current) {
      bookingIdempotencyKey.current = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `book-${Date.now()}`;
    }
    try {
      if (soldOut && !joinWaitlist && !joinRac) {
        setError('Not enough seats available. Join waitlist or RAC to continue.');
        setLoading(false);
        return;
      }

      const payload = {
        trainId: Number(trainId),
        journeyDate: date,
        classCode,
        passengers: passengers.map((p) => ({ ...p, age: Number(p.age) })),
        bookingType: bookingType === 'Tatkal' && tatkalEligible ? 'Tatkal' : 'General',
        quota,
        joinWaitlist: soldOut && joinWaitlist,
        joinRac: soldOut && joinRac && !joinWaitlist,
        seatNumbers: [],
        ...captcha
      };

      if (train?.fromStopSequence) {
        payload.fromStopSequence = train.fromStopSequence;
        payload.toStopSequence = train.toStopSequence;
        payload.fromStationId = train.fromStationId;
        payload.toStationId = train.toStationId;
      }

      payload.fromStationCode = source || train?.from?.stationCode || train?.sourceStation?.code;
      payload.toStationCode = destination || train?.to?.stationCode || train?.destinationStation?.code;

      const booking = await api.post('/bookings', payload, { idempotencyKey: bookingIdempotencyKey.current });
      const final = await payAndConfirm(booking);
      bookingIdempotencyKey.current = null;
      navigate('/bookings', { state: { message: `Booked! PNR ${final.pnrNumber}` } });
    } catch (err) {
      const message = err.message || 'Booking failed';
      if (message === 'Payment cancelled') {
        setError('Payment was cancelled. Your booking is saved — complete payment from My Bookings or try again.');
      } else {
        setError(message);
      }
    } finally {
      submittingRef.current = false;
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

              <SavedPassengerPicker onSelect={addPassengerFromSaved} />

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
                      <div className="field">
                        <label htmlFor={`pnationality-${i}`}>Nationality</label>
                        <input id={`pnationality-${i}`} className="input" value={p.nationality || 'Indian'} onChange={(e) => updatePassenger(i, 'nationality', e.target.value)} />
                      </div>
                      {mealsAvailable && (
                        <div className="field">
                          <label htmlFor={`pfood-${i}`}>Meal (optional)</label>
                          <select id={`pfood-${i}`} className="input" value={p.foodPreference || 'None'} onChange={(e) => updatePassenger(i, 'foodPreference', e.target.value)}>
                            <option value="None">No meal</option>
                            <option value="Veg">Veg — ₹{MEAL_PRICES.Veg}</option>
                            <option value="Non-Veg">Non-Veg — ₹{MEAL_PRICES['Non-Veg']}</option>
                            <option value="Jain">Jain — ₹{MEAL_PRICES.Jain}</option>
                          </select>
                        </div>
                      )}
                      <div className="field">
                        <label htmlFor={`pidtype-${i}`}>ID type</label>
                        <select id={`pidtype-${i}`} className="input" value={p.idType || 'Aadhaar'} onChange={(e) => updatePassenger(i, 'idType', e.target.value)}>
                          <option>Aadhaar</option><option>PAN</option><option>Passport</option><option>Voter ID</option>
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor={`pidnum-${i}`}>ID number</label>
                        <input id={`pidnum-${i}`} className="input" value={p.idNumber || ''} onChange={(e) => updatePassenger(i, 'idNumber', e.target.value)} />
                      </div>
                      <label className="route-aware-toggle field-full">
                        <input type="checkbox" checked={!!p.insuranceOptIn} onChange={(e) => updatePassenger(i, 'insuranceOptIn', e.target.checked)} />
                        Travel insurance (₹0.45/person)
                      </label>
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

              <div className="booking-options card" style={{ marginTop: 20, padding: 16 }}>
                <h3 style={{ marginBottom: 12, fontSize: '1rem' }}>Booking options</h3>
                <div className="booking-form-grid">
                  <div className="field">
                    <label htmlFor="quota">Quota</label>
                    <select id="quota" className="input" value={quota} onChange={(e) => setQuota(e.target.value)}>
                      {QUOTA_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="bookingType">Booking type</label>
                    <select
                      id="bookingType"
                      className="input"
                      value={bookingType}
                      onChange={(e) => setBookingType(e.target.value)}
                      disabled={!tatkalEligible}
                    >
                      {BOOKING_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    {!tatkalEligible && (
                      <small className="muted">Tatkal opens 1–2 days before journey</small>
                    )}
                  </div>
                </div>

                {soldOut && (
                  <div className="booking-wl-options" style={{ marginTop: 12 }}>
                    <p className="muted" style={{ marginBottom: 8 }}>
                      Selected class has limited availability for {passengers.length} passenger(s).
                    </p>
                    <label className="route-aware-toggle">
                      <input
                        type="checkbox"
                        checked={joinWaitlist}
                        onChange={(e) => {
                          setJoinWaitlist(e.target.checked);
                          if (e.target.checked) setJoinRac(false);
                        }}
                      />
                      Join Waitlist (WL)
                    </label>
                    <label className="route-aware-toggle" style={{ marginLeft: 16 }}>
                      <input
                        type="checkbox"
                        checked={joinRac}
                        onChange={(e) => {
                          setJoinRac(e.target.checked);
                          if (e.target.checked) setJoinWaitlist(false);
                        }}
                      />
                      Join RAC
                    </label>
                  </div>
                )}

                {!soldOut && (
                  <p className="muted" style={{ marginTop: 10 }}>
                    Seats will be auto-assigned from available inventory after payment.
                  </p>
                )}
              </div>

              <div className="booking-btn-row">
                <button type="button" className="booking-btn-back" onClick={() => setStep(1)}>
                  <ArrowLeft size={16} aria-hidden="true" /> Back
                </button>
                <button type="button" className="booking-btn-primary" onClick={() => setStep(3)}>
                  Continue to Review <ArrowRight size={18} aria-hidden="true" />
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="booking-card-head">
                <div className="booking-card-icon" aria-hidden="true"><Users size={22} /></div>
                <div><h2>Review booking</h2><p>Verify passengers and journey details</p></div>
              </div>
              <div className="booking-summary">
                <div className="booking-summary-row"><span>Train</span><span>{train.trainName}</span></div>
                <div className="booking-summary-row"><span>Passengers</span><span>{passengers.length}</span></div>
                {passengers.map((p, i) => (
                  <div key={i} className="booking-summary-row">
                    <span>Passenger {i + 1}</span>
                    <span>
                      {p.name}
                      {mealsAvailable && p.foodPreference && p.foodPreference !== 'None'
                        ? ` · Meal: ${p.foodPreference}`
                        : ''}
                    </span>
                  </div>
                ))}
              </div>
              <div className="booking-btn-row">
                <button type="button" className="booking-btn-back" onClick={() => setStep(2)}><ArrowLeft size={16} /> Back</button>
                <button type="button" className="booking-btn-primary" onClick={() => setStep(4)}>Proceed to Payment <ArrowRight size={18} /></button>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div className="booking-card-head">
                <div className="booking-card-icon" aria-hidden="true">
                  <CreditCard size={22} />
                </div>
                <div>
                  <h2>Payment</h2>
                  <p>Complete secure checkout</p>
                </div>
              </div>

              {paymentConfig && (
                <div className={`booking-payment-badge ${paymentConfig.devMode ? 'dev' : 'live'}`}>
                  {paymentConfig.devMode
                    ? 'Payment keys not set — booking will be confirmed without Razorpay (demo mode)'
                    : 'Pay securely with Razorpay — UPI, cards, net banking & wallets'}
                </div>
              )}

              <PaymentOffersPanel
                baseTotal={baseTotal}
                classCode={classCode}
                journeyDate={date}
                appliedCode={appliedOffer.error ? '' : promoCode}
                onApplyCode={setPromoCode}
                paymentMethod={paymentMethod}
                onPaymentMethodChange={setPaymentMethod}
              />

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
                  <span>Quota / Type</span>
                  <span>{quota} · {bookingType === 'Tatkal' && tatkalEligible ? 'Tatkal' : 'General'}</span>
                </div>
                <div className="booking-summary-row">
                  <span>Seat assignment</span>
                  <span>{soldOut ? (joinWaitlist ? 'Waitlist' : joinRac ? 'RAC' : 'Not selected') : 'Auto-assign on confirm'}</span>
                </div>
                <div className="booking-summary-row">
                  <span>Boarding</span>
                  <span>{source || train?.from?.stationCode || train?.source || '—'}</span>
                </div>
                <div className="booking-summary-row">
                  <span>Alighting</span>
                  <span>{destination || train?.to?.stationCode || train?.destination || '—'}</span>
                </div>
                <div className="booking-summary-row">
                  <span>Ticket fare ({classCode} × {passengers.length})</span>
                  <span>Rs. {ticketFare.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                {mealTotal > 0 && (
                  <div className="booking-summary-row">
                    <span>Meals</span>
                    <span>Rs. {mealTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="booking-summary-row">
                  <span>Convenience fee (incl. GST)</span>
                  <span>Rs. {paymentBreakdown.irctcConvenienceFee.toFixed(2)}</span>
                </div>
                <div className="booking-summary-row">
                  <span>PG charge</span>
                  <span>Rs. {paymentBreakdown.pgCharge.toFixed(2)}</span>
                </div>
                {discount > 0 && appliedOffer.offer && (
                  <div className="booking-summary-row booking-summary-discount">
                    <span>Promo ({appliedOffer.offer.code})</span>
                    <span>−Rs. {discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="booking-summary-total">
                  <span>Total payable</span>
                  <span>Rs. {payableTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                {discount > 0 && (
                  <p className="booking-promo-note muted">
                    Promo {appliedOffer.offer.code} applied for display — final fare is calculated server-side.
                  </p>
                )}
              </div>

              <CaptchaField onChange={setCaptcha} />
              {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}

              <div className="booking-btn-row" style={{ marginTop: 24 }}>
                <button type="button" className="booking-btn-back" onClick={() => setStep(3)}>
                  <ArrowLeft size={16} aria-hidden="true" /> Back
                </button>
                <button type="submit" className="booking-btn-primary" disabled={loading}>
                  {loading
                    ? 'Processing…'
                    : paymentConfig?.devMode
                      ? 'Confirm & Pay (Dev)'
                      : 'Pay with Razorpay'}
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
  return <BookingContent />;
}
