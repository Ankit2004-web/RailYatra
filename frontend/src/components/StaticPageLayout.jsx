import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function StaticPageLayout({ title, subtitle, badge, icon: Icon, children, wide = false }) {
  return (
    <div className="static-page page-shell">
      <section className="static-page-hero page-hero">
        <div className="static-page-hero-inner page-hero-inner">
          <Link to="/" className="static-page-back">
            <ArrowLeft size={16} aria-hidden="true" /> Back to home
          </Link>
          {badge && (
            <span className="static-page-badge page-hero-badge">
              {Icon && <Icon size={14} aria-hidden="true" />}
              {badge}
            </span>
          )}
          <h1 className="page-hero-title">{title}</h1>
          {subtitle && <p className="static-page-subtitle page-hero-subtitle">{subtitle}</p>}
        </div>
      </section>

      <div className={`static-page-body page-body container ${wide ? 'static-page-body--wide' : ''}`}>
        <article className="static-page-content card">
          {children}
        </article>

        <nav className="static-page-footer-nav" aria-label="Related pages">
          <Link to="/about">About Us</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms &amp; Conditions</Link>
          <Link to="/contact">Contact Us</Link>
        </nav>
      </div>
    </div>
  );
}

export function StaticSection({ icon: Icon, title, children }) {
  return (
    <section className="static-section">
      <div className="static-section-head">
        {Icon && (
          <span className="static-section-icon" aria-hidden="true">
            <Icon size={18} />
          </span>
        )}
        <h2>{title}</h2>
      </div>
      <div className="static-section-body">{children}</div>
    </section>
  );
}
