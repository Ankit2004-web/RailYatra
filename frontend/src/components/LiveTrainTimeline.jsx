import { useEffect, useRef } from 'react';
import { Clock, MapPin, TrainFront, AlertCircle } from 'lucide-react';

function formatUpdatedAt(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
}

function trackDotClass(color, phase) {
  if (phase === 'current') return 'is-current';
  if (phase === 'passed') return 'is-passed';
  if (/green/i.test(color)) return 'is-passed';
  if (/orange/i.test(color)) return 'is-current';
  if (/red/i.test(color)) return 'is-destination';
  return 'is-upcoming';
}

function DelayBadge({ label, onTime }) {
  if (!label) return null;
  const late = !onTime && label !== 'On Time';
  return (
    <span className={`live-timeline-delay ${late ? 'is-late' : 'is-ontime'}`}>
      {label}
    </span>
  );
}

function TimeCell({ stop, side }) {
  const data = side === 'arrival' ? stop.arrival : stop.departure;
  if (!data) {
    return <div className="live-timeline-time muted">—</div>;
  }

  return (
    <div className="live-timeline-time">
      {data.scheduled && (
        <div className="live-timeline-time-scheduled">{data.scheduled}</div>
      )}
      {data.actual && data.actual !== data.scheduled && (
        <div className="live-timeline-time-actual">{data.actual}</div>
      )}
      {data.actual && data.actual === data.scheduled && !data.delayLabel && (
        <div className="live-timeline-time-actual">{data.actual}</div>
      )}
      <DelayBadge label={data.delayLabel} onTime={data.onTime} />
    </div>
  );
}

export default function LiveTrainTimeline({ train, lastFetched, onRefresh, loading, scrollToCurrentKey }) {
  const stops = train.routeTimeline?.stops?.length
    ? train.routeTimeline.stops
    : train.routeStops || [];

  const scrollRef = useRef(null);
  const currentStopRef = useRef(null);

  const providerLabel = train.provider === 'railyatra+ntes'
    ? 'RailYatra stations + NTES delays'
    : train.provider === 'ntes'
      ? 'Indian Railways NTES'
      : 'RailYatra stations & schedule';

  const currentStop = stops.find((s) => s.isCurrent || s.phase === 'current');

  useEffect(() => {
    if (!scrollToCurrentKey || !scrollRef.current) return;
    const timer = window.setTimeout(() => {
      const container = scrollRef.current;
      const target = currentStopRef.current
        || container?.querySelector('.live-timeline-stop.is-active');
      if (!container || !target) return;
      const top = target.offsetTop - container.offsetTop
        - (container.clientHeight / 2) + (target.clientHeight / 2);
      container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [scrollToCurrentKey, train.trainNumber, train.lastUpdated, stops.length]);

  return (
    <div className="live-timeline-shell">
      <div className="live-timeline-fixed">
        <div className="live-timeline-meta-bar">
          <span>Source: <strong>{providerLabel}</strong></span>
          <span>Updated: {formatUpdatedAt(train.lastUpdated || lastFetched?.toISOString())}</span>
          {onRefresh && (
            <button type="button" className="btn btn-outline btn-sm" onClick={onRefresh} disabled={loading}>
              Refresh
            </button>
          )}
        </div>

        <article className="card live-timeline-card">
          <header className="live-timeline-header">
            <div className="live-timeline-title-row">
              <TrainFront size={20} aria-hidden="true" />
              <strong className="live-timeline-number">{train.trainNumber}</strong>
              <span className={`status status-${String(train.status || 'scheduled').toLowerCase()}`}>
                {train.status}
              </span>
              {train.delayMinutes > 0 && (
                <span className="live-timeline-delay is-late">{train.delayMinutes} min late</span>
              )}
            </div>
            <h2 className="live-timeline-name">{train.trainName}</h2>
            {(train.source || train.destination) && (
              <p className="live-timeline-route">
                <MapPin size={14} aria-hidden="true" />
                {train.source} → {train.destination}
              </p>
            )}
            {train.stopCount > 0 && (
              <p className="live-timeline-route live-timeline-stop-count">
                {train.stopCount} verified RailYatra station{train.stopCount === 1 ? '' : 's'} on this route
              </p>
            )}
          </header>

          {train.notice && (
            <div className="alert alert-info live-timeline-notice" role="status">
              <AlertCircle size={16} aria-hidden="true" />
              {train.notice}
            </div>
          )}

          {(train.statusBanner || train.upcomingStation || currentStop) && (
            <div className="live-timeline-status-banners">
              {currentStop && (
                <div className="live-timeline-status-banner is-current live-timeline-now-banner">
                  <MapPin size={16} aria-hidden="true" />
                  <span>
                    <strong>Current station:</strong>{' '}
                    {currentStop.stationName}
                    {currentStop.stationCode ? ` (${currentStop.stationCode})` : ''}
                  </span>
                </div>
              )}
              {train.statusBanner && (
                <div className="live-timeline-status-banner is-current">
                  <Clock size={16} aria-hidden="true" />
                  {train.statusBanner}
                </div>
              )}
              {train.upcomingStation && (
                <div className="live-timeline-status-banner is-upcoming">
                  Upcoming: <strong>{train.upcomingStation}</strong>
                </div>
              )}
            </div>
          )}
        </article>
      </div>

      {stops.length > 0 ? (
        <div className="live-timeline-scroll card" ref={scrollRef} aria-label="Station-wise route timeline">
          <div className="live-timeline-table-wrap">
            <div className="live-timeline-columns-head">
              <span>Arrival</span>
              <span>Station</span>
              <span>Departure</span>
            </div>
            <ol className="live-timeline-stops">
              {stops.map((stop) => {
                const isCurrent = stop.isCurrent || stop.phase === 'current';
                return (
                  <li
                    key={`${stop.order}-${stop.stationCode || stop.stationName}`}
                    ref={isCurrent ? currentStopRef : null}
                    className={`live-timeline-stop is-${stop.phase || 'upcoming'} ${isCurrent ? 'is-active' : ''}`}
                  >
                    <TimeCell stop={stop} side="arrival" />
                    <div className="live-timeline-track">
                      <span
                        className={`live-timeline-dot ${trackDotClass(stop.trackColor, stop.phase)}`}
                        aria-hidden="true"
                      />
                      <div className="live-timeline-station">
                        <strong>{stop.stationName}</strong>
                        {isCurrent && <span className="live-timeline-here-badge">You are here</span>}
                        <div className="live-timeline-station-meta">
                          {stop.stationCode && (
                            <span className="live-timeline-code">{stop.stationCode}</span>
                          )}
                          {stop.platform && (
                            <span className="live-timeline-platform">PF {stop.platform}</span>
                          )}
                          {stop.distanceKm != null && (
                            <span className="live-timeline-distance">{stop.distanceKm} km</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <TimeCell stop={stop} side="departure" />
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      ) : (
        <div className="card live-timeline-scroll live-timeline-fallback">
          <ul className="live-train-meta">
            <li><MapPin size={14} aria-hidden="true" /> Current: {train.currentLocation}</li>
            <li><MapPin size={14} aria-hidden="true" /> Next: {train.nextStation}</li>
            <li><Clock size={14} aria-hidden="true" /> Delay: {train.delayMinutes} min</li>
          </ul>
        </div>
      )}
    </div>
  );
}
