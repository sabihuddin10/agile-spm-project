/**
 * Module-wise tests for src/components/analytics (components).
 *
 * analytics-format, inventory-health, kpi-tiles and range-controls have their
 * own test files in this folder; this file covers the rest of the module.
 * Chart.js is never rendered: `react-chartjs-2` is mocked so each chart's
 * `data` prop can be asserted directly. Every test follows Arrange-Act-Assert.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChartData } from 'chart.js';
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
import { AnalyticsCard, DataTableToggle, Segmented } from '@/components/analytics/analytics-card';
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';
import { CHART_COLORS } from '@/components/analytics/chart-setup';
import { PeakHoursChart } from '@/components/analytics/peak-hours-chart';
import { ReservationStats } from '@/components/analytics/reservation-stats';
import { RevenueTrendChart } from '@/components/analytics/revenue-trend-chart';
import { TableUtilization } from '@/components/analytics/table-utilization';
import { TopDishes } from '@/components/analytics/top-dishes';
import { analyticsApi } from '@/lib/api';
import { addDaysISO, localDateISO } from '@/lib/format';
import type { AnalyticsDashboard as DashboardData } from '@/types';

type CapturedChart = { kind: 'Bar' | 'Chart'; data: ChartData<'bar' | 'line', number[], string> };

const charts = vi.hoisted(() => ({ calls: [] as CapturedChart[] }));
const toast = vi.hoisted(() => vi.fn());

vi.mock('react-chartjs-2', () => ({
  Bar: ({ data }: { data: CapturedChart['data'] }) => {
    charts.calls.push({ kind: 'Bar', data });
    return <div data-testid="chart" />;
  },
  Chart: ({ data }: { data: CapturedChart['data'] }) => {
    charts.calls.push({ kind: 'Chart', data });
    return <div data-testid="chart" />;
  },
}));
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, analyticsApi: { ...actual.analyticsApi, dashboard: vi.fn() } };
});
vi.mock('@/components/ui/toast', () => ({ useToast: () => toast }));

/** Data prop of the most recent chart render. */
function lastChart(): CapturedChart {
  const last = charts.calls[charts.calls.length - 1];
  if (!last) throw new Error('no chart was rendered');
  return last;
}

/** Text of column `col` for each body row of `table` (header/footer rows skipped). */
function columnText(table: HTMLElement, col: number): string[] {
  const body = table.querySelector('tbody') as HTMLElement;
  return within(body)
    .getAllByRole('row')
    .map((r) => within(r).getAllByRole('cell')[col].textContent ?? '');
}

function makeDashboard(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    range: { from: '2026-09-01', to: '2026-09-30', granularity: 'day', days: 30 },
    kpis: { revenue: 600, orders: 12, avgOrder: 50, tips: 20, refunds: 0, cancelled: 1, customers: 9 },
    trend: [
      { period: '2026-09-01', revenue: 100, orders: 2 },
      { period: '2026-09-02', revenue: 500, orders: 10 },
    ],
    dishes: [{ name: 'Margherita', qty: 8, revenue: 96 }],
    tables: [{ tableId: 't1', number: 1, zone: 'Main', seats: 4, turns: 3, avgTurnoverMinutes: 50, occupancyRate: 40 }],
    zones: [{ zone: 'Main', tables: 1, turns: 3, avgTurnoverMinutes: 50, occupancyRate: 40 }],
    peakHours: [{ hour: 19, orders: 12, revenue: 600, avgPerDay: 0.4 }],
    inventory: [],
    reservations: { total: 5, seated: 4, noShows: 1, cancelled: 0, noShowRate: 20, cancellationRate: 0 },
    ...overrides,
  };
}

beforeEach(() => {
  charts.calls.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('chart-setup', () => {
  it('registers the bar/line controllers, elements, scales and plugins the dashboard uses', () => {
    // Arrange — chart-setup was imported above (side effect on the shared Chart.js registry)
    const registry = ChartJS.registry;

    // Act
    const registered = {
      bar: registry.getController('bar'),
      line: registry.getController('line'),
      barElement: registry.getElement('bar'),
      lineElement: registry.getElement('line'),
      point: registry.getElement('point'),
      category: registry.getScale('category'),
      linear: registry.getScale('linear'),
      tooltip: registry.getPlugin('tooltip'),
      legend: registry.getPlugin('legend'),
    };

    // Assert
    expect(registered).toEqual({
      bar: BarController,
      line: LineController,
      barElement: BarElement,
      lineElement: LineElement,
      point: PointElement,
      category: CategoryScale,
      linear: LinearScale,
      tooltip: Tooltip,
      legend: Legend,
    });
    expect(ChartJS.defaults.font.size).toBe(12);
    expect(ChartJS.defaults.color).toBe('#78716c');
  });
});

describe('AnalyticsCard', () => {
  it('renders the title as the section heading, the story tag, subtitle, action and body', () => {
    // Arrange / Act
    render(
      <AnalyticsCard title="Peak hours" story="US10.4" subtitle="Orders per hour." action={<button type="button">Export</button>}>
        <p>Card body</p>
      </AnalyticsCard>,
    );

    // Assert
    const region = screen.getByRole('region', { name: 'Peak hours' });
    expect(within(region).getByRole('heading', { level: 2, name: 'Peak hours' })).toBeInTheDocument();
    expect(within(region).getByText('US10.4')).toBeInTheDocument();
    expect(within(region).getByText('Orders per hour.')).toBeInTheDocument();
    expect(within(region).getByRole('button', { name: 'Export' })).toBeInTheDocument();
    expect(within(region).getByText('Card body')).toBeInTheDocument();
  });

  it('omits the subtitle and action slot when not given', () => {
    // Arrange / Act
    render(
      <AnalyticsCard title="Top dishes" story="US10.2">
        <p>Body</p>
      </AnalyticsCard>,
    );

    // Assert
    const region = screen.getByRole('region', { name: 'Top dishes' });
    expect(within(region).queryByRole('button')).not.toBeInTheDocument();
    expect(region.querySelectorAll('p')).toHaveLength(1); // just the body
  });

  it('DataTableToggle hides its table behind a "View data table" disclosure', () => {
    // Arrange / Act
    render(
      <DataTableToggle>
        <table>
          <tbody>
            <tr>
              <td>row</td>
            </tr>
          </tbody>
        </table>
      </DataTableToggle>,
    );

    // Assert
    const summary = screen.getByText('View data table');
    expect(summary.closest('details')).not.toHaveAttribute('open');
  });
});

describe('Segmented', () => {
  const options = [
    { value: 'qty' as const, label: 'By quantity' },
    { value: 'revenue' as const, label: 'By revenue' },
  ];

  it('marks only the current option as pressed inside a labelled group', () => {
    // Arrange / Act
    render(<Segmented label="Rank dishes" value="qty" options={options} onChange={vi.fn()} />);

    // Assert
    const group = screen.getByRole('group', { name: 'Rank dishes' });
    expect(within(group).getByRole('button', { name: 'By quantity' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: 'By revenue' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports the clicked option value', async () => {
    // Arrange
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Segmented label="Rank dishes" value="qty" options={options} onChange={onChange} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'By revenue' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith('revenue');
  });
});

describe('TopDishes (US10.2)', () => {
  const dishes: DashboardData['dishes'] = [
    { name: 'Soup', qty: 10, revenue: 50 },
    { name: 'Steak', qty: 3, revenue: 120 },
    { name: 'Salad', qty: 10, revenue: 80 },
  ];

  it('ranks by quantity sold by default, breaking ties by revenue', () => {
    // Arrange / Act
    render(<TopDishes dishes={dishes} />);

    // Assert
    expect(screen.getByRole('button', { name: 'By quantity' })).toHaveAttribute('aria-pressed', 'true');
    const table = screen.getByRole('table', { name: /ranked by quantity/i });
    expect(columnText(table, 1)).toEqual(['Salad', 'Soup', 'Steak']);
    expect(lastChart().data.labels).toEqual(['Salad', 'Soup', 'Steak']);
    expect(lastChart().data.datasets[0]).toMatchObject({ label: 'Quantity sold', data: [10, 10, 3] });
  });

  it('re-ranks by revenue when "By revenue" is chosen', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<TopDishes dishes={dishes} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'By revenue' }));

    // Assert
    const table = screen.getByRole('table', { name: /ranked by revenue/i });
    expect(columnText(table, 1)).toEqual(['Steak', 'Salad', 'Soup']);
    expect(columnText(table, 3)).toEqual(['$120.00', '$80.00', '$50.00']);
    expect(lastChart().data.datasets[0]).toMatchObject({ label: 'Revenue', data: [120, 80, 50] });
  });

  it('shows only the top 10 but totals every dish in the footer', () => {
    // Arrange
    const many = Array.from({ length: 12 }, (_, i) => ({ name: `Dish ${i + 1}`, qty: i + 1, revenue: 10 }));

    // Act
    render(<TopDishes dishes={many} />);

    // Assert
    const table = screen.getByRole('table', { name: /top 10 dishes/i });
    expect(columnText(table, 1)).toHaveLength(10);
    expect(columnText(table, 1)[0]).toBe('Dish 12');
    expect(screen.getByText('All 12 dishes')).toBeInTheDocument();
    expect(screen.getByText('78')).toBeInTheDocument(); // 1 + 2 + … + 12
    expect(screen.getByText('$120.00')).toBeInTheDocument();
  });

  it('shows an empty state instead of a chart when nothing sold', () => {
    // Arrange / Act
    render(<TopDishes dishes={[]} />);

    // Assert
    expect(screen.getByText('No dishes sold in this period')).toBeInTheDocument();
    expect(screen.queryByTestId('chart')).not.toBeInTheDocument();
  });
});

describe('ReservationStats (US10.6)', () => {
  it('shows the no-show rate over bookings due to arrive, plus the booking funnel', () => {
    // Arrange
    const stats = { total: 20, seated: 12, noShows: 3, cancelled: 2, noShowRate: 20, cancellationRate: 10 };

    // Act
    render(<ReservationStats stats={stats} />);

    // Assert
    expect(screen.getByText('20%')).toBeInTheDocument();
    expect(screen.getByText('no-show rate — 3 of 15 bookings due to arrive didn’t show.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Of 20 bookings: 12 seated, 3 no-shows, 2 cancelled, 3 upcoming / pending.' })).toBeInTheDocument();
    expect(screen.getByText('3 upcoming or awaiting confirmation')).toBeInTheDocument();
    expect(screen.getByText('Cancellation rate').parentElement).toHaveTextContent('Cancellation rate 10% of all bookings');
  });

  it('lists seated, no-show, cancelled and total counts', () => {
    // Arrange
    const stats = { total: 20, seated: 12, noShows: 3, cancelled: 2, noShowRate: 20, cancellationRate: 10 };

    // Act
    render(<ReservationStats stats={stats} />);

    // Assert
    const value = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling;
    expect(value('Seated')).toHaveTextContent('12');
    expect(value('No-shows')).toHaveTextContent('3');
    expect(value('Cancelled')).toHaveTextContent('2');
    expect(value('Total bookings')).toHaveTextContent('20');
  });

  it('explains when no bookings have come due yet and leaves out empty funnel segments', () => {
    // Arrange
    const stats = { total: 4, seated: 0, noShows: 0, cancelled: 1, noShowRate: 0, cancellationRate: 25 };

    // Act
    render(<ReservationStats stats={stats} />);

    // Assert
    expect(screen.getByText('no-show rate — no bookings in this period have come due yet.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Of 4 bookings: 1 cancelled, 3 upcoming / pending.' })).toBeInTheDocument();
  });

  it('shows an empty state when there are no bookings', () => {
    // Arrange / Act
    render(<ReservationStats stats={{ total: 0, seated: 0, noShows: 0, cancelled: 0, noShowRate: 0, cancellationRate: 0 }} />);

    // Assert
    expect(screen.getByText('No bookings in this period')).toBeInTheDocument();
  });
});

describe('TableUtilization (US10.3)', () => {
  const tables: DashboardData['tables'] = [
    { tableId: 't1', number: 1, zone: 'Patio', seats: 4, turns: 5, avgTurnoverMinutes: 45, occupancyRate: 30 },
    { tableId: 't2', number: 2, zone: 'Main', seats: 2, turns: 0, avgTurnoverMinutes: 0, occupancyRate: 0 },
    { tableId: 't3', number: 3, zone: 'Main', seats: 6, turns: 8, avgTurnoverMinutes: 90, occupancyRate: 62.5 },
  ];
  const zones: DashboardData['zones'] = [
    { zone: 'Main', tables: 2, turns: 8, avgTurnoverMinutes: 90, occupancyRate: 31.3 },
    { zone: 'Patio', tables: 1, turns: 5, avgTurnoverMinutes: 45, occupancyRate: 30 },
  ];

  it('shows turns, average turnover and occupancy per table, flagging the busiest', () => {
    // Arrange / Act
    render(<TableUtilization tables={tables} zones={zones} days={7} />);

    // Assert
    const table = screen.getByRole('table', { name: 'Turnover and occupancy per table' });
    const rows = within(table.querySelector('tbody') as HTMLElement).getAllByRole('row');
    expect(rows[0]).toHaveTextContent('T1Patio4545 min30%');
    expect(rows[1]).toHaveTextContent('T2Main20—0%');
    expect(rows[2]).toHaveTextContent('T3BusiestMain681 h 30 min62.5%');
    expect(within(table).getAllByText('Busiest')).toHaveLength(1);
  });

  it('summarises each zone with its table count, turns, turnover and occupancy', () => {
    // Arrange / Act
    render(<TableUtilization tables={tables} zones={zones} days={7} />);

    // Assert
    const main = screen.getByText('Main', { selector: 'li p' }).closest('li') as HTMLElement;
    expect(within(main).getByText('2 tables')).toBeInTheDocument();
    expect(within(main).getByText('8')).toBeInTheDocument();
    expect(within(main).getByText('1 h 30 min')).toBeInTheDocument();
    expect(within(main).getByText('31.3%')).toBeInTheDocument();
    const patio = screen.getByText('Patio', { selector: 'li p' }).closest('li') as HTMLElement;
    expect(within(patio).getByText('1 table')).toBeInTheDocument();
    expect(within(patio).getByText('45 min')).toBeInTheDocument();
    expect(screen.getByText(/opening hours over 7 days\./)).toBeInTheDocument();
  });

  it('notes when no sittings closed and never flags an idle table as busiest', () => {
    // Arrange
    const idle = tables.map((t) => ({ ...t, turns: 0, avgTurnoverMinutes: 0, occupancyRate: 0 }));

    // Act
    render(<TableUtilization tables={idle} zones={[]} days={1} />);

    // Assert
    expect(screen.getByText('No closed dine-in sittings in this period yet.')).toBeInTheDocument();
    expect(screen.queryByText('Busiest')).not.toBeInTheDocument();
    expect(screen.getByText(/opening hours over 1 day\./)).toBeInTheDocument();
  });

  it('shows an empty state when no tables are configured', () => {
    // Arrange / Act
    render(<TableUtilization tables={[]} zones={[]} days={7} />);

    // Assert
    expect(screen.getByText('No tables configured')).toBeInTheDocument();
  });
});

describe('PeakHoursChart (US10.4)', () => {
  const hours: DashboardData['peakHours'] = [
    { hour: 11, orders: 4, revenue: 80, avgPerDay: 0.6 },
    { hour: 12, orders: 10, revenue: 250, avgPerDay: 1.4 },
    { hour: 13, orders: 7, revenue: 140, avgPerDay: 1 },
    { hour: 18, orders: 9, revenue: 300, avgPerDay: 1.3 },
    { hour: 19, orders: 2, revenue: 60, avgPerDay: 0.3 },
  ];

  it('charts orders per hour, highlighting the three busiest hours', () => {
    // Arrange / Act
    render(<PeakHoursChart hours={hours} />);

    // Assert
    const { kind, data } = lastChart();
    expect(kind).toBe('Bar');
    expect(data.labels).toEqual(['11:00', '12:00', '13:00', '18:00', '19:00']);
    expect(data.datasets[0].data).toEqual([4, 10, 7, 9, 2]);
    const { muted, revenue: top } = CHART_COLORS;
    expect(data.datasets[0].backgroundColor).toEqual([muted, top, top, top, muted]);
    expect(screen.getByText('Top 3 hours: 12:00, 18:00, 13:00')).toBeInTheDocument();
  });

  it('calls out the busiest hour and describes the chart for screen readers', () => {
    // Arrange / Act
    render(<PeakHoursChart hours={hours} />);

    // Assert
    expect(screen.getByText(/^Busiest hour/)).toHaveTextContent('Busiest hour 12:00 — averaging 1.4 orders/day (10 in total).');
    expect(
      screen.getByRole('img', {
        name: 'Orders by hour of day. Busiest hours: 12:00 (10 orders), 18:00 (9 orders), 13:00 (7 orders).',
      }),
    ).toBeInTheDocument();
  });

  it('shows an empty state and no chart when there were no orders', () => {
    // Arrange / Act
    render(<PeakHoursChart hours={hours.map((h) => ({ ...h, orders: 0, revenue: 0, avgPerDay: 0 }))} />);

    // Assert
    expect(screen.getByText('No orders in this period')).toBeInTheDocument();
    expect(screen.queryByTestId('chart')).not.toBeInTheDocument();
  });
});

describe('RevenueTrendChart (US10.1)', () => {
  it('charts revenue as bars and orders as a line on a second axis, one point per period', () => {
    // Arrange
    const data = makeDashboard({
      range: { from: '2026-10-01', to: '2026-10-03', granularity: 'day', days: 3 },
      trend: [
        { period: '2026-10-01', revenue: 120, orders: 3 },
        { period: '2026-10-02', revenue: 300, orders: 6 },
        { period: '2026-10-03', revenue: 80.5, orders: 2 },
      ],
    });

    // Act
    render(<RevenueTrendChart data={data} />);

    // Assert
    const chart = lastChart();
    expect(chart.kind).toBe('Chart');
    expect(chart.data.labels).toEqual(['1 Oct', '2 Oct', '3 Oct']);
    expect(chart.data.datasets).toEqual([
      expect.objectContaining({ type: 'bar', label: 'Revenue', data: [120, 300, 80.5], yAxisID: 'y' }),
      expect.objectContaining({ type: 'line', label: 'Orders', data: [3, 6, 2], yAxisID: 'y1' }),
    ]);
  });

  it('calls out the best period and lists every period in the data table', () => {
    // Arrange
    const data = makeDashboard({
      range: { from: '2026-10-01', to: '2026-10-03', granularity: 'day', days: 3 },
      trend: [
        { period: '2026-10-01', revenue: 120, orders: 3 },
        { period: '2026-10-02', revenue: 300, orders: 6 },
        { period: '2026-10-03', revenue: 80.5, orders: 2 },
      ],
    });

    // Act
    render(<RevenueTrendChart data={data} />);

    // Assert
    expect(screen.getByText(/^Best day:/)).toHaveTextContent(/Best day: \w{3} 2 Oct 2026 — \$300\.00 from 6 orders\./);
    const table = screen.getByRole('table');
    expect(columnText(table, 1)).toEqual(['$120.00', '$300.00', '$80.50']);
    expect(columnText(table, 2)).toEqual(['3', '6', '2']);
  });

  it('labels weekly buckets and flags ones the range only partly covers', () => {
    // Arrange
    const data = makeDashboard({
      range: { from: '2026-09-02', to: '2026-09-14', granularity: 'week', days: 13 },
      trend: [
        { period: '2026-08-31', revenue: 200, orders: 4 },
        { period: '2026-09-07', revenue: 400, orders: 8 },
      ],
    });

    // Act
    render(<RevenueTrendChart data={data} />);

    // Assert
    expect(lastChart().data.labels).toEqual(['w/c 31 Aug', 'w/c 7 Sep']);
    expect(columnText(screen.getByRole('table'), 0)).toEqual(['Week commencing 31 Aug 2026 (partial)', 'Week commencing 7 Sep 2026']);
    expect(screen.getByText(/per week\./)).toBeInTheDocument();
  });

  it('shows an empty state when the period has no orders', () => {
    // Arrange
    const data = makeDashboard({ trend: [{ period: '2026-09-01', revenue: 0, orders: 0 }] });

    // Act
    render(<RevenueTrendChart data={data} />);

    // Assert
    expect(screen.getByText('No orders in this period')).toBeInTheDocument();
    expect(screen.queryByTestId('chart')).not.toBeInTheDocument();
  });
});

describe('AnalyticsDashboard', () => {
  it('loads the last 30 days by day and composes every analytics card', async () => {
    // Arrange
    vi.mocked(analyticsApi.dashboard).mockResolvedValue(makeDashboard());

    // Act
    render(<AnalyticsDashboard />);

    // Assert
    expect(screen.getByText('Loading analytics…')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Revenue & orders trend' })).toBeInTheDocument();
    expect(analyticsApi.dashboard).toHaveBeenCalledWith({ from: addDaysISO(-29), to: localDateISO(), granularity: 'day' });
    for (const title of ['Top-selling dishes', 'Reservation no-shows', 'Peak hours', 'Table turnover & utilization']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
    expect(screen.getByText('Margherita', { selector: 'td' })).toBeInTheDocument();
    expect(screen.getByText('30 days, grouped by day')).toBeInTheDocument();
    expect(screen.getByText(/^Showing/)).toHaveTextContent('Showing 1 Sep 2026 – 30 Sep 2026');
  });

  it('reloads with the new period when the range or grouping changes', async () => {
    // Arrange
    const user = userEvent.setup();
    vi.mocked(analyticsApi.dashboard).mockResolvedValue(makeDashboard());
    render(<AnalyticsDashboard />);
    await screen.findByRole('heading', { name: 'Peak hours' });

    // Act
    await user.click(screen.getByRole('button', { name: 'Last 7 days' }));

    // Assert
    await waitFor(() =>
      expect(analyticsApi.dashboard).toHaveBeenLastCalledWith({ from: addDaysISO(-6), to: localDateISO(), granularity: 'day' }),
    );

    // Act
    await user.click(screen.getByRole('button', { name: 'Week' }));

    // Assert
    await waitFor(() =>
      expect(analyticsApi.dashboard).toHaveBeenLastCalledWith({ from: addDaysISO(-6), to: localDateISO(), granularity: 'week' }),
    );
    expect(analyticsApi.dashboard).toHaveBeenCalledTimes(3);
  });

  it('shows an error state with a retry, and toasts the failure', async () => {
    // Arrange
    const user = userEvent.setup();
    vi.mocked(analyticsApi.dashboard).mockRejectedValueOnce(new Error('Server down')).mockResolvedValueOnce(makeDashboard());
    render(<AnalyticsDashboard />);

    // Act
    expect(await screen.findByText('Analytics couldn’t be loaded')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    // Assert
    expect(toast).toHaveBeenCalledWith('Server down', 'error');
    expect(await screen.findByRole('heading', { name: 'Top-selling dishes' })).toBeInTheDocument();
    expect(analyticsApi.dashboard).toHaveBeenCalledTimes(2);
  });
});
