import Modal from '../Modal';
import { TrainFront } from 'lucide-react';

export default function TrainRouteModal({ data, onClose, highlightFrom, highlightTo }) {
  const open = !!data;
  const isError = data?.error;

  return (
    <Modal open={open} onClose={onClose} title="Train Route" size="lg">
      {isError ? (
        <p className="muted">{data.error}</p>
      ) : data ? (
        <>
          <div className="route-modal-header">
            <span className="route-modal-num">{data.trainNumber}</span>
            <h3 className="route-modal-name">{data.trainName}</h3>
          </div>
          <div className="route-timeline">
            {(data.stops || []).map((stop, idx) => {
              const isOrigin = stop.isSource || stop.stationCode === highlightFrom;
              const isDest = stop.isDestination || stop.stationCode === highlightTo;
              const isLast = idx === (data.stops?.length || 0) - 1;

              return (
                <div
                  key={stop.sequence}
                  className={`route-stop ${isOrigin ? 'highlight-origin' : ''} ${isDest ? 'highlight-dest' : ''}`}
                >
                  <div className="route-stop-marker">
                    <span className="route-dot" />
                    {!isLast && <span className="route-connector" />}
                  </div>
                  <div className="route-stop-body">
                    <div className="route-stop-title">
                      <strong>{stop.stationCode}</strong>
                      <span>{stop.stationName}</span>
                      {isOrigin && <span className="route-tag">Boarding</span>}
                      {isDest && <span className="route-tag">Destination</span>}
                    </div>
                    <div className="route-stop-meta">
                      {stop.arrival && (
                        <span>Arrival: {stop.arrival}</span>
                      )}
                      {stop.departure && (
                        <span>Departure: {stop.departure}</span>
                      )}
                      {stop.haltMinutes != null && stop.haltMinutes > 0 && (
                        <span>Halt: {stop.haltMinutes}m</span>
                      )}
                      {stop.distanceKm != null && (
                        <span>{stop.distanceKm} km</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {!data.stops?.length && (
            <div className="state-panel empty-state-panel" style={{ padding: '24px 0' }}>
              <TrainFront size={32} className="muted" />
              <p className="muted">Route details are not available for this train.</p>
            </div>
          )}
        </>
      ) : null}
    </Modal>
  );
}
