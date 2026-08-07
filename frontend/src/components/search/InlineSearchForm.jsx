import { useState } from 'react';
import { Search } from 'lucide-react';
import StationAutocomplete from '../StationAutocomplete';
import { CLASS_OPTIONS } from '../../constants/search';
import { getMaxBookingDate, getTodayIso } from '../../utils/bookingPolicy';

export default function InlineSearchForm({ initial, onSearch, onCancel }) {
  const [source, setSource] = useState(initial.source || '');
  const [destination, setDestination] = useState(initial.destination || '');
  const [date, setDate] = useState(initial.date || getTodayIso());
  const [classCode, setClassCode] = useState(initial.classCode || '');
  const [routeAware, setRouteAware] = useState(initial.routeAware !== false);
  const [flexDays, setFlexDays] = useState(initial.flexDays || '');

  const submit = (e) => {
    e.preventDefault();
    if (!source || !destination || !date) return;
    onSearch({ source, destination, date, classCode, routeAware, flexDays });
  };

  return (
    <form className="inline-search-form" onSubmit={submit} aria-label="Modify train search">
      <div className="inline-search-form-head">
        <div>
          <strong>Edit journey</strong>
          <p className="muted">Update route, date, or class and refresh results instantly.</p>
        </div>
        {onCancel && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>

      <div className="inline-search-grid">
        <StationAutocomplete
          id="inline-source"
          label="From"
          value={source}
          onChange={setSource}
          placeholder="Source station"
          required
        />
        <StationAutocomplete
          id="inline-destination"
          label="To"
          value={destination}
          onChange={setDestination}
          placeholder="Destination station"
          required
        />
        <div className="field">
          <label htmlFor="inline-date">Journey date</label>
          <input
            id="inline-date"
            type="date"
            className="input"
            value={date}
            min={getTodayIso()}
            max={getMaxBookingDate()}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="inline-class">Class</label>
          <select id="inline-class" className="input" value={classCode} onChange={(e) => setClassCode(e.target.value)}>
            {CLASS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="inline-flex">Date flexibility</label>
          <select id="inline-flex" className="input" value={flexDays} onChange={(e) => setFlexDays(e.target.value)}>
            <option value="">Exact date only</option>
            <option value="1">± 1 day</option>
            <option value="2">± 2 days</option>
            <option value="3">± 3 days</option>
          </select>
        </div>
      </div>

      <div className="inline-search-options">
        <label className="inline-search-route-aware" htmlFor="inline-route-aware">
          <input
            id="inline-route-aware"
            type="checkbox"
            checked={routeAware}
            onChange={(e) => setRouteAware(e.target.checked)}
          />
          Route-aware search (direct trains via stop graph)
        </label>
        <button type="submit" className="btn btn-primary">
          <Search size={16} aria-hidden="true" /> Search trains
        </button>
      </div>
    </form>
  );
}
