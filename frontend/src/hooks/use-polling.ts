'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Re-run `callback` every `intervalMs` while the tab is visible, and once more
 * when it becomes visible again. Pages load once themselves and use this to stay
 * live (orders, KDS, floor plan, billing, notifications) without a manual refresh.
 */
export function usePolling(callback: () => unknown, intervalMs = 5000, enabled = true): void {
  const saved = useRef(callback);

  useEffect(() => {
    saved.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (!document.hidden) saved.current();
    };
    const id = window.setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [intervalMs, enabled]);
}

/** Current time, refreshed every `intervalMs` — for elapsed-time displays. */
export function useNow(intervalMs = 30000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
