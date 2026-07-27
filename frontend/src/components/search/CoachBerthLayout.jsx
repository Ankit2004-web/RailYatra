const CHAIR_CLASSES = new Set(['CC', 'EC', 'EA', '2S', 'GS', 'UR']);

function BerthCell({ seat }) {
  const vacant = !seat.status || seat.status === 'Available';
  const partial = seat.status === 'Partial';
  const tone = vacant ? 'vacant' : partial ? 'partial' : 'occupied';

  return (
    <div
      className={`irctc-berth irctc-berth-${tone}`}
      title={`${seat.displayLabel || seat.seatNumber} · ${seat.berthType}${vacant ? ' · Vacant' : ''}`}
    >
      <span className="irctc-berth-no">{seat.seatNumber}</span>
      <span className="irctc-berth-type">{seat.berthType === 'SEAT' ? 'S' : seat.berthType}</span>
    </div>
  );
}

function layoutSleeperBay(seats8) {
  const groups = { SL: [], SU: [], LB: [], MB: [], UB: [] };
  seats8.forEach((s) => {
    if (groups[s.berthType]) groups[s.berthType].push(s);
  });

  return {
    left: [groups.SL[0], groups.SU[0]].filter(Boolean),
    stackA: [groups.LB[0], groups.MB[0], groups.UB[0]].filter(Boolean),
    stackB: [groups.LB[1], groups.MB[1], groups.UB[1]].filter(Boolean),
    right: [groups.SL[1], groups.SU[1]].filter(Boolean)
  };
}

function SleeperCompartment({ seats }) {
  const bay = layoutSleeperBay(seats);

  return (
    <div className="irctc-compartment">
      <div className="irctc-comp-side">
        {bay.left.map((s) => <BerthCell key={s.seatNumber} seat={s} />)}
      </div>
      <div className="irctc-comp-main">
        <div className="irctc-comp-stack">
          {bay.stackA.map((s) => <BerthCell key={s.seatNumber} seat={s} />)}
        </div>
        <div className="irctc-comp-stack">
          {bay.stackB.map((s) => <BerthCell key={s.seatNumber} seat={s} />)}
        </div>
      </div>
      <div className="irctc-comp-side">
        {bay.right.map((s) => <BerthCell key={s.seatNumber} seat={s} />)}
      </div>
    </div>
  );
}

function ChairCoachLayout({ seats }) {
  const rows = [];
  for (let i = 0; i < seats.length; i += 6) {
    rows.push(seats.slice(i, i + 6));
  }

  return (
    <div className="irctc-chair-layout">
      {rows.map((row, idx) => (
        <div key={idx} className="irctc-chair-row">
          <div className="irctc-chair-group">
            {row.slice(0, 3).map((s) => <BerthCell key={s.seatNumber} seat={s} />)}
          </div>
          <div className="irctc-chair-aisle" aria-hidden="true" />
          <div className="irctc-chair-group">
            {row.slice(3, 6).map((s) => <BerthCell key={s.seatNumber} seat={s} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CoachBerthLayout({ coach, classCode }) {
  const seats = coach?.seats || [];
  if (!seats.length) {
    return <p className="muted">Berth layout not available for this coach.</p>;
  }

  const isChair = CHAIR_CLASSES.has(classCode);

  return (
    <div className="irctc-coach-layout">
      <div className="irctc-layout-head">
        <strong>{coach.coachNumber}</strong>
        <span>{classCode}</span>
        <span>{seats.filter((s) => s.status === 'Available' || !s.status).length} vacant</span>
      </div>

      <div className="irctc-layout-legend" aria-label="Berth status legend">
        <span><i className="dot vacant" /> Vacant</span>
        <span><i className="dot partial" /> Partial</span>
        <span><i className="dot occupied" /> Occupied</span>
      </div>

      {isChair ? (
        <ChairCoachLayout seats={seats} />
      ) : (
        <div className="irctc-sleeper-layout">
          {Array.from({ length: Math.ceil(seats.length / 8) }, (_, i) => (
            <SleeperCompartment key={i} seats={seats.slice(i * 8, i * 8 + 8)} />
          ))}
        </div>
      )}

      <p className="irctc-layout-note form-hint">
        Coach layout as per Indian Railways classification. Vacancy shown for illustration when chart is not prepared.
      </p>
    </div>
  );
}
