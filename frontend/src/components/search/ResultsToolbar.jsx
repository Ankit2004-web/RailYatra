import { ChevronDown } from 'lucide-react';
import { SORT_OPTIONS } from '../../utils/trainFilters';

export default function ResultsToolbar({ sortBy, onSortChange }) {
  return (
    <div className="results-toolbar">
      <label className="sort-control" htmlFor="sort-by">
        <span>Sort by:</span>
        <div className="sort-select-wrap">
          <select
            id="sort-by"
            className="input sort-select"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown size={16} className="sort-chevron" aria-hidden="true" />
        </div>
      </label>
    </div>
  );
}
