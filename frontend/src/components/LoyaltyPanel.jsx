import { useEffect, useState } from 'react';
import { Award } from 'lucide-react';
import { api } from '../api/client';

export default function LoyaltyPanel() {
  const [loyalty, setLoyalty] = useState(null);

  useEffect(() => {
    api.get('/profile/loyalty').then(setLoyalty).catch(() => {});
  }, []);

  if (!loyalty) return null;

  return (
    <section className="profile-panel card loyalty-panel">
      <h2><Award size={18} /> Loyalty rewards</h2>
      <div className="loyalty-stats">
        <div><span className="muted">Points</span><strong>{loyalty.points}</strong></div>
        <div><span className="muted">Tier</span><strong>{loyalty.tier}</strong></div>
        <div><span className="muted">Lifetime</span><strong>{loyalty.lifetimePoints}</strong></div>
      </div>
      <p className="muted">Earn 1 point per ₹100 spent on confirmed bookings.</p>
    </section>
  );
}
