import { useNavigate } from 'react-router-dom';
import { Sparkles, Percent, Tag, RefreshCw } from 'lucide-react';
import OffersSection from '../components/OffersSection';
import { useDailyOffers } from '../hooks/useDailyOffers';

export default function OffersPage() {
  const navigate = useNavigate();
  const { totalActive, refreshedLabel, loading } = useDailyOffers();

  return (
    <div className="offers-page page-shell">
      <section className="offers-hero page-hero">
        <div className="offers-hero-inner page-hero-inner">
          <span className="offers-hero-badge page-hero-badge">
            <Sparkles size={14} aria-hidden="true" /> Exclusive deals
          </span>
          <h1 className="page-hero-title">Offers &amp; Deals</h1>
          <p className="offers-hero-subtitle page-hero-subtitle">
            Save on train bookings with coupon codes, bank rewards, and UPI cashback.
            Deals refresh automatically every day — no manual updates needed.
          </p>
          {refreshedLabel && (
            <p className="offers-hero-refresh">
              <RefreshCw size={14} aria-hidden="true" />
              Refreshed for {refreshedLabel}
            </p>
          )}
          <div className="offers-hero-stats">
            <div className="offers-stat-card">
              <Percent size={18} aria-hidden="true" />
              <span>Up to <strong>10% OFF</strong> on select routes</span>
            </div>
            <div className="offers-stat-card">
              <Tag size={18} aria-hidden="true" />
              <span>
                <strong>{loading ? '…' : totalActive}</strong> active offers available
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="offers-body page-body container">
        <OffersSection onBookNow={() => navigate('/home')} />
      </div>
    </div>
  );
}
