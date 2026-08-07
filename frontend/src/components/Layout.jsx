import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Search, Ticket, LayoutDashboard, LogOut, Shield, Menu, X, Tag,
  Info, ShieldCheck, FileText, Mail, Settings, Radio, Briefcase, ChevronDown, User
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { isStaffRole, resolveRole } from '../constants/roles';
import UserAvatar from './UserAvatar';
import NotificationBell from './NotificationBell';
import SupportMegaMenu from './SupportMegaMenu';

function NavItem({ to, end, icon: Icon, label, shortLabel, className, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `${className || 'nav-link'}${isActive ? ' active' : ''}`}
      onClick={onNavigate}
    >
      <Icon size={16} aria-hidden="true" />
      <span className="nav-label-long">{label}</span>
      {shortLabel && <span className="nav-label-short">{shortLabel}</span>}
    </NavLink>
  );
}

function UserMenu({ user, isAdmin, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <UserAvatar user={user} size={32} />
        <span className="user-menu-name">{user.name?.split(' ')[0]}</span>
        <ChevronDown size={14} className="user-menu-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="user-menu-dropdown dropdown-animate" role="menu">
          <Link to="/profile" role="menuitem" onClick={() => setOpen(false)}>
            <User size={16} aria-hidden="true" />
            Profile
          </Link>
          <Link to="/profile" role="menuitem" onClick={() => setOpen(false)}>
            <Settings size={16} aria-hidden="true" />
            Settings
          </Link>
          {isAdmin && (
            <Link to="/admin" role="menuitem" onClick={() => setOpen(false)}>
              <Shield size={16} aria-hidden="true" />
              Admin dashboard
            </Link>
          )}
          <hr />
          <button type="button" className="danger" role="menuitem" onClick={() => { setOpen(false); onLogout(); }}>
            <LogOut size={16} aria-hidden="true" />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const role = resolveRole(user);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="app-header">
        <div className="header-topbar">
          <div className="header-inner header-topbar-inner">
            <span className="header-topbar-left">
              <span className="header-topbar-badge">Official Partner</span>
              Indian Railways · Online Reservation
            </span>
            <span className="header-topbar-right">
              <a href="tel:+917864939820">Helpline: +91 78649 39820</a>
              <span className="header-topbar-sep" aria-hidden="true">|</span>
              <Link to="/about">About</Link>
              <Link to="/contact">Contact</Link>
            </span>
          </div>
        </div>

        <div className="header-main">
          <div className="header-inner">
          <Link to="/home" className="brand" onClick={closeMenu} aria-label="RailYatra home">
            <img src="/logo.png" alt="" className="brand-logo" />
            <span className="brand-text">
              <strong>RailYatra</strong>
              <small>Your journey, simplified</small>
            </span>
          </Link>

          <div className="header-end">
            <nav id="main-navigation" className={`main-nav ${menuOpen ? 'open' : ''}`} aria-label="Main">
              <NavItem to="/home" end icon={Search} label="Search" className="nav-link nav-link--cta" onNavigate={closeMenu} />
              <NavItem to="/pnr" icon={Ticket} label="PNR Status" shortLabel="PNR" onNavigate={closeMenu} />
              <NavItem to="/live-trains" icon={Radio} label="Live Trains" shortLabel="Live" onNavigate={closeMenu} />
              <NavItem to="/bookings" icon={LayoutDashboard} label="My Bookings" shortLabel="Bookings" onNavigate={closeMenu} />
              <SupportMegaMenu onNavigate={closeMenu} />
              <NavLink to="/offers" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} onClick={closeMenu}>
                <Tag size={16} aria-hidden="true" />
                <span className="nav-label-long">Offers</span>
                <span className="nav-badge">New</span>
              </NavLink>
              {user && isStaffRole(role) && role !== 'admin' && (
                <NavItem to="/portal" icon={Briefcase} label="Portal" onNavigate={closeMenu} />
              )}
              {user && isAdmin && (
                <NavItem to="/admin" icon={Shield} label="Admin" onNavigate={closeMenu} />
              )}
            </nav>

            <div className="header-utilities">
              <div className="header-actions">
                {user && <NotificationBell />}
                {user ? (
                  <UserMenu user={user} isAdmin={isAdmin} onLogout={handleLogout} />
                ) : (
                  <div className="header-auth-btns">
                    <Link to="/login" className="btn btn-outline btn-sm">Login</Link>
                    <Link to="/register" className="btn btn-primary btn-sm">Register</Link>
                  </div>
                )}
              </div>

              <button
                type="button"
                className="menu-toggle"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Menu"
                aria-expanded={menuOpen}
                aria-controls="main-navigation"
              >
                {menuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" className="app-main" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="app-footer">
        <div className="footer-inner header-inner">
          <Link to="/home" className="brand" aria-label="RailYatra home">
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
