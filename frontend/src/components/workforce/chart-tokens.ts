/**
 * Colour tokens and motion settings for the workforce charts and rings.
 *
 * TODO: CHART_COLORS in components/analytics/chart-setup.ts is gaining
 * axisTitle / label / danger / track / breakTime on another branch. Once that
 * lands, delete these and use CHART_COLORS.* directly.
 */
export const WORKFORCE_CHART_COLORS = {
  axisTitle: '#78716c', // stone-500 — axis titles stay recessive
  label: '#44403c', // stone-700 — ring arcs and primary marks
  warning: '#d97706', // amber-600 — below target
  danger: '#b91c1c', // red-700 — late is a state
  track: '#e7e5e4', // stone-200 — ring background
  breakTime: '#d6d3d1', // stone-300 — time off the clock, not a state
} as const;

/** True when the visitor asked the OS for reduced motion. Safe during SSR. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

/** Chart.js `animation` option: a short ease, or none under reduced motion. */
export function chartAnimation(): false | { duration: number } {
  return prefersReducedMotion() ? false : { duration: 250 };
}
