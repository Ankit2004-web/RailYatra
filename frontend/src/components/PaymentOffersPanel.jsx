import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Tag, Sparkles, Copy, Check, ChevronRight } from 'lucide-react';
import { getAppliedOfferDetails, getRecommendedOffers } from '../utils/offerEngine';

export default function PaymentOffersPanel({
  baseTotal,
  classCode,
  journeyDate,
  appliedCode,
  onApplyCode,
  paymentMethod,
  onPaymentMethodChange
}) {
  const [promoInput, setPromoInput] = useState(appliedCode || '');
  const [promoError, setPromoError] = useState('');
  const [copiedCode, setCopiedCode] = useState('');

  const ctx = useMemo(
    () => ({ total: baseTotal, classCode, journeyDate, paymentMethod }),
    [baseTotal, classCode, journeyDate, paymentMethod]
  );

  const recommendations = useMemo(
    () => getRecommendedOffers(ctx, 3),
    [ctx]
  );

  const applied = useMemo(
    () => getAppliedOfferDetails(appliedCode, ctx),
    [appliedCode, ctx]
  );

  useEffect(() => {
    setPromoInput(appliedCode || '');
  }, [appliedCode]);

  useEffect(() => {
    if (applied.error && appliedCode) {
      setPromoError(applied.error);
    } else {
      setPromoError('');
    }
  }, [applied.error, appliedCode]);

  const applyPromo = (code) => {
    const trimmed = (code || promoInput).trim().toUpperCase();
    if (!trimmed) {
      setPromoError('Enter a coupon code');
      return;
    }

    const result = getAppliedOfferDetails(trimmed, ctx);
    if (result.error) {
      setPromoError(result.error);
      onApplyCode('');
      return;
    }

    setPromoError('');
    setPromoInput(trimmed);
    onApplyCode(trimmed);
    localStorage.setItem('railyatra_promo', trimmed);
  };

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode(''), 2000);
    } catch {
      setCopiedCode('');
    }
  };

  return (
    <div className="payment-offers-panel">
      <div className="payment-offers-head">
        <div>
          <span className="payment-offers-eyebrow">
            <Sparkles size={14} aria-hidden="true" /> Recommended for you
          </span>
          <h3>Apply offers &amp; save</h3>
        </div>
        <Link to="/offers" className="payment-offers-link">
          View all offers <ChevronRight size={14} aria-hidden="true" />
        </Link>
      </div>

      <div className="payment-method-row">
        <span className="payment-method-label">Preferred method</span>
        <div className="payment-method-options">
          {[
            { id: 'card', label: 'Card' },
            { id: 'upi', label: 'UPI' },
            { id: 'netbanking', label: 'Net Banking' },
            { id: 'wallet', label: 'Wallet' }
          ].map((method) => (
            <button
              key={method.id}
              type="button"
              className={`payment-method-chip${paymentMethod === method.id ? ' active' : ''}`}
              onClick={() => onPaymentMethodChange(method.id)}
            >
              {method.label}
            </button>
          ))}
        </div>
      </div>
      <p className="payment-method-hint">You’ll pay on the Razorpay checkout for the method you pick.</p>

      {recommendations.length > 0 && (
        <div className="payment-offer-recs">
          {recommendations.map(({ offer, savings, reason }) => (
            <div key={offer.id} className="payment-offer-rec">
              <div className="payment-offer-rec-main">
                <Tag size={14} aria-hidden="true" />
                <div>
                  <strong>{offer.title}</strong>
                  <p>{reason}</p>
                  <code>{offer.code}</code>
                </div>
              </div>
              <div className="payment-offer-rec-actions">
                <span className="payment-offer-save">−₹{savings}</span>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => applyPromo(offer.code)}
                >
                  {appliedCode === offer.code ? 'Applied' : 'Apply'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="payment-promo-box">
        <label htmlFor="promo-code">Have a coupon?</label>
        <div className="payment-promo-input-row">
          <input
            id="promo-code"
            className="input"
            value={promoInput}
            onChange={(e) => {
              setPromoInput(e.target.value.toUpperCase());
              setPromoError('');
            }}
            placeholder="Enter promo code"
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={() => applyPromo()}>
            Apply
          </button>
        </div>
        {promoError && <p className="payment-promo-error">{promoError}</p>}
        {applied.offer && !applied.error && (
          <p className="payment-promo-success">
            {applied.offer.title} applied — you save ₹{applied.savings.toLocaleString('en-IN')}
            <button
              type="button"
              className="link-btn"
              onClick={() => copyCode(applied.offer.code)}
            >
              {copiedCode === applied.offer.code ? <Check size={12} /> : <Copy size={12} />}
              {copiedCode === applied.offer.code ? 'Copied' : 'Copy code'}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
