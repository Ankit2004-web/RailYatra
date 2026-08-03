import { useMemo, useState } from 'react';
import {
  Tag, Copy, Check, Sparkles, Ticket, CreditCard, Wallet, UserPlus
} from 'lucide-react';
import { OFFERS, OFFER_CATEGORIES } from '../data/offers';

const CATEGORY_ICONS = {
  all: Sparkles,
  train: Ticket,
  bank: CreditCard,
  payment: Wallet,
  new: UserPlus
};

export default function OffersSection({ onBookNow }) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [copiedCode, setCopiedCode] = useState('');
  const [toast, setToast] = useState('');

  const filteredOffers = useMemo(() => {
    if (activeCategory === 'all') return OFFERS;
    return OFFERS.filter((o) => o.category === activeCategory);
  }, [activeCategory]);

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2800);
  };

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      showToast(`Coupon ${code} copied!`);
      window.setTimeout(() => setCopiedCode(''), 2000);
    } catch {
      showToast(`Use code: ${code}`);
    }
  };

  const handleOfferAction = (offer) => {
    copyCode(offer.code);
    localStorage.setItem('railyatra_promo', offer.code);
    onBookNow?.();
  };

  return (
    <section className="offers-section" id="offers">
      <div className="offers-filters" role="tablist" aria-label="Offer categories">
        {OFFER_CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.id] || Sparkles;
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={activeCategory === cat.id}
              className={`offers-filter${activeCategory === cat.id ? ' active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              <Icon size={14} aria-hidden="true" />
              {cat.label}
            </button>
          );
        })}
      </div>

      <div className="offers-grid">
        {filteredOffers.map((offer) => (
          <article key={offer.id} className="offer-card card" data-category={offer.category}>
            <div className="offer-card-header">
              <span className="offer-badge">{offer.badge}</span>
              <Tag size={16} className="offer-tag-icon" aria-hidden="true" />
            </div>

            <div className="offer-card-body">
              <h3 className="offer-title">{offer.title}</h3>
              <p className="offer-subtitle">{offer.subtitle}</p>

              <div className="offer-code-box">
                <span className="offer-code-label">Use code</span>
                <code className="offer-code">{offer.code}</code>
                <button
                  type="button"
                  className="offer-copy-btn"
                  onClick={() => copyCode(offer.code)}
                  aria-label={`Copy coupon code ${offer.code}`}
                >
                  {copiedCode === offer.code ? <Check size={14} /> : <Copy size={14} />}
                  {copiedCode === offer.code ? 'Copied' : 'Copy'}
                </button>
              </div>

              <p className="offer-valid">Valid till {offer.validTill}</p>
              <p className="offer-terms">{offer.terms}</p>
            </div>

            <button
              type="button"
              className="btn btn-primary offer-cta"
              onClick={() => handleOfferAction(offer)}
            >
              {offer.cta}
            </button>
          </article>
        ))}
      </div>

      {filteredOffers.length === 0 && (
        <p className="offers-empty muted">No offers in this category right now.</p>
      )}

      <div className="offers-bank-strip card">
        <span className="offers-bank-label">Partner offers from</span>
        <div className="offers-bank-logos">
          <span>HDFC Bank</span>
          <span>ICICI Bank</span>
          <span>Axis Bank</span>
          <span>PhonePe UPI</span>
          <span>Google Pay</span>
        </div>
      </div>

      <div className="offers-how card">
        <h2>How to apply an offer</h2>
        <ol className="offers-how-steps">
          <li>Copy the coupon code from any offer above.</li>
          <li>Search for trains and proceed to book your ticket.</li>
          <li>Paste the code at checkout — your discount applies automatically.</li>
        </ol>
      </div>

      {toast && (
        <div className="offers-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </section>
  );
}
