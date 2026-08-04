import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Clock, MessageCircle, Ticket, LayoutDashboard, Send } from 'lucide-react';
import StaticPageLayout, { StaticSection } from '../components/StaticPageLayout';

const CONTACT_EMAIL = 'imankit.biswas@gmail.com';
const CONTACT_PHONE = '7864939820';
const CONTACT_PHONE_DISPLAY = '+91 78649 39820';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sent, setSent] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    const body = encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}\n\n${form.message}`
    );
    const subject = encodeURIComponent(form.subject || 'RailYatra support enquiry');
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <StaticPageLayout
      badge="Support"
      icon={MessageCircle}
      title="Contact Us"
      subtitle="We're here to help with bookings, account issues, and general enquiries."
      wide
    >
      <p>
        Have a question about RailYatra, your booking, or our policies? Get in touch using the
        details below. We aim to respond within 1–2 business days.
      </p>

      <div className="contact-cards">
        <a href={`mailto:${CONTACT_EMAIL}`} className="contact-card">
          <span className="contact-card-icon" aria-hidden="true">
            <Mail size={22} />
          </span>
          <div>
            <strong>Email</strong>
            <p>{CONTACT_EMAIL}</p>
          </div>
        </a>

        <a href={`tel:+91${CONTACT_PHONE}`} className="contact-card">
          <span className="contact-card-icon" aria-hidden="true">
            <Phone size={22} />
          </span>
          <div>
            <strong>Phone</strong>
            <p>{CONTACT_PHONE_DISPLAY}</p>
          </div>
        </a>

        <div className="contact-card contact-card-static">
          <span className="contact-card-icon" aria-hidden="true">
            <Clock size={22} />
          </span>
          <div>
            <strong>Support hours</strong>
            <p>Mon – Sat, 10:00 AM – 6:00 PM IST</p>
          </div>
        </div>

        <div className="contact-card contact-card-static">
          <span className="contact-card-icon" aria-hidden="true">
            <MapPin size={22} />
          </span>
          <div>
            <strong>Location</strong>
            <p>India</p>
          </div>
        </div>
      </div>

      <StaticSection icon={Send} title="Send us a message">
        {sent ? (
          <div className="contact-form-success">
            Your email client should open with the enquiry draft. Send the email to complete your request.
          </div>
        ) : (
          <form className="contact-form card" onSubmit={submit}>
            <div className="field">
              <label htmlFor="contact-name">Your name</label>
              <input id="contact-name" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="contact-email">Email</label>
              <input id="contact-email" type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="contact-subject">Subject</label>
              <input id="contact-subject" className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Booking / PNR / Account" />
            </div>
            <div className="field">
              <label htmlFor="contact-message">Message</label>
              <textarea id="contact-message" className="input" rows={5} required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-primary">
              <Send size={16} aria-hidden="true" /> Send enquiry
            </button>
          </form>
        )}
      </StaticSection>

      <StaticSection icon={MessageCircle} title="Before you write">
        <ul>
          <li>For PNR status, use the <Link to="/pnr">PNR Status</Link> page — no login required.</li>
          <li>For booking changes or cancellations, sign in and open <Link to="/bookings">My Bookings</Link>.</li>
          <li>Include your PNR or registered email when contacting us about a specific ticket.</li>
        </ul>

        <div className="static-quick-links">
          <Link to="/pnr" className="static-quick-link">
            <Ticket size={14} aria-hidden="true" /> PNR Status
          </Link>
          <Link to="/bookings" className="static-quick-link">
            <LayoutDashboard size={14} aria-hidden="true" /> My Bookings
          </Link>
          <Link to="/home" className="static-quick-link">
            Search Trains
          </Link>
        </div>
      </StaticSection>
    </StaticPageLayout>
  );
}
