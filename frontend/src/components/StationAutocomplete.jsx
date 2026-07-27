import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

export default function StationAutocomplete({ id, label, value, onChange, placeholder, required, icon: Icon }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = async (q) => {
    onChange(q);
    if (q.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    try {
      const results = await api.get(`/stations/search?q=${encodeURIComponent(q)}&limit=8`);
      setSuggestions(results);
      setOpen(true);
    } catch {
      setSuggestions([]);
    }
  };

  const pick = (station) => {
    onChange(station.code || station.name);
    setOpen(false);
  };

  return (
    <div className="field autocomplete" ref={wrapRef}>
      <label htmlFor={id}>{label}</label>
      <div className={Icon ? 'input-with-icon' : undefined}>
        {Icon && <Icon size={16} className="input-icon" aria-hidden="true" />}
        <input
          id={id}
          className="input"
          value={value}
          onChange={(e) => search(e.target.value)}
          onFocus={() => suggestions.length && setOpen(true)}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
        />
      </div>
      {open && suggestions.length > 0 && (
        <ul className="autocomplete-list">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => pick(s)}>
                <strong>{s.code}</strong> — {s.name}
                {s.city ? <span className="muted"> · {s.city}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
