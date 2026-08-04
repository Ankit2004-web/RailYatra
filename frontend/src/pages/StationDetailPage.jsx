import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapPin, Wifi, Car, Coffee, Armchair } from 'lucide-react';
import { api } from '../api/client';

export default function StationDetailPage() {
  const { code } = useParams();
  const [station, setStation] = useState(null);
  const [nearby, setNearby] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/stations/detail/${code}`)
      .then(setStation)
      .catch((err) => setError(err.message || 'Station not found'));
    api.get(`/stations/nearby/${code}`).then(setNearby).catch(() => {});
  }, [code]);

  if (error) return <div className="container page-shell"><div className="alert alert-error">{error}</div></div>;
  if (!station) return <div className="page-loading"><div className="spinner" /></div>;

  const a = station.amenities || {};

  return (
    <div className="station-detail-page page-shell">
      <div className="container">
        <h1>{station.name} ({station.code})</h1>
        <p className="muted"><MapPin size={14} /> {station.city}, {station.state}</p>

        <section className="card">
          <h2>Platforms</h2>
          <div className="recent-chips">
            {(station.platforms || []).map((p) => (
              <span key={p.number} className="recent-chip">{p.label}</span>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Amenities</h2>
          <ul className="station-amenities">
            {a.parking && <li><Car size={16} /> Parking</li>}
            {a.food && <li><Coffee size={16} /> Food stalls</li>}
            {a.waitingRoom && <li><Armchair size={16} /> Waiting room</li>}
            {a.lounge && <li><Armchair size={16} /> Lounge</li>}
            {a.wifi && <li><Wifi size={16} /> Wi-Fi</li>}
            {!a.parking && !a.food && !a.waitingRoom && !a.lounge && !a.wifi && <li className="muted">Standard station facilities</li>}
          </ul>
        </section>

        {nearby.length > 0 && (
          <section className="card">
            <h2>Nearby stations</h2>
            <ul className="profile-list">
              {nearby.map((s) => (
                <li key={s.code}><Link to={`/stations/${s.code}`}>{s.name} ({s.code})</Link></li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
