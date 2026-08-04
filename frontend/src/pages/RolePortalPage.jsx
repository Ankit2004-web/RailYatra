import { Link } from 'react-router-dom';
import {
  TrainFront, Ticket, Users, MapPin, Headphones, BarChart3,
  ShieldCheck, ClipboardList, Wallet, Wrench
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS, resolveRole } from '../constants/roles';

const PORTAL_CONFIG = {
  booking_agent: {
    title: 'Booking Agent Portal',
    modules: [
      { icon: TrainFront, label: 'Search Trains', to: '/search' },
      { icon: Ticket, label: 'Create Booking', to: '/book' },
      { icon: ClipboardList, label: 'PNR Lookup', to: '/pnr' }
    ]
  },
  tte: {
    title: 'TTE Portal',
    modules: [
      { icon: Ticket, label: 'PNR Verification', to: '/pnr' },
      { icon: TrainFront, label: 'Live Train Status', to: '/live-trains' },
      { icon: Users, label: 'Coach Chart', to: '/search' }
    ]
  },
  station_master: {
    title: 'Station Master Portal',
    modules: [
      { icon: MapPin, label: 'Station Info', to: '/home' },
      { icon: TrainFront, label: 'Live Trains', to: '/live-trains' },
      { icon: ClipboardList, label: 'Chart Status', to: '/pnr' }
    ]
  },
  railway_staff: {
    title: 'Railway Staff Portal',
    modules: [
      { icon: Wrench, label: 'Coach Maintenance', to: '/live-trains' },
      { icon: TrainFront, label: 'Train Operations', to: '/search' },
      { icon: BarChart3, label: 'Operations Reports', to: '/portal' }
    ]
  },
  customer_support: {
    title: 'Customer Support Portal',
    modules: [
      { icon: Headphones, label: 'Support Tickets', to: '/support' },
      { icon: Ticket, label: 'PNR Lookup', to: '/pnr' },
      { icon: ShieldCheck, label: 'FAQ', to: '/support' }
    ]
  },
  finance: {
    title: 'Finance Portal',
    modules: [
      { icon: Wallet, label: 'Revenue Reports', to: '/admin' },
      { icon: BarChart3, label: 'Refunds', to: '/admin' },
      { icon: ClipboardList, label: 'Payment History', to: '/bookings' }
    ]
  }
};

export default function RolePortalPage() {
  const { user } = useAuth();
  const role = resolveRole(user);
  const config = PORTAL_CONFIG[role];

  if (!config) {
    return (
      <div className="container page-shell">
        <div className="alert alert-error">No portal configured for your role.</div>
        <Link to="/home" className="btn btn-outline">Go to Home</Link>
      </div>
    );
  }

  return (
    <div className="portal-page page-shell">
      <div className="container">
        <div className="portal-head">
          <span className="page-hero-badge">{ROLE_LABELS[role]}</span>
          <h1>{config.title}</h1>
          <p className="muted">Access modules assigned to your role.</p>
        </div>
        <div className="portal-grid">
          {config.modules.map(({ icon: Icon, label, to }) => (
            <Link key={label} to={to} className="portal-card card">
              <Icon size={24} aria-hidden="true" />
              <strong>{label}</strong>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
