import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Search, Ticket, LayoutDashboard, LogOut, Shield, Menu, X, Tag, Info, ShieldCheck, FileText, Mail, Settings } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import UserAvatar from './UserAvatar';

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navClass = ({ isActive }) => (isActive ? 'nav-link active' : 'nav-link');

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <Link to="/" className="brand" onClick={() => setMenuOpen(false)} aria-label="RailYatra home">
            <img src="/logo.png" alt="" className="brand-logo" />
            <span className="brand-text">
              <strong>RailYatra</strong>
              <small>Your journey, simplified</small>
            </span>
          </Link>

          <div className="header-end">
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
              <NavLink to="/offers" className={navClass} onClick={() => setMenuOpen(false)}>
                <Tag size={16} /> Offers
                <span className="nav-badge">New</span>
              </NavLink>
              {user && isAdmin && (
                <NavLink to="/admin" className={navClass} onClick={() => setMenuOpen(false)}>
                  <Shield size={16} /> Admin
                </NavLink>
              )}
            </nav>

            <div className="header-actions">
              {user ? (
                <div className="user-chip">
                  <Link to="/profile" className="user-chip-profile" title="Profile settings">
                    <UserAvatar user={user} size={28} />
                    <span>{user.name?.split(' ')[0]}</span>
                  </Link>
                  <Link to="/profile" className="btn btn-ghost btn-sm user-chip-settings" title="Profile settings">
                    <Settings size={16} />
                  </Link>
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

            <button type="button" className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <footer className="app-footer">
        <div className="footer-inner header-inner">
          <Link to="/" className="brand" aria-label="RailYatra home">
            <img src="/logo.png" alt="" className="brand-logo" />
            <span className="brand-text footer-brand-text">
              <strong>RailYatra</strong>
              <small>Copyright © 2025 · All rights reserved.</small>
            </span>
          </Link>
          <nav className="footer-links" aria-label="Footer">
            <Link to="/about"><Info size={14} aria-hidden="true" /> About Us</Link>
            <Link to="/privacy"><ShieldCheck size={14} aria-hidden="true" /> Privacy Policy</Link>
            <Link to="/terms"><FileText size={14} aria-hidden="true" /> Terms &amp; Conditions</Link>
            <Link to="/contact"><Mail size={14} aria-hidden="true" /> Contact Us</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
