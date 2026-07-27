import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CaptchaField from '../components/CaptchaField';
import { api, setToken } from '../api/client';

export default function AdminLoginPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@railway.com');
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
      const data = await api.post('/auth/login', { email, password, ...captcha });
      setToken(data.token);
      const me = await api.get('/auth/me');
      if (!me.isAdmin) {
        setToken(null);
        setError('Admin access required');
        return;
      }
      window.location.href = '/admin';
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <h1>Admin Login</h1>
        <p className="muted">Operations dashboard access</p>
        <form onSubmit={submit} className="stack">
          <div className="field">
            <label htmlFor="admin-email">Email</label>
            <input id="admin-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="admin-password">Password</label>
            <input id="admin-password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <CaptchaField onChange={setCaptcha} />
          {error && <div className="alert alert-error">{error}</div>}
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p className="auth-footer"><Link to="/">← Back to site</Link></p>
      </div>
    </div>
  );
}
