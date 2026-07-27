import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import ProtectedRoute from '../components/ProtectedRoute';

function AdminContent() {
  const [tab, setTab] = useState('dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [trains, setTrains] = useState(null);
  const [masterData, setMasterData] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (tab === 'dashboard') api.get('/admin/dashboard').then(setDashboard);
    if (tab === 'trains') api.get(`/admin/trains?page=1&pageSize=20&search=${encodeURIComponent(search)}`).then(setTrains);
    if (tab === 'master') api.get('/admin/data-import/status').then(setMasterData);
  }, [tab, search]);

  return (
    <div className="admin-page">
      <div className="container">
        <div className="admin-head">
          <div>
            <h1>Admin Dashboard</h1>
            <p className="muted">Manage trains, bookings, and master data</p>
          </div>
          <Link to="/" className="btn btn-outline btn-sm">← Main site</Link>
        </div>

        <div className="admin-tabs">
          {['dashboard', 'trains', 'master'].map((t) => (
            <button key={t} type="button" className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t === 'master' ? 'Master Data' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'dashboard' && dashboard && (
          <div className="stats-grid">
            {Object.entries(dashboard.stats || {}).slice(0, 8).map(([key, val]) => (
              <div key={key} className="stat-card card">
                <span className="stat-label">{key.replace(/([A-Z])/g, ' $1')}</span>
                <strong>{typeof val === 'number' && key.toLowerCase().includes('revenue') ? `₹${Number(val).toLocaleString('en-IN')}` : val}</strong>
              </div>
            ))}
          </div>
        )}

        {tab === 'trains' && (
          <>
            <input className="input" placeholder="Search trains…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="table-wrap card">
              <table className="data-table">
                <thead>
                  <tr><th>Number</th><th>Name</th><th>Route</th><th>Type</th><th>Stops</th></tr>
                </thead>
                <tbody>
                  {(trains?.items || []).map((t) => (
                    <tr key={t.id}>
                      <td>{t.trainNumber}</td>
                      <td>{t.trainName}</td>
                      <td>{t.sourceStationCode || t.source} → {t.destStationCode || t.destination}</td>
                      <td>{t.trainTypeCode || '—'}</td>
                      <td>{t.stopCount ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'master' && masterData && (
          <div className="stack">
            <div className="stats-grid">
              {Object.entries(masterData.masterDataCounts || {}).map(([k, v]) => (
                <div key={k} className="stat-card card">
                  <span className="stat-label">{k}</span>
                  <strong>{Number(v).toLocaleString()}</strong>
                </div>
              ))}
            </div>
            {(masterData.limitations || []).map((item) => (
              <div key={item} className="alert alert-warning">{item}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute adminOnly>
      <AdminContent />
    </ProtectedRoute>
  );
}
