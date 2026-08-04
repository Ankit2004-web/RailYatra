import { Link, useLocation } from 'react-router-dom';
import {
  Headphones, MessageSquare, HelpCircle, Ticket, Mail, Phone, ChevronDown, ArrowRight
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const ITEMS = [
  {
    to: '/support#support-chat',
    icon: MessageSquare,
    title: 'Live Chat',
    desc: 'Instant help from our team',
    accent: '#12B8B8',
  },
  {
    to: '/support#support-faq',
    icon: HelpCircle,
    title: 'FAQ',
    desc: 'Answers to common questions',
    accent: '#6366f1',
  },
  {
    to: '/support#support-ticket',
    icon: Ticket,
    title: 'Raise Ticket',
    desc: 'Booking, refund & complaints',
    accent: '#0AA6A6',
  },
  {
    to: '/contact',
    icon: Mail,
    title: 'Contact Us',
    desc: 'Email or call our helpline',
    accent: '#ec4899',
  },
  {
    to: '/pnr',
    icon: Ticket,
    title: 'PNR Help',
    desc: 'Check ticket & chart status',
    accent: '#10b981',
  },
];

export default function SupportMegaMenu({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const closeTimer = useRef(null);
  const location = useLocation();
  const isActive = location.pathname === '/support' || location.pathname === '/contact';

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.hash]);

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  };

  const close = () => {
    clearCloseTimer();
    setOpen(false);
    onNavigate?.();
  };

  return (
    <div
      className="nav-mega"
      ref={ref}
      onMouseEnter={() => {
        clearCloseTimer();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className={`nav-link nav-mega-trigger${isActive ? ' active' : ''}${open ? ' open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Headphones size={16} aria-hidden="true" />
        <span className="nav-label-long">Support</span>
        <span className="nav-label-short">Help</span>
        <ChevronDown size={14} className="nav-mega-chevron" aria-hidden="true" />
      </button>

      {open && (
        <div
          className="nav-mega-dropzone"
          onMouseEnter={clearCloseTimer}
          onMouseLeave={scheduleClose}
        >
          <div className="nav-mega-panel dropdown-animate-center" role="menu">
            <div className="nav-mega-head">
              <strong>How can we help?</strong>
              <span>Choose a support channel</span>
            </div>
            <div className="nav-mega-grid">
              {ITEMS.map(({ to, icon: Icon, title, desc, accent }) => (
                <Link
                  key={to}
                  to={to}
                  role="menuitem"
                  className="nav-mega-item"
                  onClick={close}
                >
                  <span className="nav-mega-icon" style={{ '--mega-accent': accent }}>
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span className="nav-mega-copy">
                    <strong>{title}</strong>
                    <small>{desc}</small>
                  </span>
                </Link>
              ))}
            </div>
            <div className="nav-mega-footer">
              <Phone size={14} aria-hidden="true" />
              <span>
                Helpline{' '}
                <a href="tel:+917864939820">+91 78649 39820</a>
                {' · '}
                Mon–Sat, 10 AM – 6 PM IST
              </span>
            </div>
            <Link to="/support" className="nav-mega-all" onClick={close}>
              View support centre
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
