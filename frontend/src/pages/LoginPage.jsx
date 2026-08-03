import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Mail, Lock, LogIn, Eye, EyeOff, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CaptchaField from '../components/CaptchaField';
import AuthShell from '../components/AuthShell';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captcha, setCaptcha] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (location.state?.resetSuccess) {
      setSuccess('Password updated successfully. You can now sign in.');
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

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
    <AuthShell
      variant="enterprise"
      title="Welcome back"
      subtitle="Sign in to book tickets, manage journeys, and download e-tickets."
      sideTitle="Book smarter with RailYatra"
      sidePoints={[
        'Search trains across thousands of stations',
        'Secure booking with instant PNR',
        'Track tickets and download e-tickets anytime'
      ]}
    >
      <form className="auth-form" onSubmit={submit}>
        <div className="field auth-field">
          <label htmlFor="email">Email address</label>
          <div className="auth-input-wrap">
            <Mail size={18} className="auth-input-icon" aria-hidden="true" />
            <input
              id="email"
              type="email"
              className="input auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
        </div>

        <div className="field auth-field">
          <div className="auth-label-row">
            <label htmlFor="password">Password</label>
            <Link to="/forgot-password" className="auth-forgot-link">Forgot password?</Link>
          </div>
          <div className="auth-input-wrap">
            <Lock size={18} className="auth-input-icon" aria-hidden="true" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className="input auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="auth-toggle-password"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <CaptchaField onChange={setCaptcha} />

        {success && <div className="alert alert-success auth-alert">{success}</div>}
        {error && <div className="alert alert-error auth-alert">{error}</div>}

        <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={loading}>
          <LogIn size={18} aria-hidden="true" />
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <div className="auth-card-footer">
        <div className="auth-divider"><span>or</span></div>

        <Link to="/register" className="btn btn-outline btn-block auth-register-btn">
          <UserPlus size={18} aria-hidden="true" />
          Create Account
        </Link>

        <p className="auth-admin-link muted">
          Admin? <Link to="/admin/login">Admin login</Link>
        </p>
      </div>
    </AuthShell>
  );
}
