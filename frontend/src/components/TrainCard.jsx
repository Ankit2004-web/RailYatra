import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrainFront, ChevronRight, Heart, MapPin, Gauge, Radio, AlertTriangle
} from 'lucide-react';
import { mapTrainApiResponseToViewModel, runningDayCircles } from '../utils/trainMapper';
import { formatIrctcAvailability, irctcAvailabilityClass } from '../utils/irctcAvailability';

const CLASS_COLORS = {
  '2A': 'class-tone-2a',
  '3A': 'class-tone-3a',
  SL: 'class-tone-sl',
  CC: 'class-tone-cc',
  '1A': 'class-tone-1a',
  EC: 'class-tone-ec',
  '3E': 'class-tone-3e',
  '2S': 'class-tone-2s'
};

const FAV_KEY = 'railyatra_favourites';

function loadFavourites() {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function saveFavourites(set) {
  localStorage.setItem(FAV_KEY, JSON.stringify([...set]));
}

function formatAvailability(seats) {
  return formatIrctcAvailability(seats);
}

export default function TrainCard({
  train: rawTrain,
  journeyDate,
  searchContext,
  onBook,
  onRoute,
  onChart,
  selectedClass,
  onClassSelect,
  scheduleUpdate
}) {
  const vm = mapTrainApiResponseToViewModel(rawTrain, journeyDate, searchContext);
  const dayCircles = runningDayCircles(rawTrain);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    setLiked(loadFavourites().has(String(vm.id)));
  }, [vm.id]);

  const toggleFav = () => {
    const favs = loadFavourites();
    const key = String(vm.id);
    if (favs.has(key)) favs.delete(key);
    else favs.add(key);
    saveFavourites(favs);
    setLiked(favs.has(key));
  };

  const handleBook = () => {
    onBook(rawTrain, selectedClass || vm.classes[0]?.classCode);
  };

  return (
    <article className="train-card-premium card">
      <div className="train-card-head">
        <div className="train-head-main">
          <span className="train-num">{vm.trainNumber}</span>
          <div className="train-title-row">
            <h3 className="train-name" title={vm.trainName}>{vm.trainName}</h3>
            {vm.trainTypeCode && (
              <span className="badge-type">{vm.trainTypeCode}</span>
            )}
            {scheduleUpdate?.delayMinutes > 0 && (
              <span className="badge-delay" role="status">
                <AlertTriangle size={12} aria-hidden="true" />
                {scheduleUpdate.delayMinutes}m late
              </span>
            )}
            {scheduleUpdate?.cancelled && (
              <span className="badge-cancel" role="status">Cancelled</span>
            )}
          </div>
        </div>
        <button
          type="button"
          className={`heart-btn ${liked ? 'liked' : ''}`}
          onClick={toggleFav}
          aria-label={liked ? 'Remove from favourites' : 'Add to favourites'}
          aria-pressed={liked}
        >
          <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="train-card-body">
        <div className="train-journey">
          <div className="journey-point departure">
            <span className="j-point-label">Boarding</span>
            <span className="j-time">{vm.from.time || '—'}</span>
            <span className="j-station">{vm.from.code || vm.from.name || '—'}</span>
            <span className="j-location">{vm.from.name}</span>
            {vm.from.dateLabel && <span className="j-date-badge">{vm.from.dateLabel}</span>}
          </div>

          <div className="journey-track">
            <span className="j-duration">{vm.duration || '—'}</span>
            <div className="j-track-line" aria-hidden="true">
              <span className="j-dot" />
              <span className="j-line" />
              <TrainFront size={16} className="j-train-icon" />
              <span className="j-line" />
              <span className="j-dot" />
            </div>
          </div>

          <div className="journey-point arrival">
            <span className="j-point-label">Drop</span>
            <span className="j-time">{vm.to.time || '—'}</span>
            <span className="j-station">{vm.to.code || vm.to.name || '—'}</span>
            <span className="j-location">{vm.to.name}</span>
            {vm.to.dateLabel && <span className="j-date-badge">{vm.to.dateLabel}</span>}
          </div>
        </div>

        <div className="train-meta-panel">
          <div className="side-route">
            <MapPin size={14} aria-hidden="true" />
            <span>{vm.from.code || vm.from.name} → {vm.to.code || vm.to.name}</span>
          </div>
          {vm.avgSpeedKmh != null && (
            <div className="side-speed">
              <Gauge size={14} aria-hidden="true" />
              <span>Avg. Speed <strong>{vm.avgSpeedKmh} km/h</strong></span>
            </div>
          )}
          <div className="side-runs">
            <span className="runs-label">Runs On</span>
            <div className="runs-days" role="list" aria-label="Operating days">
              {dayCircles.map((d, i) => (
                <span
                  key={i}
                  role="listitem"
                  className={`run-day ${d.active ? 'active' : ''} ${d.unknown ? 'unknown' : 'inactive'}`}
                  title={
                    d.unknown
                      ? `${d.fullName} — schedule not available`
                      : d.active
                        ? `${d.fullName} — train runs`
                        : `${d.fullName} — does not run`
                  }
                  aria-label={
                    d.unknown
                      ? `${d.fullName}, schedule unknown`
                      : d.active
                        ? `${d.fullName}, runs`
                        : `${d.fullName}, does not run`
                  }
                >
                  {d.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="train-class-row">
          {vm.classes.length === 0 ? (
            <p className="muted class-unavailable">Class availability unavailable</p>
          ) : (
            vm.classes.slice(0, 6).map((c) => {
              const isSelected = selectedClass === c.classCode;
              const avl = formatAvailability(c.availableSeats);
              return (
                <button
                  key={c.classCode}
                  type="button"
                  className={`class-option ${CLASS_COLORS[c.classCode] || ''} ${isSelected ? 'selected' : ''}`}
                  onClick={() => onClassSelect?.(vm.id, c.classCode)}
                  aria-pressed={isSelected}
                >
                  <span className="co-class">{c.classCode}</span>
                  <span className="co-price">
                    {c.price != null ? `₹${c.price.toLocaleString('en-IN')}` : 'Fare unavailable'}
                  </span>
                  <span className={`co-avl ${irctcAvailabilityClass(avl.tone)}`}>{avl.text}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="train-card-foot">
        <button type="button" className="btn btn-outline" onClick={() => onRoute(vm.id)}>
          <TrainFront size={16} aria-hidden="true" /> Route
        </button>
        <Link
          to={`/live-trains?train=${vm.trainNumber}&date=${journeyDate}`}
          className="btn btn-outline btn-track-live"
        >
          <Radio size={16} aria-hidden="true" /> Track
        </Link>
        {onChart && (
          <button type="button" className="btn btn-outline" onClick={() => onChart(rawTrain, selectedClass || vm.classes[0]?.classCode)}>
            Chart / Vacancy
          </button>
        )}
        <button type="button" className="btn btn-primary btn-book-now" onClick={handleBook}>
          Book Now <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

export function TrainCardSkeleton() {
  return (
    <div className="train-card-premium card skeleton-card" aria-hidden="true">
      <div className="sk-head">
        <div className="sk-line sk-num" />
        <div className="sk-line sk-title" />
      </div>
      <div className="sk-journey">
        <div className="sk-col">
          <div className="sk-line sk-time" />
          <div className="sk-line sk-station" />
        </div>
        <div className="sk-track" />
        <div className="sk-col">
          <div className="sk-line sk-time" />
          <div className="sk-line sk-station" />
        </div>
      </div>
      <div className="sk-classes">
        <div className="sk-class" />
        <div className="sk-class" />
        <div className="sk-class" />
      </div>
      <div className="sk-foot">
        <div className="sk-btn" />
        <div className="sk-btn sk-btn-primary" />
      </div>
    </div>
  );
}
