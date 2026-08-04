import { useEffect, useState } from 'react';
import { Smartphone, Trash2 } from 'lucide-react';
import { api } from '../api/client';

export default function DeviceManagementPanel() {
  const [devices, setDevices] = useState([]);

  const load = () => api.get('/otp/devices').then(setDevices).catch(() => {});

  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    await api.delete(`/profile/devices/${id}`);
    load();
  };

  return (
    <section className="profile-panel card">
      <h2><Smartphone size={18} /> Registered devices</h2>
      <ul className="profile-list">
        {devices.length === 0 && <li className="muted">No devices registered yet.</li>}
        {devices.map((d) => (
          <li key={d.id}>
            <span>{d.deviceLabel}</span>
            <span className="muted">{new Date(d.lastSeenAt || d.createdAt).toLocaleDateString()}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(d.id)}><Trash2 size={14} /></button>
          </li>
        ))}
      </ul>
    </section>
  );
}
