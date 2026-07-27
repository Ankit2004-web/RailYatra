import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className={`modal-panel modal-${size}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
