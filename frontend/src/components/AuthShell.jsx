import { Link } from 'react-router-dom';
import { Search, ShieldCheck, Ticket } from 'lucide-react';

const ENTERPRISE_ICONS = [Search, ShieldCheck, Ticket];

export default function AuthShell({ children, title, subtitle, sideTitle, sidePoints = [], variant }) {
  const isEnterprise = variant === 'enterprise';

  return (
    <div className={`auth-shell${isEnterprise ? ' auth-shell--enterprise' : ''}`}>
      <aside className="auth-side" aria-hidden={isEnterprise ? undefined : 'false'}>
        {isEnterprise && <div className="auth-side-hero-bg" aria-hidden="true" />}
        {isEnterprise && <div className="auth-side-overlay" aria-hidden="true" />}
        <Link to="/" className="auth-side-brand">
          <img src="/logo.png" alt="" className="auth-side-logo" />
          <span>
            <strong>RailYatra</strong>
            <small>Your journey, simplified</small>
          </span>
        </Link>
        <div className="auth-side-copy">
          <h2>{sideTitle}</h2>
          <ul className="auth-side-list">
            {sidePoints.map((point, index) => (
              <li key={point}>
                {isEnterprise && (
                  <span className="auth-side-feature-icon" aria-hidden="true">
                    {(() => {
                      const Icon = ENTERPRISE_ICONS[index % ENTERPRISE_ICONS.length];
                      return <Icon size={16} />;
                    })()}
                  </span>
                )}
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="auth-main">
        {isEnterprise && (
          <div className="auth-main-decor" aria-hidden="true">
            <span className="auth-decor-blob auth-decor-blob-1" />
            <span className="auth-decor-blob auth-decor-blob-2" />
            <span className="auth-decor-dots" />
          </div>
        )}

        <header className="auth-topbar">
          <Link to="/" className="auth-topbar-brand">
            <img src="/logo.png" alt="" />
            <span>RailYatra</span>
          </Link>
          {!isEnterprise && (
            <Link to="/home" className="auth-topbar-home">← Back to home</Link>
          )}
        </header>

        <div className="auth-panel">
          {isEnterprise ? (
            <div className="auth-login-card">
              <div className="auth-panel-head auth-panel-head--center">
                <div className="auth-login-icon" aria-hidden="true">
                  <img src="/logo.png" alt="" className="auth-login-logo" />
                </div>
                <h1>{title}</h1>
                {subtitle && <p className="muted">{subtitle}</p>}
              </div>
              {children}
            </div>
          ) : (
            <>
              <div className="auth-panel-head">
                <h1>{title}</h1>
                {subtitle && <p className="muted">{subtitle}</p>}
              </div>
              {children}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
