import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    if (!user) return;
    api.get('/notifications').then(setItems).catch(() => {});
  }, [user]);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  if (!user) return null;

  const unread = items.filter((n) => !n.isRead).length;

  const markAll = async () => {
    await api.put('/notifications/read-all').catch(() => {});
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const markOne = async (id) => {
    await api.put(`/notifications/${id}/read`).catch(() => {});
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  return (
    <div className="notification-bell" ref={ref}>
      <button
        type="button"
        className={`notification-bell-btn${unread > 0 ? ' has-unread' : ''}${open ? ' is-open' : ''}`}
        onClick={() => setOpen(!open)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
      >
        <Bell size={18} aria-hidden="true" />
        {unread > 0 && (
          <span className="notification-badge notification-badge--pulse">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="notification-panel dropdown-animate" role="dialog" aria-label="Notifications">
          <div className="notification-panel-head">
            <div>
              <strong>Notifications</strong>
              {unread > 0 && <span className="notification-unread-pill">{unread} new</span>}
            </div>
            {unread > 0 && (
              <button type="button" className="notification-mark-all" onClick={markAll}>
                <CheckCheck size={14} aria-hidden="true" />
                Mark all read
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="notification-empty-state">
              <Inbox size={28} aria-hidden="true" />
              <p>You're all caught up</p>
              <span>No notifications yet</span>
            </div>
          ) : (
            <ul className="notification-list">
              {items.slice(0, 8).map((n, i) => (
                <li
                  key={n.id}
                  className={n.isRead ? '' : 'unread'}
                  style={{ '--item-delay': `${i * 40}ms` }}
                  onClick={() => !n.isRead && markOne(n.id)}
                  onKeyDown={(e) => e.key === 'Enter' && !n.isRead && markOne(n.id)}
                  role="button"
                  tabIndex={0}
                >
                  {!n.isRead && <span className="notification-dot" aria-hidden="true" />}
                  <div className="notification-item-body">
                    <strong>{n.title}</strong>
                    <span>{n.message}</span>
                    {n.createdAt && <time className="notification-time">{timeAgo(n.createdAt)}</time>}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Link to="/bookings" className="notification-footer" onClick={() => setOpen(false)}>
            View all bookings →
          </Link>
        </div>
      )}
    </div>
  );
}
