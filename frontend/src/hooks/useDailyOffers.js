import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { getOffersPayload, istDateKey } from '../utils/offerEngine';

const EMPTY = {
  mode: 'daily',
  refreshedAt: null,
  refreshedFor: istDateKey(),
  refreshedLabel: '',
  totalActive: 0,
  categories: [],
  bankPartners: [],
  offers: []
};

export function useDailyOffers() {
  const [payload, setPayload] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/offers');
      setPayload(data);
    } catch {
      try {
        setPayload(getOffersPayload());
      } catch (err) {
        setError(err.message || 'Could not load offers');
        setPayload(EMPTY);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (payload.refreshedFor && payload.refreshedFor !== istDateKey()) {
        load();
      }
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [payload.refreshedFor, load]);

  return {
    ...payload,
    offers: payload.offers || [],
    loading,
    error,
    reload: load
  };
}
