import { useState } from 'react';
import { api } from '../api/client';

export default function PnrPage() {
  const [pnr, setPnr] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const data = await api.get(`/bookings/pnr/${pnr.trim()}`);
      setResult(data);
    } catch (err) {
      setError(err.message || 'PNR not found');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-narrow page narrow">
      <h1>PNR Status</h1>
      <p className="muted">Enter your 10-digit PNR to check booking status</p>

      <form className="card stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="pnr">PNR Number</label>
          <input
            id="pnr"
            className="input"
            value={pnr}
            onChange={(e) => setPnr(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="10-digit PNR"
            pattern="\d{10}"
            required
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Checking…' : 'Check Status'}
        </button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {result && (
        <div className="pnr-result card">
          <div className="pnr-result-head">
            <div>
              <span className="pnr">PNR {result.pnrNumber}</span>
              <h2>{result.train?.trainName}</h2>
            </div>
            <span className={`status status-${result.status?.toLowerCase()}`}>{result.status}</span>
          </div>
          <div className="pnr-grid">
            <div><strong>Route</strong><p>{result.train?.source} → {result.train?.destination}</p></div>
            <div><strong>Journey Date</strong><p>{result.journeyDate}</p></div>
            <div><strong>Class</strong><p>{result.className || result.classCode}</p></div>
            <div><strong>Payment</strong><p>{result.paymentStatus}</p></div>
          </div>
          <div>
            <strong>Passengers</strong>
            <ul>
              {(result.passengers || []).map((p, i) => (
                <li key={i}>{p.name} · {p.age} · {p.gender}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
