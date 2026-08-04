import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Lock, LogIn, Eye, EyeOff, UserPlus, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CaptchaField from '../components/CaptchaField';
import AuthShell from '../components/AuthShell';
import { getPortalPath } from '../constants/roles';

export default function LoginPage() {
  const { login, verifyMfa } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/home';

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captcha, setCaptcha] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [mfaPending, setMfaPending] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const submittingRef = useRef(false);

  useEffect(() => {
    if (location.state?.resetSuccess) {
      setSuccess('Password updated successfully. You can now sign in.');
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const afterLogin = (me) => {
    const dest = me?.role && me.role !== 'passenger' ? getPortalPath(me.role) : from;
    navigate(dest, { replace: true });
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    if (submittingRef.current || loading) return;
    submittingRef.current = true;
    setError('');
    setLoading(true);
    try {
      const me = await login({ phone, password, ...captcha });
      afterLogin(me);
    } catch (err) {
      if (err.mfaRequired) {
        setMfaPending(err.pendingToken);
        setSuccess('Enter the 6-digit code from your authenticator app.');
      } else {
        setError(err.message || 'Login failed');
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const submitMfa = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const me = await verifyMfa({ pendingToken: mfaPending, mfaToken: mfaCode });
      afterLogin(me);
    } catch (err) {
      setError(err.message || 'Invalid MFA code');
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
      {mfaPending ? (
        <form className="auth-form" onSubmit={submitMfa}>
          <div className="field auth-field">
            <label htmlFor="mfa">Authenticator code</label>
            <input id="mfa" className="input" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} required />
          </div>
          {error && <div className="alert alert-error auth-alert">{error}</div>}
          {success && <div className="alert alert-success auth-alert">{success}</div>}
          <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={loading}>Verify</button>
        </form>
      ) : (
        <form className="auth-form" onSubmit={submitPassword}>
          <div className="field auth-field">
            <label htmlFor="phone">Mobile number or email</label>
            <div className="auth-input-wrap">
              <UserRound size={18} className="auth-input-icon" aria-hidden="true" />
              <input
                id="phone"
                type="text"
                className="input auth-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile or email@example.com"
                autoComplete="username"
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
      )}

      <div className="auth-card-footer">
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
