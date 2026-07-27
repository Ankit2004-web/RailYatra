import { Filter } from 'lucide-react';
import {
  DEPARTURE_BUCKETS,
  ARRIVAL_BUCKETS,
  DURATION_BUCKETS
} from '../utils/trainFilters';

export default function SearchFilters({
  filters,
  onChange,
  onApply,
  onClear,
  classOptions = [],
  classPrices = {},
  trainTypes = [],
  durationCounts = {},
  embedded = false
}) {
  const set = (key, value) => onChange({ ...filters, [key]: value });

  const toggleInArray = (key, id) => {
    const arr = filters[key];
    const next = arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
    set(key, next);
  };

  const toggleClass = (code) => {
    if (!code) {
      set('classes', []);
      return;
    }
    const next = filters.classes.includes(code)
      ? filters.classes.filter((c) => c !== code)
      : [...filters.classes, code];
    set('classes', next);
  };

  const Wrapper = embedded ? 'div' : 'aside';
  const wrapperClass = embedded ? 'filters-embedded' : 'filters-sidebar card';

  return (
    <Wrapper className={wrapperClass}>
      {!embedded && (
        <div className="filters-head">
          <h3><Filter size={16} aria-hidden="true" /> Filters</h3>
          <button type="button" className="link-btn" onClick={onClear}>Clear all</button>
        </div>
      )}

      <div className="filter-group">
        <h4>Class</h4>
        <label className="filter-check">
          <input
            type="checkbox"
            checked={filters.classes.length === 0}
            onChange={() => set('classes', [])}
          />
          <span>All Classes</span>
        </label>
        {classOptions.map((opt) => (
          <label key={opt.code} className="filter-check">
            <input
              type="checkbox"
              checked={filters.classes.includes(opt.code)}
              onChange={() => toggleClass(opt.code)}
            />
            <span>{opt.label}</span>
            {classPrices[opt.code] != null && (
              <span className="filter-price">₹{Number(classPrices[opt.code]).toLocaleString('en-IN')}</span>
            )}
          </label>
        ))}
      </div>

      <div className="filter-group">
        <h4>Departure Time</h4>
        {DEPARTURE_BUCKETS.map((bucket) => (
          <label key={bucket.id} className="filter-check">
            <input
              type="checkbox"
              checked={filters.departureBuckets.includes(bucket.id)}
              onChange={() => toggleInArray('departureBuckets', bucket.id)}
            />
            <span>{bucket.label}</span>
          </label>
        ))}
      </div>

      <div className="filter-group">
        <h4>Journey Duration</h4>
        {DURATION_BUCKETS.map((bucket) => (
          <label key={bucket.id} className="filter-check">
            <input
              type="checkbox"
              checked={filters.durations.includes(bucket.id)}
              onChange={() => toggleInArray('durations', bucket.id)}
            />
            <span>{bucket.label}</span>
            {durationCounts[bucket.id] != null && (
              <span className="filter-count">{durationCounts[bucket.id]}</span>
            )}
          </label>
        ))}
      </div>

      <div className="filter-group">
        <h4>Arrival Time</h4>
        {ARRIVAL_BUCKETS.map((bucket) => (
          <label key={bucket.id} className="filter-check">
            <input
              type="checkbox"
              checked={filters.arrivalBuckets.includes(bucket.id)}
              onChange={() => toggleInArray('arrivalBuckets', bucket.id)}
            />
            <span>{bucket.label}</span>
          </label>
        ))}
      </div>

      {trainTypes.length > 0 && (
        <div className="filter-group">
          <h4>Train Type</h4>
          {trainTypes.map((type) => (
            <label key={type} className="filter-check">
              <input
                type="checkbox"
                checked={filters.trainTypes.includes(type)}
                onChange={() => toggleInArray('trainTypes', type)}
              />
              <span>{type}</span>
            </label>
          ))}
        </div>
      )}

      <button type="button" className="btn btn-primary btn-block btn-apply-filters" onClick={onApply}>
        <Filter size={16} aria-hidden="true" /> Apply Filters
      </button>
    </Wrapper>
  );
}

export { defaultFilters, applyTrainFilters } from '../utils/trainFilters';
