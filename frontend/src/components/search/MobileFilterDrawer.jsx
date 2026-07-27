import { X, SlidersHorizontal } from 'lucide-react';
import SearchFilters from '../SearchFilters';

export default function MobileFilterDrawer({
  open,
  onClose,
  filters,
  onChange,
  onApply,
  onClear,
  classOptions,
  classPrices,
  trainTypes,
  durationCounts
}) {
  if (!open) return null;

  return (
    <div className="filter-drawer-overlay" onClick={onClose} role="presentation">
      <div
        className="filter-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
      >
        <div className="filter-drawer-head">
          <h3><SlidersHorizontal size={18} /> Filters</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close filters">
            <X size={20} />
          </button>
        </div>
        <div className="filter-drawer-body">
          <SearchFilters
            filters={filters}
            onChange={onChange}
            onApply={() => { onApply(); onClose(); }}
            onClear={onClear}
            classOptions={classOptions}
            classPrices={classPrices}
            trainTypes={trainTypes}
            durationCounts={durationCounts}
            embedded
          />
        </div>
      </div>
    </div>
  );
}
