import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Shield } from 'lucide-react';
import CaptchaField from '../components/CaptchaField';
import AuthShell from '../components/AuthShell';
import { useAuth } from '../context/AuthContext';

export default function AdminLoginPage() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user?.isAdmin) {
    navigate('/admin');
    return null;
  }

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const me = await login({ email, password, ...captcha });
      if (!me.isAdmin) {
        logout();
        setError('Admin access required');
        return;
      }
      navigate('/admin');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      variant="enterprise"
      title="Admin login"
      subtitle="Sign in to manage trains, bookings, stations, and reports."
      sideTitle="Operations dashboard"
      sidePoints={[
        'Manage trains and master data',
        'View bookings and revenue reports',
        'Admin-only secure access'
      ]}
    >
      <form className="auth-form" onSubmit={submit}>
        <div className="field auth-field">
          <label htmlFor="admin-email">Admin email</label>
          <div className="auth-input-wrap">
            <Mail size={18} className="auth-input-icon" aria-hidden="true" />
            <input id="admin-email" type="email" className="input auth-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
        </div>
        <div className="field auth-field">
          <label htmlFor="admin-password">Password</label>
          <div className="auth-input-wrap">
            <Lock size={18} className="auth-input-icon" aria-hidden="true" />
            <input id="admin-password" type="password" className="input auth-input" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
        </div>
        <CaptchaField onChange={setCaptcha} />
        {error && <div className="alert alert-error auth-alert">{error}</div>}
        <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={loading}>
          <Shield size={18} aria-hidden="true" />
          {loading ? 'Signing in…' : 'Admin Sign In'}
        </button>
      </form>
      <p className="auth-switch">
        <Link to="/login">← Passenger login</Link>
      </p>
    </AuthShell>
  );
}
