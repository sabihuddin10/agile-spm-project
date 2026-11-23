'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Re-run `callback` every `intervalMs` while the tab is visible, and once more
 * when it becomes visible again. Pages load once themselves and use this to stay
 * live (orders, KDS, floor plan, billing, notifications) without a manual refresh.
 *
 * Lifecycle guarantees (sixteen screens depend on them):
 * - Single flight: while a callback is still running (it returned a promise that has not settled),
 *   no further callback starts, whether the trigger is the interval or a visibility change. Slow
 *   networks therefore cannot pile up overlapping requests or let an older response land after a newer one.
 * - Recovery: a callback that throws or rejects never produces an unhandled rejection, and the next
 *   interval runs normally. Callers report their own errors; the poller just keeps going.
 * - Cleanup: disabling, unmounting or changing the interval clears the timer and the listener at once,
 *   so no later cycle starts. A callback that settles after cleanup starts nothing. The in-flight flag
 *   outlives the effect on purpose: changing the interval during a slow request does not allow an
 *   overlapping callback from the new schedule.
 * - Strict Mode's effect replay leaves exactly one live timer.
 */
export function usePolling(callback: () => unknown, intervalMs = 5000, enabled = true): void {
  const saved = useRef(callback);
  const inFlight = useRef(false);

  useEffect(() => {
    saved.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (document.hidden || inFlight.current) return;
      inFlight.current = true;
      let result: unknown;
      try {
        result = saved.current();
      } catch {
        inFlight.current = false;
        return;
      }
      Promise.resolve(result)
        .catch(() => undefined)
        .finally(() => {
          inFlight.current = false;
        });
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
