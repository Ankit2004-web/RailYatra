import { useEffect, useMemo, useState } from 'react';
import Modal from '../Modal';
import { api } from '../../api/client';
import { formatIrctcAvailability, irctcAvailabilityClass } from '../../utils/irctcAvailability';
import CoachBerthLayout from './CoachBerthLayout';

const CLASS_COLORS = {
  '1A': '#7c3aed',
  '2A': '#2563eb',
  '3A': '#0891b2',
  '3E': '#0d9488',
  SL: '#0AA6A6',
  '2S': '#65a30d',
  CC: '#dc2626',
  EC: '#ea580c',
  EA: '#c026d3'
};

function coachVacantCount(coach) {
  const seats = coach.seats || [];
  if (seats.length) {
    return seats.filter((s) => !s.status || s.status === 'Available').length;
  }
  return coach.seatingCapacity || coach.sleepingBerths || coach.seatCount || 0;
}

function buildLayoutFromClasses(classes = []) {
  const coaches = [];
  for (const cls of classes) {
    for (const coach of cls.coaches || []) {
      coaches.push({
        coachNumber: coach.coachNumber,
        coachType: coach.coachType,
        classCode: cls.classCode,
        coachModel: coach.coachModel,
        seatingCapacity: coach.seatingCapacity,
        sleepingBerths: coach.sleepingBerths,
        seatCount: coach.seatCount || coach.seatingCapacity || coach.sleepingBerths || 0,
        seats: coach.seats || []
      });
    }
  }
  return coaches.length ? { coaches } : null;
}

export default function CoachChartModal({
  open,
  onClose,
  trainNumber,
  trainName,
  journeyDate,
  boardingStation,
  classes = [],
  initialClassCode = ''
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [layout, setLayout] = useState(null);
  const [classCode, setClassCode] = useState(initialClassCode || classes[0]?.classCode || '');
  const [selectedCoach, setSelectedCoach] = useState(null);

  useEffect(() => {
    if (!open || !trainNumber) return;
    setLoading(true);
    setError('');
    setSelectedCoach(null);
    setLayout(null);
    api.get(`/train/${trainNumber}/layout`)
      .then((data) => {
        if (data?.coaches?.length) {
          setLayout(data);
        } else {
          const fallback = buildLayoutFromClasses(classes);
          if (fallback) setLayout(fallback);
          else setError('Coach chart is not available for this train.');
        }
      })
      .catch(() => {
        const fallback = buildLayoutFromClasses(classes);
        if (fallback) setLayout(fallback);
        else setError('Could not load coach chart for this train.');
      })
      .finally(() => setLoading(false));
  }, [open, trainNumber, classes]);

  useEffect(() => {
    if (initialClassCode) setClassCode(initialClassCode);
  }, [initialClassCode, open]);

  const coaches = layout?.coaches || [];
  const passengerCoaches = useMemo(
    () => coaches.filter((c) => c.classCode),
    [coaches]
  );

  const classCodes = useMemo(() => {
    const fromLayout = [...new Set(passengerCoaches.map((c) => c.classCode))];
    if (fromLayout.length) return fromLayout;
    return classes.map((c) => c.classCode);
  }, [passengerCoaches, classes]);

  const classCoaches = useMemo(
    () => passengerCoaches.filter((c) => c.classCode === classCode),
    [passengerCoaches, classCode]
  );

  const classSummary = useMemo(() => classCodes.map((code) => {
    const clsCoaches = passengerCoaches.filter((c) => c.classCode === code);
    const vacant = clsCoaches.reduce((sum, c) => sum + coachVacantCount(c), 0);
    const meta = classes.find((c) => c.classCode === code);
    const avl = formatIrctcAvailability(meta?.availableSeats ?? vacant);
    return { code, coachCount: clsCoaches.length, vacant, avl };
  }), [classCodes, passengerCoaches, classes]);

  const activeCoach = selectedCoach
    ? classCoaches.find((c) => c.coachNumber === selectedCoach) || passengerCoaches.find((c) => c.coachNumber === selectedCoach)
    : null;

  return (
    <Modal open={open} onClose={onClose} title="Charts / Vacancy" size="lg">
      <div className="irctc-chart-modal">
        <div className="irctc-chart-head">
          <div>
            <div className="irctc-chart-train">
              <strong>{trainNumber}</strong>
              <span>{trainName}</span>
            </div>
            <div className="irctc-chart-meta">
              <span>Journey date: <strong>{journeyDate || '—'}</strong></span>
              <span>Boarding: <strong>{boardingStation || '—'}</strong></span>
              <span className="irctc-chart-tag">First Chart (simulated)</span>
            </div>
          </div>
        </div>

        {loading && <div className="page-loading compact"><div className="spinner" aria-label="Loading chart" /></div>}
        {error && <p className="form-error">{error}</p>}

        {!loading && !error && layout && (
          <>
            <div className="irctc-class-summary">
              <table className="irctc-table">
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Coaches</th>
                    <th>Vacant berths</th>
                    <th>Availability</th>
                  </tr>
                </thead>
                <tbody>
                  {classSummary.map((row) => (
                    <tr
                      key={row.code}
                      className={classCode === row.code ? 'active' : ''}
                      onClick={() => { setClassCode(row.code); setSelectedCoach(null); }}
                    >
                      <td><strong>{row.code}</strong></td>
                      <td>{row.coachCount}</td>
                      <td>{row.vacant}</td>
                      <td><span className={irctcAvailabilityClass(row.avl.tone)}>{row.avl.text}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {classCodes.length > 0 && (
              <div className="irctc-class-tabs" role="tablist" aria-label="Travel class">
                {classCodes.map((code) => (
                  <button
                    key={code}
                    type="button"
                    role="tab"
                    aria-selected={classCode === code}
                    className={`irctc-class-tab ${classCode === code ? 'active' : ''}`}
                    onClick={() => { setClassCode(code); setSelectedCoach(null); }}
                  >
                    {code}
                  </button>
                ))}
              </div>
            )}

            <div className="irctc-rake-wrap">
              <div className="irctc-rake-label">Coach composition (loco → tail)</div>
              <div className="irctc-rake" role="list" aria-label="Train rake">
                {passengerCoaches.map((coach) => {
                  const color = CLASS_COLORS[coach.classCode] || '#64748b';
                  const vacant = coachVacantCount(coach);
                  const active = selectedCoach === coach.coachNumber;
                  return (
                    <button
                      key={coach.coachNumber}
                      type="button"
                      role="listitem"
                      className={`irctc-rake-coach ${active ? 'active' : ''}`}
                      style={{ '--coach-color': color }}
                      onClick={() => setSelectedCoach(coach.coachNumber)}
                      title={`${coach.coachNumber} · ${coach.classCode} · ${vacant} vacant`}
                    >
                      <span className="rake-code">{coach.coachNumber}</span>
                      <span className="rake-class">{coach.classCode}</span>
                      <span className="rake-vac">{vacant}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="irctc-coach-table-wrap">
              <table className="irctc-table irctc-coach-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Coach</th>
                    <th>Class</th>
                    <th>Vacant berths</th>
                  </tr>
                </thead>
                <tbody>
                  {classCoaches.map((coach, idx) => (
                    <tr
                      key={coach.coachNumber}
                      className={selectedCoach === coach.coachNumber ? 'active' : ''}
                      onClick={() => setSelectedCoach(coach.coachNumber)}
                    >
                      <td>{idx + 1}</td>
                      <td><strong>{coach.coachNumber}</strong></td>
                      <td>{coach.classCode}</td>
                      <td>{coachVacantCount(coach)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {activeCoach && (
              <CoachBerthLayout coach={activeCoach} classCode={activeCoach.classCode || classCode} />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
