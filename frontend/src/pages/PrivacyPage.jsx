import { ShieldCheck, Database, Lock, Cookie, UserCheck, Mail } from 'lucide-react';
import StaticPageLayout, { StaticSection } from '../components/StaticPageLayout';

export default function PrivacyPage() {
  return (
    <StaticPageLayout
      badge="Legal"
      icon={ShieldCheck}
      title="Privacy Policy"
      subtitle="Last updated: July 2026 — how we collect, use, and protect your information."
    >
      <p>
        RailYatra (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) respects your privacy. This policy explains how we
        collect, use, and protect information when you use our website and services.
      </p>

      <StaticSection icon={Database} title="Information we collect">
        <ul>
          <li><strong>Account data:</strong> name, email address, and password (stored securely using hashing)</li>
          <li><strong>Booking data:</strong> passenger names, journey details, PNR, and payment references</li>
          <li><strong>Technical data:</strong> IP address, browser type, and usage logs for security and debugging</li>
        </ul>
      </StaticSection>

      <StaticSection icon={UserCheck} title="How we use your information">
        <ul>
          <li>To create and manage your account</li>
          <li>To process bookings, payments, cancellations, and refunds</li>
          <li>To send booking confirmations and password-reset emails (when configured)</li>
          <li>To improve service reliability and prevent fraud or abuse</li>
        </ul>
      </StaticSection>

      <StaticSection icon={ShieldCheck} title="Data sharing">
        <p>
          We do not sell your personal information. Payment processing may involve third-party
          providers (e.g. Razorpay) under their own privacy terms. We may disclose data if required
          by law or to protect the rights and safety of users and the platform.
        </p>
      </StaticSection>

      <StaticSection icon={Lock} title="Data retention &amp; security">
        <p>
          We retain booking and account records as needed to provide services and meet legal
          obligations. Passwords are never stored in plain text. Access to admin and sensitive
          endpoints is restricted and protected by authentication, rate limiting, and security headers.
        </p>
      </StaticSection>

      <StaticSection icon={Cookie} title="Cookies &amp; local storage">
        <p>
          We use browser local storage to keep you signed in (JWT token) and to remember preferences
          such as search settings and theme. You can clear this data from your browser at any time.
        </p>
      </StaticSection>

      <StaticSection icon={UserCheck} title="Your rights">
        <p>
          You may request access to or correction of your account information by contacting us.
          You may delete your account subject to retention requirements for completed bookings.
        </p>
      </StaticSection>

      <StaticSection icon={Mail} title="Contact">
        <p>
          For privacy-related questions, email us at{' '}
          <a href="mailto:imankit.biswas@gmail.com">imankit.biswas@gmail.com</a>.
        </p>
      </StaticSection>
    </StaticPageLayout>
  );
}
