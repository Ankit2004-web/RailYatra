import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading, blockedMessage } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <p>Loading…</p>
      </div>
    );
  }

  if (blockedMessage) {
    return (
      <div className="page-shell" style={{ padding: '3rem 1.5rem', maxWidth: 520, margin: '0 auto' }}>
        <div className="alert alert-error">{blockedMessage}</div>
        <Link to="/contact" className="btn btn-outline btn-sm" style={{ marginTop: '1rem' }}>Contact support</Link>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (adminOnly && !user.isAdmin) {
    return <Navigate to="/home" replace />;
  }

  return children;
}
