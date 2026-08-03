import {
  FileText, Info, User, CreditCard, ShieldAlert, AlertTriangle, RefreshCw, Mail
} from 'lucide-react';
import StaticPageLayout, { StaticSection } from '../components/StaticPageLayout';

export default function TermsPage() {
  return (
    <StaticPageLayout
      badge="Legal"
      icon={FileText}
      title="Terms & Conditions"
      subtitle="Last updated: July 2026 — please read before using RailYatra."
    >
      <p>
        By accessing or using RailYatra, you agree to these Terms &amp; Conditions. If you do not
        agree, please do not use the service.
      </p>

      <StaticSection icon={Info} title="Service description">
        <p>
          RailYatra provides a demonstration railway reservation platform including train search,
          booking, PNR lookup, and related tools. The service uses simulated fares and availability
          unless otherwise stated and is <strong>not</strong> an official Indian Railways or IRCTC
          channel.
        </p>
      </StaticSection>

      <StaticSection icon={User} title="User accounts">
        <ul>
          <li>You must provide accurate registration information and keep your credentials confidential.</li>
          <li>You are responsible for all activity under your account.</li>
          <li>We may suspend or terminate accounts that violate these terms or applicable law.</li>
        </ul>
      </StaticSection>

      <StaticSection icon={CreditCard} title="Bookings &amp; payments">
        <ul>
          <li>Confirmed bookings are subject to seat availability and validation at payment time.</li>
          <li>Fares may include Tatkal, quota, and class-based charges as displayed before payment.</li>
          <li>Cancellations and refunds follow the rules shown in the refund preview at cancellation time.</li>
          <li>In development mode, payments may be simulated without real money movement.</li>
        </ul>
      </StaticSection>

      <StaticSection icon={ShieldAlert} title="Acceptable use">
        <p>You agree not to:</p>
        <ul>
          <li>Use automated scripts to scrape or overload the API</li>
          <li>Attempt unauthorized access to admin or other users&apos; data</li>
          <li>Submit false passenger or payment information</li>
          <li>Misrepresent RailYatra as an official government or IRCTC service</li>
        </ul>
      </StaticSection>

      <StaticSection icon={AlertTriangle} title="Disclaimer">
        <p>
          RailYatra is provided &quot;as is&quot; without warranties of uninterrupted service, accuracy of
          timetable data, or real-time seat availability. We are not liable for indirect or
          consequential losses arising from use of the platform.
        </p>
      </StaticSection>

      <StaticSection icon={RefreshCw} title="Changes">
        <p>
          We may update these terms from time to time. Continued use after changes constitutes
          acceptance of the revised terms.
        </p>
      </StaticSection>

      <StaticSection icon={Mail} title="Contact">
        <p>
          Questions about these terms? Reach us at{' '}
          <a href="mailto:imankit.biswas@gmail.com">imankit.biswas@gmail.com</a> or call{' '}
          <a href="tel:+917864939820">+91 78649 39820</a>.
        </p>
      </StaticSection>
    </StaticPageLayout>
  );
}
