import { useEffect, useState } from 'react';
import { FileText, Save } from 'lucide-react';
import { api } from '../api/client';

export default function GstSettingsPanel() {
  const [form, setForm] = useState({ gstNumber: '', gstBusinessName: '', notifyBooking: true, notifyRefund: true, notifyDelay: true, notifyChart: true });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/profile/preferences').then((p) => setForm({
      gstNumber: p.gstNumber || '',
      gstBusinessName: p.gstBusinessName || '',
      notifyBooking: p.notifyBooking !== false,
      notifyRefund: p.notifyRefund !== false,
      notifyDelay: p.notifyDelay !== false,
      notifyChart: p.notifyChart !== false
    })).catch(() => {});
  }, []);

  const save = async (e) => {
    e.preventDefault();
    await api.put('/profile/preferences', form);
    setMsg('Preferences saved');
  };

  return (
    <section className="profile-panel card">
      <h2><FileText size={18} /> GST &amp; notifications</h2>
      <form onSubmit={save} className="profile-form-grid">
        <div className="field">
          <label htmlFor="gst">GST number</label>
          <input id="gst" className="input" value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="gst-name">Business name</label>
          <input id="gst-name" className="input" value={form.gstBusinessName} onChange={(e) => setForm({ ...form, gstBusinessName: e.target.value })} />
        </div>
        {['notifyBooking', 'notifyRefund', 'notifyDelay', 'notifyChart'].map((key) => (
          <label key={key} className="route-aware-toggle">
            <input type="checkbox" checked={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />
            Notify: {key.replace('notify', '')}
          </label>
        ))}
        {msg && <p className="alert alert-success">{msg}</p>}
        <button type="submit" className="btn btn-primary btn-sm"><Save size={14} /> Save</button>
      </form>
    </section>
  );
}
