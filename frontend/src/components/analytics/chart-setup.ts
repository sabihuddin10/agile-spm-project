'use client';

import {
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import type { TooltipOptions } from 'chart.js';

/**
 * Registers only the Chart.js pieces the analytics dashboard uses (bar + line
 * charts on category/linear scales). Import this module before rendering a chart.
 */
ChartJS.register(BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

if (typeof document !== 'undefined') {
  // next/font gives Inter a generated family name — reuse whatever the body renders with.
  ChartJS.defaults.font.family = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
}
ChartJS.defaults.font.size = 12;
ChartJS.defaults.color = '#78716c'; // stone-500 — axis text stays recessive

// Respect the OS "reduce motion" setting: draw charts in their final state.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    ChartJS.defaults.animation = false;
  }
}

/**
 * One palette for every analytics chart: brand for money, steel blue-grey for
 * counts, a pale step of the count hue for de-emphasised marks. Validated for
 * colour-vision separation against the white card surface.
 */
export const CHART_COLORS = {
  revenue: '#d06f2b', // brand-500
  revenueHover: '#b85620', // brand-600
  count: '#3f6ea6',
  countHover: '#335a88',
  muted: '#bccadb',
  mutedHover: '#a5b6cb',
  grid: '#f0eeec',
  axis: '#e7e5e4',
  surface: '#ffffff',
  axisTitle: '#78716c', // stone-500 — axis titles
  label: '#44403c', // stone-700 — category labels and legend text
  danger: '#b91c1c', // red-700 — a state that needs attention (late, over budget)
  track: '#e7e5e4', // stone-200 — empty track behind rings and meters
  breakTime: '#d6d3d1', // stone-300 — time off the clock
} as const;

/** Dark, high-contrast tooltip shared by every chart. */
export const TOOLTIP_STYLE: Partial<TooltipOptions<'bar'>> = {
  backgroundColor: '#1c1917',
  titleColor: '#ffffff',
  bodyColor: '#e7e5e4',
  footerColor: '#a8a29e',
  padding: 10,
  cornerRadius: 8,
  boxPadding: 4,
  titleFont: { weight: 'bold' },
  footerFont: { weight: 'normal' },
};
