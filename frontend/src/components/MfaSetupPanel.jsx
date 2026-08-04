import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { api } from '../api/client';

export default function MfaSetupPanel() {
  const [setup, setSetup] = useState(null);
  const [token, setToken] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const start = async () => {
    setError('');
    const data = await api.post('/mfa/setup');
    setSetup(data);
  };

  const enable = async (e) => {
    e.preventDefault();
    try {
      await api.post('/mfa/enable', { token });
      setMsg('Two-factor authentication enabled');
      setSetup(null);
    } catch (err) {
      setError(err.message || 'Invalid code');
    }
  };

  const disable = async (e) => {
    e.preventDefault();
    try {
      await api.post('/mfa/disable', { token });
      setMsg('Two-factor authentication disabled');
    } catch (err) {
      setError(err.message || 'Invalid code');
    }
  };

  return (
    <section className="profile-panel card">
      <h2><ShieldCheck size={18} /> Two-factor authentication</h2>
      {!setup ? (
        <button type="button" className="btn btn-outline btn-sm" onClick={start}>Set up MFA</button>
      ) : (
        <form onSubmit={enable}>
          <p className="muted">Scan this secret in Google Authenticator: <code>{setup.secret}</code></p>
          <input className="input" placeholder="6-digit code" value={token} onChange={(e) => setToken(e.target.value)} required />
          <button type="submit" className="btn btn-primary btn-sm">Enable MFA</button>
        </form>
      )}
      <form onSubmit={disable} style={{ marginTop: 12 }}>
        <input className="input" placeholder="Code to disable" value={token} onChange={(e) => setToken(e.target.value)} />
        <button type="submit" className="btn btn-ghost btn-sm">Disable MFA</button>
      </form>
      {msg && <p className="alert alert-success">{msg}</p>}
      {error && <p className="alert alert-error">{error}</p>}
    </section>
  );
}
