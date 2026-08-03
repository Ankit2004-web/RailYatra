import { Info, TrainFront, Ticket, ShieldCheck, LayoutDashboard, Database } from 'lucide-react';
import StaticPageLayout, { StaticSection } from '../components/StaticPageLayout';

const FEATURES = [
  {
    icon: TrainFront,
    title: 'Smart train search',
    desc: 'Route-aware search with intermediate stops and class filters.'
  },
  {
    icon: Ticket,
    title: 'Easy booking',
    desc: 'Book tickets, manage waitlists, Tatkal fares, and cancellations.'
  },
  {
    icon: ShieldCheck,
    title: 'PNR & e-tickets',
    desc: 'Track PNR status and download e-tickets anytime.'
  },
  {
    icon: LayoutDashboard,
    title: 'Admin dashboard',
    desc: 'Manage trains, stations, bookings, and railway master data.'
  }
];

export default function AboutPage() {
  return (
    <StaticPageLayout
      badge="About"
      icon={Info}
      title="About RailYatra"
      subtitle="Your journey, simplified — a modern Indian railway reservation platform."
    >
      <p>
        <strong>RailYatra</strong> is an Indian railway reservation platform built to simplify
        train search, booking, and ticket management. Our name means <em>rail journey</em> in Hindi —
        reflecting our focus on making every trip easier to plan.
      </p>
      <p>
        We combine a modern React interface with a robust Node.js API and SQL Server database to
        deliver route-aware search, class-wise availability, PNR enquiry, e-tickets, and admin tools
        for railway master data.
      </p>

      <div className="static-feature-grid">
        {FEATURES.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="static-feature-card">
            <span className="static-feature-card-icon" aria-hidden="true">
              <Icon size={20} />
            </span>
            <div>
              <strong>{title}</strong>
              <p>{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <StaticSection icon={Database} title="Our data">
        <p>
          Timetable and station data are sourced from open community datasets (such as DataMeet) for
          demonstration purposes. Fares and availability are simulated and do not reflect live IRCTC
          inventory. RailYatra is an independent project and is not affiliated with Indian Railways
          or IRCTC.
        </p>
      </StaticSection>

      <StaticSection icon={Info} title="Built by">
        <p>
          RailYatra is developed and maintained by Ankit Biswas as a full-stack portfolio project
          showcasing real-world reservation-system patterns, security practices, and scalable
          architecture.
        </p>
      </StaticSection>

      <div className="static-highlight">
        <p>
          <strong>Note:</strong> This is a demonstration platform. Always verify journey details on
          official channels before travel.
        </p>
      </div>
    </StaticPageLayout>
  );
}
