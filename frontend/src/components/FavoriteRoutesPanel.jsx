import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, Plus, Trash2 } from 'lucide-react';
import { api } from '../api/client';

export default function FavoriteRoutesPanel() {
  const [routes, setRoutes] = useState([]);
  const [form, setForm] = useState({ sourceCode: '', destinationCode: '', label: '' });
  const [msg, setMsg] = useState('');

  const load = () => api.get('/profile/favorites').then(setRoutes).catch(() => {});

  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    await api.post('/profile/favorites', form);
    setForm({ sourceCode: '', destinationCode: '', label: '' });
    setMsg('Route saved');
    load();
  };

  const remove = async (id) => {
    await api.delete(`/profile/favorites/${id}`);
    load();
  };

  return (
    <section className="profile-panel card">
      <h2><Star size={18} /> Favorite routes</h2>
      <form className="profile-inline-form" onSubmit={add}>
        <input className="input" placeholder="From code" value={form.sourceCode} onChange={(e) => setForm({ ...form, sourceCode: e.target.value })} required />
        <input className="input" placeholder="To code" value={form.destinationCode} onChange={(e) => setForm({ ...form, destinationCode: e.target.value })} required />
        <input className="input" placeholder="Label (optional)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        <button type="submit" className="btn btn-primary btn-sm"><Plus size={14} /> Add</button>
      </form>
      {msg && <p className="alert alert-success">{msg}</p>}
      <ul className="profile-list">
        {routes.map((r) => (
          <li key={r.id}>
            <Link to={`/search?source=${r.sourceCode}&destination=${r.destinationCode}`}>
              {r.label || `${r.sourceCode} → ${r.destinationCode}`}
            </Link>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(r.id)}><Trash2 size={14} /></button>
          </li>
        ))}
      </ul>
    </section>
  );
}
