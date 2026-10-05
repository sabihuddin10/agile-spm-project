'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TimeSlot } from '@/types';
import { reservationApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';

interface Loaded {
  date: string;
  partySize: number;
  slots: TimeSlot[];
}

/**
 * Bookable time slots for a date and party size (US7.1). Slots are only
 * returned once they match the current date/party, so callers never act on a
 * stale day's availability while the next one loads.
 */
export function useAvailability(date: string, partySize: number) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  const enabled = Boolean(date) && Number.isInteger(partySize) && partySize >= 1;

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setError('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    reservationApi
      .availability(date, partySize)
      .then((res) => {
        if (!cancelled) setLoaded({ date, partySize, slots: res.slots });
      })
      .catch((err) => {
        if (!cancelled) {
          setLoaded(null);
          setError(errorMessage(err, 'Could not load availability.'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, partySize, enabled, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const current = enabled && loaded?.date === date && loaded.partySize === partySize;

  return {
    slots: current ? loaded.slots : [],
    /** True once slots for this exact date + party size are in. */
    ready: Boolean(current) && !loading,
    loading,
    error,
    reload,
  };
}
