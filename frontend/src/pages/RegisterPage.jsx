import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CaptchaField from '../components/CaptchaField';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [captcha, setCaptcha] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({ ...form, ...captcha });
      navigate('/');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <h1>Create account</h1>
        <p className="muted">Join to book trains and track PNR</p>
        <form onSubmit={submit} className="stack">
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input id="name" className="input" value={form.name} onChange={set('name')} required />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" className="input" value={form.email} onChange={set('email')} required />
          </div>
          <div className="field">
            <label htmlFor="phone">Phone</label>
            <input id="phone" className="input" value={form.phone} onChange={set('phone')} required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" className="input" value={form.password} onChange={set('password')} minLength={6} required />
          </div>
          <CaptchaField onChange={setCaptcha} />
          {error && <div className="alert alert-error">{error}</div>}
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Creating…' : 'Register'}
          </button>
        </form>
        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
