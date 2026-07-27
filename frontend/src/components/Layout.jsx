import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Search, Ticket, LayoutDashboard, LogOut, User, Shield, Menu, X, Tag, Info, ShieldCheck, FileText, Mail } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navClass = ({ isActive }) => (isActive ? 'nav-link active' : 'nav-link');

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <Link to="/" className="brand" onClick={() => setMenuOpen(false)}>
            <img src="/logo.png" alt="RailYatra — Your journey, simplified" className="brand-logo" />
          </Link>

          <button type="button" className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <nav className={`main-nav ${menuOpen ? 'open' : ''}`}>
            <NavLink to="/" end className={navClass} onClick={() => setMenuOpen(false)}>
              <Search size={16} /> Search
            </NavLink>
            <NavLink to="/pnr" className={navClass} onClick={() => setMenuOpen(false)}>
              <Ticket size={16} /> PNR Status
            </NavLink>
            <NavLink to="/bookings" className={navClass} onClick={() => setMenuOpen(false)}>
              <LayoutDashboard size={16} /> My Bookings
            </NavLink>
            <Link to="/#offers" className="nav-link" onClick={() => setMenuOpen(false)}>
              <Tag size={16} /> Offers
              <span className="nav-badge">New</span>
            </Link>
            {user && isAdmin && (
              <NavLink to="/admin" className={navClass} onClick={() => setMenuOpen(false)}>
                <Shield size={16} /> Admin
              </NavLink>
            )}
          </nav>

          <div className="header-actions">
            {user ? (
              <div className="user-chip">
                <User size={16} />
                <span>{user.name?.split(' ')[0]}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
                  <LogOut size={16} /> Logout
                </button>
              </div>
            ) : (
              <>
                <Link to="/login" className="btn btn-outline btn-sm">Login</Link>
                <Link to="/register" className="btn btn-primary btn-sm">Register</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <footer className="app-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <Link to="/" className="footer-logo-link">
              <img src="/logo.png" alt="RailYatra" className="footer-logo" />
            </Link>
            <p className="footer-copy">
              © 2026 RailYatra · Master data from open datasets · Fares simulated for demo
            </p>
          </div>
          <nav className="footer-links" aria-label="Footer">
            <a href="#about"><Info size={14} aria-hidden="true" /> About Us</a>
            <a href="#privacy"><ShieldCheck size={14} aria-hidden="true" /> Privacy Policy</a>
            <a href="#terms"><FileText size={14} aria-hidden="true" /> Terms &amp; Conditions</a>
            <a href="#contact"><Mail size={14} aria-hidden="true" /> Contact Us</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
