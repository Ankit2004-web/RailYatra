import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Lock, UserPlus, Eye, EyeOff, UserRound, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CaptchaField from '../components/CaptchaField';
import AuthShell from '../components/AuthShell';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', phone: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [captcha, setCaptcha] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (submittingRef.current || loading) return;
    submittingRef.current = true;
    setError('');
    setLoading(true);
    try {
      const loginId = form.phone.trim();
      const payload = {
        name: form.name.trim(),
        password: form.password,
        ...captcha
      };
      if (loginId.includes('@')) {
        payload.email = loginId;
      } else {
        payload.phone = loginId;
      }
      await register(payload);
      navigate('/home');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <AuthShell
      variant="enterprise"
      title="Create your account"
      subtitle="Join RailYatra to book trains and manage all your journeys in one place."
      sideTitle="Start your rail journey"
      sidePoints={[
        'Free registration — book in minutes',
        'Save passengers and view booking history',
        'PNR tracking and e-ticket downloads'
      ]}
    >
      <form className="auth-form" onSubmit={submit}>
        <div className="field auth-field">
          <label htmlFor="name">Full name</label>
          <div className="auth-input-wrap">
            <User size={18} className="auth-input-icon" aria-hidden="true" />
            <input
              id="name"
              className="input auth-input"
              value={form.name}
              onChange={set('name')}
              placeholder="Your full name"
              autoComplete="name"
              required
            />
          </div>
        </div>

        <div className="field auth-field">
          <label htmlFor="phone">Mobile number or email</label>
          <div className="auth-input-wrap">
            <UserRound size={18} className="auth-input-icon" aria-hidden="true" />
            <input
              id="phone"
              type="text"
              className="input auth-input"
              value={form.phone}
              onChange={set('phone')}
              placeholder="10-digit mobile or email@example.com"
              autoComplete="username"
              required
            />
          </div>
        </div>

        <div className="field auth-field">
          <label htmlFor="password">Password</label>
          <div className="auth-input-wrap">
            <Lock size={18} className="auth-input-icon" aria-hidden="true" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className="input auth-input"
              value={form.password}
              onChange={set('password')}
              placeholder="Min. 6 characters"
              autoComplete="new-password"
              minLength={6}
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
        {error && <div className="alert alert-error auth-alert">{error}</div>}

        <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={loading}>
          <UserPlus size={18} aria-hidden="true" />
          {loading ? 'Creating account…' : 'Create Account'}
        </button>
      </form>

      <div className="auth-card-footer">
        <Link to="/login" className="btn btn-outline btn-block auth-register-btn">
          <LogIn size={18} aria-hidden="true" />
          Sign In
        </Link>
      </div>
    </AuthShell>
  );
}
