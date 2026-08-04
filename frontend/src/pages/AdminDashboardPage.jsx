import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, LayoutDashboard, TrainFront, Users, Ticket } from 'lucide-react';
import { api } from '../api/client';
import { formatDisplayDate } from '../utils/trainMapper';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'users', label: 'Users' },
  { id: 'trains', label: 'Trains' },
  { id: 'stations', label: 'Stations' },
  { id: 'reports', label: 'Reports' },
  { id: 'waitlist', label: 'Waitlist' },
  { id: 'audit', label: 'Audit Logs' },
  { id: 'reconciliation', label: 'Reconciliation' },
  { id: 'master', label: 'Master Data' }
];

function StatGrid({ stats, limit }) {
  const entries = Object.entries(stats || {}).slice(0, limit || 12);
  return (
    <div className="admin-stats-grid">
      {entries.map(([key, val]) => (
        <div key={key} className="admin-stat-card card">
          <span className="admin-stat-label">{key.replace(/([A-Z])/g, ' $1')}</span>
          <strong>
            {typeof val === 'number' && key.toLowerCase().includes('revenue')
              ? `₹${Number(val).toLocaleString('en-IN')}`
              : val}
          </strong>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [tab, setTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [dashboard, setDashboard] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [users, setUsers] = useState([]);
  const [trains, setTrains] = useState(null);
  const [masterData, setMasterData] = useState(null);
  const [reports, setReports] = useState(null);
  const [stations, setStations] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [reconciliation, setReconciliation] = useState(null);
  const [reconciliationLogs, setReconciliationLogs] = useState([]);

  const [trainSearch, setTrainSearch] = useState('');
  const [bookingFilter, setBookingFilter] = useState({ status: '', pnr: '' });
  const [waitlistForm, setWaitlistForm] = useState({ trainId: '', classCode: 'SL', journeyDate: '' });

  const loadTab = async () => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'dashboard') {
        setDashboard(await api.get('/admin/dashboard'));
      }
      if (tab === 'bookings') {
        const q = new URLSearchParams();
        if (bookingFilter.status) q.set('status', bookingFilter.status);
        if (bookingFilter.pnr) q.set('pnr', bookingFilter.pnr);
        setBookings(await api.get(`/admin/bookings?${q}`));
      }
      if (tab === 'users') {
        setUsers(await api.get('/admin/users'));
      }
      if (tab === 'trains') {
        setTrains(await api.get(`/admin/trains?page=1&pageSize=25&search=${encodeURIComponent(trainSearch)}`));
      }
      if (tab === 'stations') {
        setStations(await api.get('/admin/stations?page=1&pageSize=50'));
      }
      if (tab === 'audit') {
        setAuditLogs(await api.get('/admin/audit-logs?limit=100'));
      }
      if (tab === 'reconciliation') {
        const [logs, latest] = await Promise.all([
          api.get('/admin/reconciliation/logs?limit=20'),
          api.get('/admin/reconciliation').catch(() => null)
        ]);
        setReconciliationLogs(logs);
        setReconciliation(latest);
      }
      if (tab === 'reports') {
        const [revenue, occupancy, cancellations] = await Promise.all([
          api.get('/admin/reports/revenue'),
          api.get('/admin/reports/occupancy'),
          api.get('/admin/reports/cancellations')
        ]);
        setReports({ revenue, occupancy, cancellations });
      }
      if (tab === 'master') {
        setMasterData(await api.get('/admin/data-import/status'));
      }
    } catch (err) {
      setError(err.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTab();
  }, [tab]);

  useEffect(() => {
    api.get('/admin/dashboard')
      .then(setDashboard)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const recentBookings = dashboard?.recentBookings || [];

  const toggleUserBlock = async (user) => {
    try {
      await api.put(`/admin/users/${user.id}`, { isBlocked: !user.isBlocked });
      setToast(user.isBlocked ? 'User unblocked' : 'User blocked');
      setUsers(await api.get('/admin/users'));
    } catch (err) {
      setError(err.message || 'Could not update user');
    }
  };

  const promoteWaitlist = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const result = await api.post('/admin/waitlist/promote', {
        trainId: Number(waitlistForm.trainId),
        classCode: waitlistForm.classCode,
        journeyDate: waitlistForm.journeyDate
      });
      setToast(result.msg || 'Waitlist promoted');
    } catch (err) {
      setError(err.message || 'Promotion failed');
    }
  };

  const promoteRac = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const result = await api.post('/admin/rac/promote', {
        trainId: Number(waitlistForm.trainId),
        classCode: waitlistForm.classCode,
        journeyDate: waitlistForm.journeyDate
      });
      setToast(result.msg || 'RAC booking promoted');
    } catch (err) {
      setError(err.message || 'RAC promotion failed');
    }
  };

  const reportSummary = useMemo(() => {
    if (!reports) return null;
    return {
      revenue: reports.revenue?.totalRevenue || 0,
      occupancyRows: reports.occupancy?.length || 0,
      cancellations: reports.cancellations?.totalCancellations || 0
    };
  }, [reports]);

  const heroStats = useMemo(() => {
    const s = dashboard?.stats;
    if (!s) return [];
    return [
      { label: 'Bookings', value: s.totalBookings ?? 0, icon: Ticket },
      { label: 'Confirmed', value: s.confirmedBookings ?? 0, icon: LayoutDashboard },
      { label: 'Users', value: s.totalUsers ?? 0, icon: Users },
      { label: 'Trains', value: s.totalTrains ?? 0, icon: TrainFront }
    ];
  }, [dashboard]);

  return (
    <div className="admin-page page-shell">
      <section className="admin-hero page-hero">
        <div className="admin-hero-inner page-hero-inner page-hero-split">
          <div className="page-hero-copy">
            <span className="page-hero-badge">
              <Shield size={14} aria-hidden="true" /> Admin Portal
            </span>
            <h1 className="page-hero-title">Admin Dashboard</h1>
            <p className="page-hero-subtitle">
              Manage trains, bookings, users, stations, and revenue reports from one place.
            </p>
          </div>
          {heroStats.length > 0 && (
            <div className="admin-hero-stats">
              {heroStats.map(({ label, value, icon: Icon }) => (
                <div key={label} className="admin-hero-stat">
                  <Icon size={16} aria-hidden="true" />
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="admin-body page-body">
        {toast && <div className="admin-toast" role="status">{toast}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <div className="admin-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? 'active' : ''}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="page-loading"><div className="spinner" aria-label="Loading" /></div>
        )}

        {!loading && tab === 'dashboard' && dashboard && (
          <div className="admin-stack">
            <StatGrid stats={dashboard.stats} />
            <div className="card admin-panel">
              <h2>Recent bookings</h2>
              {recentBookings.length === 0 ? (
                <p className="muted">No recent bookings.</p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>PNR</th>
                        <th>Train</th>
                        <th>Status</th>
                        <th>Journey</th>
                        <th>Fare</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentBookings.map((b) => (
                        <tr key={b.id}>
                          <td>{b.pnrNumber}</td>
                          <td>{b.train?.trainNumber} {b.train?.trainName}</td>
                          <td><span className={`status status-${b.status?.toLowerCase()}`}>{b.status}</span></td>
                          <td>{formatDisplayDate(b.journeyDate)}</td>
                          <td>₹{Number(b.totalPrice || 0).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {!loading && tab === 'bookings' && (
          <div className="admin-stack">
            <div className="admin-filters card">
              <input
                className="input"
                placeholder="Filter by PNR"
                value={bookingFilter.pnr}
                onChange={(e) => setBookingFilter({ ...bookingFilter, pnr: e.target.value })}
              />
              <select
                className="input"
                value={bookingFilter.status}
                onChange={(e) => setBookingFilter({ ...bookingFilter, status: e.target.value })}
              >
                <option value="">All statuses</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Pending">Pending</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Waitlisted">Waitlisted</option>
                <option value="RAC">RAC</option>
              </select>
              <button type="button" className="btn btn-primary btn-sm" onClick={loadTab}>Apply</button>
            </div>
            <div className="admin-table-wrap card">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>PNR</th>
                    <th>User</th>
                    <th>Train</th>
                    <th>Class</th>
                    <th>Status</th>
                    <th>Journey</th>
                    <th>Fare</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.length === 0 ? (
                    <tr><td colSpan={7} className="muted">No bookings found.</td></tr>
                  ) : bookings.map((b) => (
                    <tr key={b.id}>
                      <td>{b.pnrNumber}</td>
                      <td>{b.user?.name || b.user?.email || '—'}</td>
                      <td>{b.train?.trainNumber}</td>
                      <td>{b.classCode}</td>
                      <td>{b.status}</td>
                      <td>{formatDisplayDate(b.journeyDate)}</td>
                      <td>₹{Number(b.totalPrice || 0).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && tab === 'users' && (
          <div className="admin-table-wrap card">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={6} className="muted">No users found.</td></tr>
                ) : users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.phone || '—'}</td>
                    <td>{u.isAdmin ? 'Admin' : 'Passenger'}</td>
                    <td>{u.isBlocked ? 'Blocked' : 'Active'}</td>
                    <td>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => toggleUserBlock(u)}>
                        {u.isBlocked ? 'Unblock' : 'Block'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && tab === 'trains' && (
          <div className="admin-stack">
            <input
              className="input"
              placeholder="Search trains…"
              value={trainSearch}
              onChange={(e) => setTrainSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadTab()}
            />
            <div className="admin-table-wrap card">
              <table className="admin-table">
                <thead>
                  <tr><th>Number</th><th>Name</th><th>Route</th><th>Type</th><th>Stops</th></tr>
                </thead>
                <tbody>
                  {(trains?.items || []).length === 0 ? (
                    <tr><td colSpan={5} className="muted">No trains found.</td></tr>
                  ) : (trains?.items || []).map((t) => (
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
          </div>
        )}

        {!loading && tab === 'stations' && stations && (
          <div className="card admin-panel">
            <h3>Stations ({stations.totalItems})</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Code</th><th>Name</th><th>City</th><th>State</th></tr></thead>
                <tbody>
                  {(stations.items || []).map((s) => (
                    <tr key={s.id}>
                      <td><Link to={`/stations/${s.code}`}>{s.code}</Link></td>
                      <td>{s.name}</td>
                      <td>{s.city}</td>
                      <td>{s.state}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && tab === 'audit' && (
          <div className="card admin-panel">
            <h3>Audit logs</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Resource</th></tr></thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{formatDisplayDate(log.createdAt)}</td>
                      <td>{log.userName || log.userEmail || '—'}</td>
                      <td>{log.action}</td>
                      <td>{log.resource || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && tab === 'reconciliation' && (
          <div className="admin-stack">
            {reconciliation && (
              <StatGrid stats={{
                paidUnconfirmedFixed: reconciliation.paidUnconfirmed?.fixed ?? 0,
                stuckPaymentsMarked: reconciliation.stuckPayments?.marked ?? 0,
                refundsRetried: reconciliation.failedRefunds?.retried ?? 0
              }} limit={3} />
            )}
            <div className="card admin-panel">
              <h3>Reconciliation runs</h3>
              <p className="admin-hint">Auto-runs every 15 minutes. Latest manual run shown above when tab loads.</p>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Time</th><th>Type</th><th>Matched</th><th>Mismatch</th><th>Auto-fixed</th></tr></thead>
                  <tbody>
                    {reconciliationLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{formatDisplayDate(log.createdAt)}</td>
                        <td>{log.runType}</td>
                        <td>{log.matchedCount}</td>
                        <td>{log.mismatchCount}</td>
                        <td>{log.autoFixedCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {!loading && tab === 'reports' && reports && (
          <div className="admin-stack">
            <StatGrid stats={{
              totalRevenue: reportSummary.revenue,
              occupancyRows: reportSummary.occupancyRows,
              totalCancellations: reportSummary.cancellations
            }} limit={3} />
            <div className="admin-grid-2">
              <div className="card admin-panel">
                <h3>Revenue by date</h3>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>Date</th><th>Bookings</th><th>Revenue</th></tr></thead>
                    <tbody>
                      {(reports.revenue?.report || []).slice(0, 10).map((row) => (
                        <tr key={row.date || row.bookingDate}>
                          <td>{formatDisplayDate(row.date || row.bookingDate)}</td>
                          <td>{row.bookingCount ?? row.count ?? '—'}</td>
                          <td>₹{Number(row.revenue || 0).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="card admin-panel">
                <h3>Occupancy</h3>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>Train</th><th>Class</th><th>Booked</th><th>Total</th></tr></thead>
                    <tbody>
                      {(reports.occupancy || []).slice(0, 10).map((row, i) => (
                        <tr key={`${row.trainId}-${row.classCode}-${i}`}>
                          <td>{row.trainNumber || row.trainId}</td>
                          <td>{row.classCode}</td>
                          <td>{row.bookedSeats ?? row.booked ?? '—'}</td>
                          <td>{row.totalSeats ?? row.total ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && tab === 'waitlist' && (
          <>
            <form className="card admin-panel admin-waitlist-form" onSubmit={promoteWaitlist}>
              <h2>Promote waitlist</h2>
              <p className="muted">Promote the next waitlisted booking when seats become available.</p>
              <div className="admin-form-grid">
                <div className="field">
                  <label htmlFor="wl-train">Train ID</label>
                  <input id="wl-train" className="input" required value={waitlistForm.trainId} onChange={(e) => setWaitlistForm({ ...waitlistForm, trainId: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="wl-class">Class</label>
                  <select id="wl-class" className="input" value={waitlistForm.classCode} onChange={(e) => setWaitlistForm({ ...waitlistForm, classCode: e.target.value })}>
                    {['SL', '3A', '2A', '1A', 'CC', '2S'].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="wl-date">Journey date</label>
                  <input id="wl-date" type="date" className="input" required value={waitlistForm.journeyDate} onChange={(e) => setWaitlistForm({ ...waitlistForm, journeyDate: e.target.value })} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary">Promote next WL booking</button>
            </form>
            <form className="card admin-panel admin-waitlist-form" onSubmit={promoteRac}>
              <h2>Promote RAC</h2>
              <p className="muted">Confirm the next paid RAC booking when berths become available.</p>
              <div className="admin-form-grid">
                <div className="field">
                  <label htmlFor="rac-train">Train ID</label>
                  <input id="rac-train" className="input" required value={waitlistForm.trainId} onChange={(e) => setWaitlistForm({ ...waitlistForm, trainId: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="rac-class">Class</label>
                  <select id="rac-class" className="input" value={waitlistForm.classCode} onChange={(e) => setWaitlistForm({ ...waitlistForm, classCode: e.target.value })}>
                    {['SL', '3A', '2A', '1A', 'CC', '2S'].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="rac-date">Journey date</label>
                  <input id="rac-date" type="date" className="input" required value={waitlistForm.journeyDate} onChange={(e) => setWaitlistForm({ ...waitlistForm, journeyDate: e.target.value })} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary">Promote next RAC booking</button>
            </form>
          </>
        )}

        {!loading && tab === 'master' && masterData && (
          <div className="admin-stack">
            <StatGrid stats={masterData.masterDataCounts} />
            {(masterData.limitations || []).map((item) => (
              <div key={item} className="alert alert-warning">{item}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
