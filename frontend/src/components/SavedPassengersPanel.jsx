import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, UserPlus, Save, Pencil, X } from 'lucide-react';
import { api } from '../api/client';
import {
  BERTH_OPTIONS,
  GENDER_OPTIONS,
  bookingPassengerToSaved,
  displayBerthPreference
} from '../utils/passengerForm';

const EMPTY_FORM = {
  name: '',
  age: '',
  gender: 'Male',
  berthPreference: 'No Preference'
};

export default function SavedPassengersPanel({ compact = false }) {
  const [passengers, setPassengers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadPassengers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await api.get('/passengers/saved');
      setPassengers(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err.message || 'Could not load saved passengers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPassengers();
  }, [loadPassengers]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const startEdit = (passenger) => {
    setEditingId(passenger.id);
    setForm({
      name: passenger.name,
      age: String(passenger.age),
      gender: passenger.gender,
      berthPreference: displayBerthPreference(passenger.berthPreference)
    });
    setMessage('');
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    const payload = bookingPassengerToSaved(form);
    if (!payload.name || !payload.age) {
      setError('Name and age are required');
      setSaving(false);
      return;
    }

    try {
      if (editingId) {
        await api.put(`/passengers/saved/${editingId}`, payload);
        setMessage('Saved passenger updated.');
      } else {
        await api.post('/passengers/saved', payload);
        setMessage('Passenger saved for future bookings.');
      }
      resetForm();
      await loadPassengers();
    } catch (err) {
      setError(err.message || 'Could not save passenger');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Remove this saved passenger?')) return;
    setError('');
    try {
      await api.del(`/passengers/saved/${id}`);
      if (editingId === id) resetForm();
      setMessage('Saved passenger removed.');
      await loadPassengers();
    } catch (err) {
      setError(err.message || 'Could not remove passenger');
    }
  };

  return (
    <section className={`profile-card card saved-passengers-panel ${compact ? 'is-compact' : ''}`}>
      <div className="profile-card-head">
        <UserPlus size={20} aria-hidden="true" />
        <div>
          <h2>Saved passengers</h2>
          <p>Store frequent travellers and reuse them when booking tickets.</p>
        </div>
      </div>

      {loading ? (
        <div className="page-loading-inline"><div className="spinner" aria-label="Loading saved passengers" /></div>
      ) : (
        <>
          {passengers.length > 0 && (
            <ul className="saved-passenger-list">
              {passengers.map((passenger) => (
                <li key={passenger.id} className="saved-passenger-item">
                  <div>
                    <strong>{passenger.name}</strong>
                    <span className="muted">
                      {passenger.age} yrs · {passenger.gender}
                      {passenger.berthPreference ? ` · ${passenger.berthPreference}` : ''}
                    </span>
                  </div>
                  <div className="saved-passenger-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(passenger)}>
                      <Pencil size={14} aria-hidden="true" /> Edit
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(passenger.id)}>
                      <Trash2 size={14} aria-hidden="true" /> Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form className="saved-passenger-form" onSubmit={submit}>
            <h3>{editingId ? 'Edit saved passenger' : 'Add saved passenger'}</h3>
            <div className="profile-form-grid">
              <div className="field profile-field-full">
                <label htmlFor="saved-passenger-name">Full name</label>
                <input
                  id="saved-passenger-name"
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="saved-passenger-age">Age</label>
                <input
                  id="saved-passenger-age"
                  className="input"
                  type="number"
                  min="1"
                  max="120"
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="saved-passenger-gender">Gender</label>
                <select
                  id="saved-passenger-gender"
                  className="input"
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                >
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="field profile-field-full">
                <label htmlFor="saved-passenger-berth">Berth preference</label>
                <select
                  id="saved-passenger-berth"
                  className="input"
                  value={form.berthPreference}
                  onChange={(e) => setForm({ ...form, berthPreference: e.target.value })}
                >
                  {BERTH_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {message && <div className="alert alert-success">{message}</div>}

            <div className="saved-passenger-form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {editingId ? <Save size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                {saving ? 'Saving…' : editingId ? 'Update passenger' : 'Save passenger'}
              </button>
              {editingId && (
                <button type="button" className="btn btn-ghost" onClick={resetForm}>
                  <X size={16} aria-hidden="true" /> Cancel edit
                </button>
              )}
            </div>
          </form>
        </>
      )}
    </section>
  );
}

export function SavedPassengerPicker({ onSelect }) {
  const [passengers, setPassengers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/passengers/saved')
      .then((rows) => setPassengers(Array.isArray(rows) ? rows : []))
      .catch(() => setPassengers([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !passengers.length) return null;

  return (
    <div className="saved-passenger-picker">
      <label htmlFor="saved-passenger-select">Add from saved passengers</label>
      <select
        id="saved-passenger-select"
        className="input"
        defaultValue=""
        onChange={(e) => {
          const selected = passengers.find((p) => String(p.id) === e.target.value);
          if (selected) onSelect(selected);
          e.target.value = '';
        }}
      >
        <option value="">Choose a saved passenger…</option>
        {passengers.map((passenger) => (
          <option key={passenger.id} value={passenger.id}>
            {passenger.name} ({passenger.age}, {passenger.gender})
          </option>
        ))}
      </select>
    </div>
  );
}
