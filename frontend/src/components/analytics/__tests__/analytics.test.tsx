/**
 * Module-wise test scaffold for src/components/analytics (components).
 *
 * Real tests for this module go here, in __tests__/, mirroring the
 * app/ and components/ directory structure. Follow the Arrange-Act-Assert
 * (AAA) pattern used in src/lib/__tests__/menu.test.ts,
 * src/components/menu/__tests__/menu-item-card.test.tsx and
 * src/components/account/__tests__/profile-editor.test.tsx — Arrange the
 * data/props, Act (render / interact), then Assert the outcome, with each
 * phase commented.
 */
import { test } from 'vitest';

// analytics-format, inventory-health, kpi-tiles and range-controls now
// have real tests in this folder.
test.todo('analytics-card: shared card chrome (title, story tag, action slot) and the Segmented control');
test.todo('analytics-dashboard: top-level dashboard composing range-controls + the cards below');
test.todo('chart-setup: Chart.js registration (side-effect module, low value to unit test)');
test.todo('peak-hours-chart: renders the busiest-hours chart from dashboard data');
test.todo('reservation-stats: no-show rate and booking funnel stats (US10.6)');
test.todo('revenue-trend-chart: renders the revenue/orders trend from dashboard data');
test.todo('table-utilization: occupancy and turnover stats per table/zone (US10.3)');
test.todo('top-dishes: best-selling dishes by qty/revenue (US10.2)');
