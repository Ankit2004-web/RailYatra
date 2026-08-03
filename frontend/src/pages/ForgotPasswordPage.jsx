import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Send } from 'lucide-react';
import { api } from '../api/client';
import CaptchaField from '../components/CaptchaField';
import AuthShell from '../components/AuthShell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [captcha, setCaptcha] = useState({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [devResetUrl, setDevResetUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setDevResetUrl('');
    setLoading(true);
    try {
      const data = await api.post('/auth/forgot-password', { email, ...captcha });
      setMessage(data.msg || 'If that email exists, a reset link has been sent.');
      if (data.devResetUrl) setDevResetUrl(data.devResetUrl);
    } catch (err) {
      setError(err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      variant="enterprise"
      title="Forgot password?"
      subtitle="Enter your email and we'll send you a link to reset your password."
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

        <CaptchaField onChange={setCaptcha} />

        {error && <div className="alert alert-error auth-alert">{error}</div>}
        {message && <div className="alert alert-success auth-alert">{message}</div>}
        {devResetUrl && (
          <p className="auth-dev-link">
            Dev reset link: <a href={devResetUrl}>{devResetUrl}</a>
          </p>
        )}

        <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={loading}>
          <Send size={18} aria-hidden="true" />
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p className="auth-switch auth-back-link">
        <Link to="/login"><ArrowLeft size={14} aria-hidden="true" /> Back to sign in</Link>
      </p>
    </AuthShell>
  );
}
