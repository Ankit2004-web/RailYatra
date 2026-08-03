import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, KeyRound, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { api } from '../api/client';
import AuthShell from '../components/AuthShell';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      navigate('/login', { replace: true, state: { resetSuccess: true } });
    } catch (err) {
      setError(err.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthShell
        variant="enterprise"
        title="Invalid reset link"
        subtitle="This password reset link is missing or invalid. Request a new one."
        sideTitle="Book smarter with RailYatra"
        sidePoints={[]}
      >
        <div className="alert alert-error auth-alert">Invalid or expired reset link.</div>
        <Link to="/forgot-password" className="btn btn-primary btn-block auth-submit">
          Request new link
        </Link>
        <p className="auth-switch auth-back-link">
          <Link to="/login"><ArrowLeft size={14} aria-hidden="true" /> Back to sign in</Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      variant="enterprise"
      title="Set new password"
      subtitle="Choose a strong password with at least 6 characters."
      sideTitle="Book smarter with RailYatra"
      sidePoints={[]}
    >
      <form className="auth-form" onSubmit={submit}>
        <div className="field auth-field">
          <label htmlFor="password">New password</label>
          <div className="auth-input-wrap">
            <Lock size={18} className="auth-input-icon" aria-hidden="true" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className="input auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 6 characters"
              minLength={6}
              autoComplete="new-password"
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

        <div className="field auth-field">
          <label htmlFor="confirmPassword">Confirm password</label>
          <div className="auth-input-wrap">
            <KeyRound size={18} className="auth-input-icon" aria-hidden="true" />
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              className="input auth-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              minLength={6}
              autoComplete="new-password"
              required
            />
          </div>
        </div>

        {error && <div className="alert alert-error auth-alert">{error}</div>}

        <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={loading}>
          <KeyRound size={18} aria-hidden="true" />
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>

      <p className="auth-switch auth-back-link">
        <Link to="/login"><ArrowLeft size={14} aria-hidden="true" /> Back to sign in</Link>
      </p>
    </AuthShell>
  );
}
