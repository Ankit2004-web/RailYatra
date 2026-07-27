import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CaptchaField from '../components/CaptchaField';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login({ email, password, ...captcha });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <h1>Welcome back</h1>
        <p className="muted">Sign in to book tickets and manage journeys</p>
        <form onSubmit={submit} className="stack">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <CaptchaField onChange={setCaptcha} />
          {error && <div className="alert alert-error">{error}</div>}
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p className="auth-footer">
          No account? <Link to="/register">Create one</Link>
        </p>
        <p className="auth-footer muted">
          Demo: demo@railway.com / Demo@123
        </p>
      </div>
    </div>
  );
}
