import { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Headphones, MessageSquare, HelpCircle } from 'lucide-react';
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

export default function SupportPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [faq, setFaq] = useState(FAQ_FALLBACK);
  const [tickets, setTickets] = useState([]);
  const [form, setForm] = useState({ subject: '', category: 'General', message: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

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
      setMsg('Support ticket raised successfully.');
      setForm({ subject: '', category: 'General', message: '' });
      const updated = await api.get('/support/tickets');
      setTickets(updated);
    } catch (err) {
      setError(err.message || 'Could not raise ticket');
    }
  };

  return (
    <div className="support-page page-shell">
      <div className="container support-page-inner">
        <div className="page-hero-inner support-hero">
          <Headphones size={28} aria-hidden="true" />
          <h1>Customer Support</h1>
          <p className="muted">FAQ, live chat, raise a ticket, and track complaints.</p>
        </div>

        <div id="support-chat" className="support-section">
          <SupportChat />
        </div>

        <section id="support-faq" className="card support-faq support-section">
          <h2><HelpCircle size={18} aria-hidden="true" /> FAQ</h2>
          <div className="support-faq-list">
            {faq.map((item) => (
              <details key={item.q} className="support-faq-item">
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="support-ticket" className="card support-form-card support-section">
          <h2><MessageSquare size={18} aria-hidden="true" /> Raise a ticket</h2>
          {user ? (
            <form onSubmit={submit} className="support-form">
              <div className="field">
                <label htmlFor="support-subject">Subject</label>
                <input id="support-subject" className="input" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="support-category">Category</label>
                <select id="support-category" className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {['General', 'Booking', 'Refund', 'Lost Ticket', 'Complaint', 'Feedback'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="support-message">Message</label>
                <textarea id="support-message" className="input" rows={5} required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              </div>
              {error && <div className="alert alert-error">{error}</div>}
              {msg && <div className="alert alert-success">{msg}</div>}
              <button type="submit" className="btn btn-primary">Submit ticket</button>
            </form>
          ) : (
            <div className="alert alert-warning support-login-prompt">
              <p>Log in to raise and track support tickets.</p>
              <Link to="/login" className="btn btn-primary btn-sm">Login to continue</Link>
            </div>
          )}
        </section>

        {user && tickets.length > 0 && (
          <section className="card support-section">
            <h2>Your tickets</h2>
            <ul className="support-ticket-list">
              {tickets.map((t) => (
                <li key={t.id}>
                  <strong>{t.subject}</strong>
                  <span className="muted">{t.category} · {t.status}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
