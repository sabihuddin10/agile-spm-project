/**
 * Module-wise tests for src/components/workforce. Chart.js is never rendered:
 * `react-chartjs-2` is mocked so each chart's `data` prop can be asserted.
 * Every test follows Arrange-Act-Assert.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChartData } from 'chart.js';
import type { AttendanceSession, MyStatus, PayBreakdown, PresenceEntry, SeriesPoint, WorkforceOverview, WorkShift, WorkSummary } from '@/types';
import { AdjustmentForm } from '@/components/workforce/adjustment-form';
import { PayBreakdownCard } from '@/components/workforce/pay-breakdown';
import { PresenceList } from '@/components/workforce/presence-list';
import { ProgressRing, WorkRings } from '@/components/workforce/progress-ring';
import { SessionsTable } from '@/components/workforce/sessions-table';
import { StaffOverviewTable } from '@/components/workforce/staff-overview-table';
import { TimeClock } from '@/components/workforce/time-clock';
import { WageEditor } from '@/components/workforce/wage-editor';
import { WorkCharts } from '@/components/workforce/work-charts';

type Captured = ChartData<'bar' | 'line', number[], string>;
const charts = vi.hoisted(() => ({ calls: [] as Captured[] }));

vi.mock('react-chartjs-2', () => ({
  Bar: ({ data }: { data: Captured }) => {
    charts.calls.push(data);
    return <div data-testid="chart" />;
  },
  Chart: ({ data }: { data: Captured }) => {
    charts.calls.push(data);
    return <div data-testid="chart" />;
  },
}));

const lastChart = () => charts.calls[charts.calls.length - 1];
const iso = (h: number, m = 0, day = 9) => new Date(2026, 9, day, h, m).toISOString();

afterEach(() => {
  vi.useRealTimers();
  charts.calls = [];
});

function makeSession(overrides: Partial<AttendanceSession> = {}): AttendanceSession {
  return {
    id: 's1',
    userId: 'u1',
    date: '2026-10-08',
    clockIn: iso(10, 0, 8),
    clockOut: iso(18, 0, 8),
    breaks: [],
    autoBreakMinutes: 0,
    shiftId: 'sh1',
    late: false,
    lateMinutes: 0,
    paidMinutes: 450,
    ...overrides,
  };
}

function makeSummary(overrides: Partial<WorkSummary> = {}): WorkSummary {
  return {
    scheduledMinutes: 8400,
    workedMinutes: 4200,
    breakMinutes: 450,
    paidMinutes: 3750,
    shifts: 20,
    shiftsWorked: 9,
    shiftsMissed: 1,
    lateCount: 2,
    lateMinutes: 25,
    onTimeRate: 0.78,
    attendanceRate: 0.9,
    ...overrides,
  };
}

function makePay(overrides: Partial<PayBreakdown> = {}): PayBreakdown {
  return {
    month: '2026-10',
    hourlyWage: 12,
    paidHours: 62.5,
    base: 750,
    tips: 210.4,
    bonuses: [
      { id: 'b1', amount: 50, reason: 'Eid bonus', date: '2026-10-02' },
      { id: 'b2', amount: -15, reason: 'Uniform', date: '2026-10-03' },
    ],
    bonusTotal: 35,
    latePenalties: [{ date: '2026-10-06', minutes: 12, amount: 5 }],
    latePenaltyTotal: 5,
    net: 990.4,
    estimated: true,
    ...overrides,
  };
}

function point(key: string, paid: number, scheduled = 480, lateCount = 0): SeriesPoint {
  return { key, label: key, scheduledMinutes: scheduled, paidMinutes: paid, breakMinutes: 30, lateCount };
}

function status(overrides: Partial<MyStatus> = {}): MyStatus {
  return { state: 'off', since: null, session: null, todayShift: { start: '14:00', end: '20:00' }, ...overrides };
}

describe('TimeClock', () => {
  it('offers only the buttons valid for each state', () => {
    // Arrange
    const cases: [MyStatus, string[]][] = [
      [status(), ['Check in']],
      [status({ state: 'working', since: iso(14), session: makeSession({ clockOut: null }) }), ['Start break', 'Check out']],
      [status({ state: 'on_break', since: iso(16), session: makeSession({ clockOut: null }) }), ['End break']],
    ];

    for (const [s, expected] of cases) {
      // Act
      const { unmount } = render(<TimeClock status={s} onAction={vi.fn()} />);

      // Assert
      const labels = screen
        .getAllByRole('button')
        .map((b) => b.textContent)
        .filter((t) => ['Check in', 'Start break', 'End break', 'Check out'].includes(t ?? ''));
      expect(labels).toEqual(expected);
      unmount();
    }
  });

  it('calls onAction with the chosen transition and announces the state politely', async () => {
    // Arrange
    const onAction = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<TimeClock status={status({ state: 'working', since: iso(14, 5), session: makeSession({ clockOut: null }) })} onAction={onAction} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Start break' }));

    // Assert
    expect(onAction).toHaveBeenCalledWith('break-start');
    const live = document.querySelector('[aria-live="polite"]');
    expect(live).toHaveTextContent('Checked in since 14:05');
    expect(screen.getByText(/Breaks are unpaid/)).toBeInTheDocument();
  });

  it('warns before a late check-in once the grace period has passed', () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 9, 14, 20));

    // Act
    render(<TimeClock status={status()} onAction={vi.fn()} />);

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('marked late (20 min)');
  });
});

describe('ProgressRing / WorkRings', () => {
  it('exposes each ring as an image whose label carries the numbers', () => {
    // Arrange
    const shifts: WorkShift[] = [{ id: 'x', date: '2026-10-20', start: '10:00', end: '15:00', status: 'scheduled' }];

    // Act
    render(<WorkRings summary={makeSummary()} data={{ pay: makePay(), shifts }} periodLabel="October 2026" />);

    // Assert
    expect(screen.getByRole('img', { name: 'Hours: 62.5 h paid of 140 h scheduled' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'On time: 78%, 2 late arrivals' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Attendance: 90%, 9 of 10 shifts worked, 1 missed' })).toBeInTheDocument();
    // projected = 990.40 + 5 h × $12
    expect(screen.getByRole('img', { name: 'Pay so far: $990.40 of $1050.40 projected' })).toBeInTheDocument();
  });

  it('omits the pay ring when pay is not visible', () => {
    // Arrange / Act
    render(<WorkRings summary={makeSummary()} data={{ pay: null, shifts: [] }} periodLabel="October 2026" />);

    // Assert
    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(screen.queryByRole('img', { name: /Pay so far/ })).not.toBeInTheDocument();
  });

  it('draws a stroke proportional to value / max', () => {
    // Arrange / Act
    const { container } = render(<ProgressRing value={1} max={4} ariaLabel="quarter" size={40} stroke={4} />);

    // Assert
    const arc = container.querySelectorAll('circle')[1];
    const c = 2 * Math.PI * 18;
    expect(arc.getAttribute('stroke-dasharray')).toBe(`${c / 4} ${c}`);
  });
});

describe('PayBreakdownCard', () => {
  it('lists wage, hours, base, tips, each bonus and late deduction, and the net', () => {
    // Arrange / Act
    render(<PayBreakdownCard pay={makePay()} />);

    // Assert
    const lines = within(screen.getByRole('list', { name: 'Pay lines' })).getAllByRole('listitem');
    const text = lines.map((l) => l.textContent);
    expect(text[0]).toContain('$12.00 / h');
    expect(text[1]).toContain('62.50 h');
    expect(text[2]).toContain('$750.00');
    expect(text[3]).toContain('$210.40');
    expect(text.some((t) => t?.includes('Bonus: Eid bonus') && t.includes('+$50.00'))).toBe(true);
    expect(text.some((t) => t?.includes('Correction: Uniform') && t.includes('−$15.00'))).toBe(true);
    expect(text.some((t) => t?.includes('Late deduction') && t.includes('12 min late') && t.includes('−$5.00'))).toBe(true);
    expect(screen.getByTestId('pay-net')).toHaveTextContent('$990.40');
    expect(screen.getByText('Estimated')).toBeInTheDocument();
  });

  it('shows "Final" after the month and remove buttons only when given a handler', async () => {
    // Arrange
    const onRemove = vi.fn();
    const user = userEvent.setup({ delay: null });
    const { rerender } = render(<PayBreakdownCard pay={makePay({ estimated: false })} />);
    expect(screen.getByText('Final')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();

    // Act
    rerender(<PayBreakdownCard pay={makePay()} onRemoveAdjustment={onRemove} />);
    await user.click(screen.getByRole('button', { name: 'Remove Eid bonus (+$50.00)' }));

    // Assert
    expect(onRemove).toHaveBeenCalledWith('b1');
  });
});

describe('WorkCharts', () => {
  it('switches datasets between day, week, month and hour of day', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const series = {
      day: [point('d1', 60), point('d2', 120, 480, 1)],
      week: [point('w1', 600, 2400)],
      month: [point('m1', 6000, 9600, 3)],
      hour: Array.from({ length: 24 }, (_, h) => point(String(h), h === 12 ? 90 : 0, 0)),
    };
    render(<WorkCharts series={series} />);
    expect(lastChart().labels).toEqual(['d1', 'd2']);
    expect(lastChart().datasets.map((d) => d.label)).toEqual(['Scheduled', 'Paid', 'Breaks', 'Late arrivals']);
    expect(lastChart().datasets[1].data).toEqual([1, 2]);

    // Act
    await user.click(screen.getByRole('button', { name: 'Week' }));
    const week = lastChart();
    await user.click(screen.getByRole('button', { name: 'Month' }));
    const month = lastChart();
    await user.click(screen.getByRole('button', { name: 'Hour of day' }));
    const hour = lastChart();

    // Assert
    expect(week.labels).toEqual(['w1']);
    expect(week.datasets[1].data).toEqual([10]);
    expect(month.datasets[3].data).toEqual([3]);
    expect(hour.labels).toHaveLength(24);
    expect(hour.datasets[1].data[12]).toBe(1.5);
    expect(screen.getByRole('button', { name: 'Hour of day' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('img', { name: /Busiest hours: 12/ })).toBeInTheDocument();
  });

  it('offers a data table alternative and an empty state', () => {
    // Arrange / Act
    const { unmount } = render(<WorkCharts series={{ day: [point('d1', 60)] }} modes={['day']} />);

    // Assert
    expect(screen.getByText('View data table')).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveTextContent('1 h');
    unmount();
    render(<WorkCharts series={{ day: [point('d1', 0, 0)] }} modes={['day']} />);
    expect(screen.getByText('No hours in this period')).toBeInTheDocument();
  });
});

describe('SessionsTable', () => {
  it('flags automatic breaks, lateness and missed shifts, newest first', () => {
    // Arrange
    const sessions = [
      makeSession({ id: 'a', autoBreakMinutes: 60, paidMinutes: 420 }),
      makeSession({ id: 'b', date: '2026-10-06', clockIn: iso(10, 12, 6), clockOut: iso(16, 0, 6), late: true, lateMinutes: 12, breaks: [{ start: iso(13, 0, 6), end: iso(13, 30, 6) }], paidMinutes: 318 }),
    ];
    const shifts: WorkShift[] = [
      { id: 'sh1', date: '2026-10-08', start: '10:00', end: '18:00', status: 'completed' },
      { id: 'm', date: '2026-10-07', start: '17:00', end: '23:00', status: 'missed' },
    ];

    // Act
    render(<SessionsTable sessions={sessions} shifts={shifts} />);

    // Assert
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Auto');
    expect(rows[0]).toHaveTextContent('60 min, none recorded');
    expect(rows[1]).toHaveTextContent('Missed');
    expect(rows[1]).toHaveTextContent('6 h not worked (unpaid)');
    expect(rows[2]).toHaveTextContent('12 min late');
    expect(rows[2]).toHaveTextContent('13:00–13:30 (30 min)');
    expect(screen.getByText(/6 h missed \(unpaid\)/)).toBeInTheDocument();
  });

  it('pages older rows with "Show more"', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const sessions = Array.from({ length: 5 }, (_, i) => makeSession({ id: `s${i}`, date: `2026-10-0${i + 1}`, clockIn: iso(10, 0, i + 1) }));
    render(<SessionsTable sessions={sessions} shifts={[]} pageSize={2} />);
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(3);

    // Act
    await user.click(screen.getByRole('button', { name: 'Show more (3 older)' }));

    // Assert
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(5);
  });
});

describe('PresenceList', () => {
  const people: PresenceEntry[] = [
    { userId: 'u1', name: 'Will Waiter', role: 'waiter', state: 'off', since: null, todayShift: { start: '17:00', end: '23:00' } },
    { userId: 'u2', name: 'Wendy Server', role: 'waiter', state: 'working', since: iso(14, 5), todayShift: { start: '14:00', end: '20:00' } },
    { userId: 'u3', name: 'Zed Runner', role: 'waiter', state: 'on_break', since: iso(15, 30), todayShift: null },
  ];

  it('lists people working first with since-times, shifts and a "you" marker', () => {
    // Arrange / Act
    render(<PresenceList people={people} selfId="u1" />);

    // Assert
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Wendy Server');
    expect(items[0]).toHaveTextContent('Working · since 14:05');
    expect(items[0]).toHaveTextContent('Shift today 14:00–20:00');
    expect(items[1]).toHaveTextContent('On break · since 15:30');
    expect(items[1]).toHaveTextContent('No shift today');
    expect(items[2]).toHaveTextContent('Will Waiter(you)');
    expect(screen.getByText('1 working · 1 on break · 1 off')).toBeInTheDocument();
  });

  it('groups people by state on the board', () => {
    // Arrange / Act
    render(<PresenceList people={people} variant="board" />);

    // Assert
    expect(within(screen.getByRole('list', { name: 'Working' })).getByText('Wendy Server')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Off' })).getByText('Will Waiter')).toBeInTheDocument();
  });
});

describe('StaffOverviewTable', () => {
  function overview(withPay: boolean): WorkforceOverview {
    const pay = withPay ? makePay() : null;
    return {
      month: '2026-10',
      rows: [
        { user: { id: 'usr_waiter', name: 'Will Waiter', role: 'waiter', active: true }, state: 'working', summary: makeSummary(), pay },
        { user: { id: 'usr_chef', name: 'Carlos Chef', role: 'chef', active: true }, state: 'off', summary: makeSummary({ lateCount: 1 }), pay },
      ],
      totals: { paidMinutes: 7500, lateCount: 3, payroll: withPay ? 1980.8 : null },
      series: { day: [], week: [], hour: [] },
    };
  }

  it('hides every money column for managers', () => {
    // Arrange / Act
    render(<StaffOverviewTable overview={overview(false)} showPay={false} onSelect={vi.fn()} />);

    // Assert
    const table = screen.getByRole('table');
    expect(within(table).queryByText('Net pay')).not.toBeInTheDocument();
    expect(table.textContent).not.toMatch(/\$/);
    expect(within(table).getAllByRole('img', { name: /Will Waiter — / })).toHaveLength(3);
  });

  it('shows wage, tips, bonuses, net and payroll totals for admins and opens a drill-down', async () => {
    // Arrange
    const onSelect = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<StaffOverviewTable overview={overview(true)} showPay onSelect={onSelect} />);
    const table = screen.getByRole('table');

    // Act
    await user.click(within(table).getByRole('button', { name: 'Carlos Chef' }));

    // Assert
    expect(onSelect).toHaveBeenCalledWith('usr_chef');
    expect(within(table).getByText('Net pay')).toBeInTheDocument();
    const footer = table.querySelector('tfoot') as HTMLElement;
    expect(footer).toHaveTextContent('Total (2)');
    expect(footer).toHaveTextContent('$1980.80');
    expect(footer).toHaveTextContent('$420.80'); // tips 2 × 210.40
  });
});

describe('AdjustmentForm and WageEditor', () => {
  it('validates, confirms and submits a bonus', async () => {
    // Arrange
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup({ delay: null });
    render(<AdjustmentForm name="Will Waiter" onSubmit={onSubmit} defaultDate="2026-10-09" />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Add to pay' }));
    const errors = screen.getAllByRole('alert').map((a) => a.textContent);
    await user.type(screen.getByLabelText('Amount'), '40');
    await user.type(screen.getByLabelText('Reason'), 'Birthday');
    await user.click(screen.getByRole('button', { name: 'Add to pay' }));
    const dialog = screen.getByRole('dialog', { name: 'Add bonus' });
    await user.click(within(dialog).getByRole('button', { name: 'Add bonus' }));

    // Assert
    expect(errors).toEqual(['Enter an amount (negative for a correction).', 'Give a reason, e.g. "Eid bonus".']);
    expect(onSubmit).toHaveBeenCalledWith({ amount: 40, reason: 'Birthday', date: '2026-10-09' });
  });

  it('shows each validation error under its own field, tied to the input', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<AdjustmentForm name="Will Waiter" onSubmit={vi.fn()} defaultDate="2026-10-09" />);
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '' } });

    // Act
    await user.click(screen.getByRole('button', { name: 'Add to pay' }));

    // Assert
    const cases: [string, string][] = [
      ['Amount', 'Enter an amount (negative for a correction).'],
      ['Reason', 'Give a reason, e.g. "Eid bonus".'],
      ['Date', 'Pick a date.'],
    ];
    for (const [label, message] of cases) {
      const input = screen.getByLabelText(label);
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAccessibleDescription(message);
      expect(input.closest('div:not(.relative)')).toHaveTextContent(message);
    }
  });

  it('confirms a wage change before saving', async () => {
    // Arrange
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup({ delay: null });
    render(<WageEditor name="Will Waiter" wage={12} onSave={onSave} />);

    // Act
    await user.clear(screen.getByLabelText('Hourly wage'));
    await user.type(screen.getByLabelText('Hourly wage'), '13.5');
    await user.click(screen.getByRole('button', { name: 'Update wage' }));
    const dialog = screen.getByRole('dialog', { name: 'Change hourly wage' });
    await user.click(within(dialog).getByRole('button', { name: 'Change wage' }));

    // Assert
    expect(dialog).toHaveTextContent('from $12.00 to $13.50');
    expect(onSave).toHaveBeenCalledWith(13.5);
  });
});
