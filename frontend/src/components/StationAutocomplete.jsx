import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

export default function StationAutocomplete({
  id,
  label,
  value,
  onChange,
  placeholder,
  required,
  icon: Icon
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef(null);
  const listId = `${id}-listbox`;

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = async (q) => {
    onChange(q);
    setActiveIndex(-1);
    if (q.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    try {
      const results = await api.get(`/stations/search?q=${encodeURIComponent(q)}&limit=15`);
      setSuggestions(results);
      setOpen(true);
    } catch {
      setSuggestions([]);
    }
  };

  const pick = (station) => {
    onChange(station.code || station.name);
    setOpen(false);
    setActiveIndex(-1);
  };

  const onKeyDown = (e) => {
    if (!open || !suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((idx) => Math.min(idx + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((idx) => Math.max(idx - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      pick(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
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
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
        />
      </div>
      {open && suggestions.length > 0 && (
        <ul className="autocomplete-list" id={listId} role="listbox" aria-label={`${label} suggestions`}>
          {suggestions.map((s, index) => (
            <li key={s.id} id={`${id}-option-${index}`} role="option" aria-selected={index === activeIndex}>
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
