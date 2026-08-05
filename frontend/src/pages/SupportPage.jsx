import { useEffect, useMemo, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  Headphones, MessageSquare, HelpCircle, Ticket, Phone, Mail, ShieldCheck
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import SupportChat from '../components/SupportChat';

const FAQ_FALLBACK = [
  { q: 'How do I check PNR status?', a: 'Use the PNR Status page and enter your 10-digit PNR.' },
  { q: 'When will I get a refund?', a: 'Refunds are processed per IRCTC-style rules based on cancellation time.' },
  { q: 'What is RAC?', a: 'Reservation Against Cancellation — a shared berth until chart preparation.' },
  { q: 'How do I download my e-ticket?', a: 'Go to My Bookings and click E-Ticket for confirmed bookings.' },
  { q: 'Lost ticket — what now?', a: 'Raise a support ticket with your PNR and registered mobile number.' },
];

const CATEGORIES = ['General', 'Booking', 'Refund', 'Lost Ticket', 'Complaint', 'Feedback'];

const QUICK_LINKS = [
  { id: 'support-chat', icon: MessageSquare, label: 'Live Chat' },
  { id: 'support-faq', icon: HelpCircle, label: 'FAQ' },
  { id: 'support-ticket', icon: Ticket, label: 'Raise Ticket' },
];

export default function SupportPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [faq, setFaq] = useState(FAQ_FALLBACK);
  const [tickets, setTickets] = useState([]);
  const [form, setForm] = useState({ subject: '', category: 'General', message: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const activeSection = useMemo(
    () => location.hash?.replace('#', '') || 'support-chat',
    [location.hash]
  );

  useEffect(() => {
    api.get('/support/faq')
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setFaq(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    api.get('/support/tickets').then(setTickets).catch(() => {});
  }, [user]);

  useEffect(() => {
    const hash = location.hash?.replace('#', '');
    if (!hash) return undefined;
    const timer = setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => clearTimeout(timer);
  }, [location.pathname, location.hash]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      await api.post('/support/tickets', form);
      setMsg('Support ticket raised successfully. Our team will respond shortly.');
      setForm({ subject: '', category: 'General', message: '' });
      const updated = await api.get('/support/tickets');
      setTickets(updated);
    } catch (err) {
      setError(err.message || 'Could not raise ticket');
    }
  };

  return (
    <div className="support-page page-shell">
      <section className="support-hero page-hero">
        <div className="page-hero-inner page-hero-split">
          <div className="page-hero-copy">
            <span className="page-hero-badge">
              <ShieldCheck size={14} aria-hidden="true" /> 24×7 assistance
            </span>
            <h1 className="page-hero-title">Customer Support</h1>
            <p className="page-hero-subtitle">
              Get instant help via live chat, browse FAQs, or raise a ticket for booking,
              refund, and complaint queries.
            </p>
          </div>
          <div className="support-hero-stats">
            <span className="support-hero-stat"><MessageSquare size={15} /> Live chat</span>
            <span className="support-hero-stat"><HelpCircle size={15} /> FAQ</span>
            <span className="support-hero-stat"><Ticket size={15} /> Raise ticket</span>
          </div>
        </div>
      </section>

      <div className="support-body page-body">
        <nav className="support-quick-nav" aria-label="Support sections">
          {QUICK_LINKS.map(({ id, icon: Icon, label }) => (
            <a
              key={id}
              href={`#${id}`}
              className={`support-quick-link${activeSection === id ? ' active' : ''}`}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </a>
          ))}
        </nav>

        <div className="support-layout">
          <div className="support-main">
            <div id="support-chat" className="support-section">
              <SupportChat />
            </div>

            <section id="support-faq" className="support-section card support-panel">
              <div className="support-panel-head">
                <div>
                  <h2><HelpCircle size={18} aria-hidden="true" /> Frequently Asked Questions</h2>
                  <p>Quick answers before you contact us</p>
                </div>
              </div>
              <div className="support-panel-body">
                <div className="support-faq-list">
                  {faq.map((item) => (
                    <details key={item.q} className="support-faq-item">
                      <summary>{item.q}</summary>
                      <p>{item.a}</p>
                    </details>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <aside className="support-side">
            <section id="support-ticket" className="support-section card support-panel">
              <div className="support-panel-head">
                <div>
                  <h2><Ticket size={18} aria-hidden="true" /> Raise a Ticket</h2>
                  <p>We typically respond within 24 hours</p>
                </div>
              </div>
              <div className="support-panel-body">
                {user ? (
                  <form onSubmit={submit} className="support-form">
                    <div className="field">
                      <label htmlFor="support-subject">Subject</label>
                      <input
                        id="support-subject"
                        className="input"
                        required
                        placeholder="Brief summary of your issue"
                        value={form.subject}
                        onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <span className="label-like">Category</span>
                      <div className="support-category-grid" role="group" aria-label="Ticket category">
                        {CATEGORIES.map((c) => (
                          <button
                            key={c}
                            type="button"
                            className={`support-category-chip${form.category === c ? ' active' : ''}`}
                            onClick={() => setForm({ ...form, category: c })}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="support-message">Message</label>
                      <textarea
                        id="support-message"
                        className="input"
                        rows={5}
                        required
                        placeholder="Describe your issue — include PNR or booking ID if relevant"
                        value={form.message}
                        onChange={(e) => setForm({ ...form, message: e.target.value })}
                      />
                    </div>
                    {error && <div className="alert alert-error">{error}</div>}
                    {msg && <div className="support-toast" role="status">{msg}</div>}
                    <button type="submit" className="btn btn-primary btn-block">
                      Submit ticket
                    </button>
                  </form>
                ) : (
                  <div className="support-login-prompt">
                    <Headphones size={28} aria-hidden="true" />
                    <p>Log in to raise and track support tickets for your bookings.</p>
                    <Link to="/login" className="btn btn-primary btn-sm">Login to continue</Link>
                  </div>
                )}
              </div>
            </section>

            {user && tickets.length > 0 && (
              <section className="support-section card support-panel">
                <div className="support-panel-head">
                  <div>
                    <h2><Headphones size={18} aria-hidden="true" /> Your Tickets</h2>
                    <p>{tickets.length} open request{tickets.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="support-panel-body">
                  <ul className="support-ticket-list">
                    {tickets.map((t) => (
                      <li key={t.id} className="support-ticket-item">
                        <strong>{t.subject}</strong>
                        <div className="support-ticket-meta">
                          <span className="support-ticket-status">{t.status || 'Open'}</span>
                          <span>{t.category}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            <div className="support-section support-helpline card">
              <h3>Need immediate help?</h3>
              <p>Call our helpline or send an email for urgent booking assistance.</p>
              <div className="support-helpline-links">
                <a href="tel:+917864939820"><Phone size={16} /> +91 78649 39820</a>
                <Link to="/contact"><Mail size={16} /> Contact form</Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
