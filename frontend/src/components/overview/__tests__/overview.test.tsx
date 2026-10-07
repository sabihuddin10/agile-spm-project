import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { LiveTile, TileGroup } from '@/components/overview/live-tile';
import { LowStockBanner } from '@/components/overview/low-stock-banner';
import { NextShiftCard } from '@/components/overview/next-shift-card';
import { OverviewDashboard } from '@/components/overview/overview-dashboard';
import { QuickLinks } from '@/components/overview/quick-links';
import { FloorWidgets, KitchenWidgets, TodaySummary } from '@/components/overview/role-widgets';
import { overviewAccess, useOverviewData } from '@/components/overview/use-overview-data';
import { analyticsApi, inventoryApi, orderApi, staffApi, tableApi } from '@/lib/api';
import type { AnalyticsSummary, InventoryItem, KitchenResponse, Order, Shift, Table, User } from '@/types';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    orderApi: { ...actual.orderApi, list: vi.fn(), kitchen: vi.fn() },
    tableApi: { ...actual.tableApi, list: vi.fn() },
    analyticsApi: { ...actual.analyticsApi, summary: vi.fn() },
    inventoryApi: { ...actual.inventoryApi, list: vi.fn() },
    staffApi: { ...actual.staffApi, myShifts: vi.fn() },
  };
});
const toastFn = vi.fn();
vi.mock('@/components/ui/toast', () => ({ useToast: () => toastFn }));

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 'u1', name: 'Jamie Manager', email: 'jamie@rest.test', role: 'manager', active: true, ...overrides };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return { id: 'o1', createdAt: '2026-10-01T10:00:00.000Z', waiterId: null, tableId: null, status: 'placed' } as Order;
}

function makeTable(overrides: Partial<Table> = {}): Table {
  return { id: 't1', number: 1, seats: 4, zone: 'Main', status: 'free', waiterId: null, held: false, reservedFor: null, ...overrides };
}

function makeInventoryItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'i1', name: 'Tomatoes', category: 'Produce', stock: 2, unit: 'kg', reorderLevel: 5, costPerUnit: 1.2,
    supplier: 'Acme', lowStock: true, health: 'low', usedBy: [], ...overrides,
  };
}

function makeShift(overrides: Partial<Shift> = {}): Shift {
  return {
    id: 's1', userId: 'u1', userName: 'Jamie Manager', role: 'manager', date: '2026-10-10', start: '09:00', end: '17:00',
    notes: '', status: 'scheduled', hours: 8, createdBy: 'u1', createdAt: '2026-10-01T00:00:00.000Z', ...overrides,
  };
}

function makeSummary(overrides: Partial<AnalyticsSummary> = {}): AnalyticsSummary {
  return { revenueToday: 500, ordersToday: 20, activeOrders: 3, openBills: 2, lowStock: 1, bookingsToday: 4, ...overrides };
}

function makeKitchen(overrides: Partial<KitchenResponse> = {}): KitchenResponse {
  return { queue: [], ready: [], delayMinutes: 15, ...overrides };
}

describe('LiveTile / TileGroup', () => {
  it('shows a label, value, hint and links to the given href', () => {
    // Arrange / Act
    render(<LiveTile href="/staff/orders" label="Needs confirmation" value={3} hint="Oldest placed 5m ago" />);

    // Assert
    expect(screen.getByText('Needs confirmation')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Oldest placed 5m ago')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/staff/orders');
  });

  it('shows a flag badge when given, and hides it while loading', () => {
    // Arrange / Act
    const { rerender } = render(
      <LiveTile href="/x" label="Ready to serve" value={2} flag={{ tone: 'emerald', label: 'At the pass' }} />,
    );

    // Assert
    expect(screen.getByText('At the pass')).toBeInTheDocument();

    // Act
    rerender(<LiveTile href="/x" label="Ready to serve" value={2} flag={{ tone: 'emerald', label: 'At the pass' }} loading />);

    // Assert
    expect(screen.queryByText('At the pass')).not.toBeInTheDocument();
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('groups tiles under a titled section', () => {
    // Arrange / Act
    render(
      <TileGroup title="Front of house">
        <LiveTile href="/a" label="A" value={1} />
      </TileGroup>,
    );

    // Assert
    expect(screen.getByRole('region', { name: 'Front of house' })).toBeInTheDocument();
  });
});

describe('LowStockBanner', () => {
  it('renders nothing when nothing is low on stock', () => {
    // Arrange / Act
    const { container } = render(<LowStockBanner items={[makeInventoryItem({ lowStock: false })]} />);

    // Assert
    expect(container).toBeEmptyDOMElement();
  });

  it('lists every low-stock ingredient, worst-stocked first, with a link to inventory', () => {
    // Arrange
    const worse = makeInventoryItem({ id: 'i1', name: 'Basil', stock: 1, reorderLevel: 10, lowStock: true });
    const better = makeInventoryItem({ id: 'i2', name: 'Flour', stock: 4, reorderLevel: 5, lowStock: true });

    // Act
    render(<LowStockBanner items={[better, worse]} />);

    // Assert
    const names = screen.getAllByText(/Basil|Flour/).map((el) => el.textContent);
    expect(screen.getByText(/2 ingredients are at or below the reorder level/)).toBeInTheDocument();
    expect(names[0]).toContain('Basil');
    expect(screen.getByRole('link', { name: 'Review inventory' })).toHaveAttribute('href', '/staff/inventory');
  });
});

describe('NextShiftCard', () => {
  const now = new Date('2026-10-10T08:00:00.000Z').getTime();

  it('shows a loading placeholder while shifts are not yet loaded', () => {
    // Arrange / Act
    render(<NextShiftCard shifts={null} loading now={now} />);

    // Assert
    expect(screen.getByLabelText('Loading shifts')).toBeInTheDocument();
  });

  it('shows a message when there are no shifts in the next 30 days', () => {
    // Arrange / Act
    render(<NextShiftCard shifts={[]} loading={false} now={now} />);

    // Assert
    expect(screen.getByText('No shifts scheduled in the next 30 days.')).toBeInTheDocument();
  });

  it("shows the next upcoming shift's time range and date", () => {
    // Arrange
    const shift = makeShift({ date: '2026-10-12', start: '09:00', end: '17:00' });

    // Act
    render(<NextShiftCard shifts={[shift]} loading={false} now={now} />);

    // Assert
    expect(screen.getByText('09:00–17:00')).toBeInTheDocument();
  });

  it('flags a shift happening today as "On shift now"', () => {
    // Arrange: `now` is 08:00 UTC — a shift that already started today.
    const shift = makeShift({ date: '2026-10-10', start: '07:00', end: '15:00' });

    // Act
    render(<NextShiftCard shifts={[shift]} loading={false} now={now} />);

    // Assert
    expect(screen.getByText('Today')).toBeInTheDocument();
  });
});

describe('QuickLinks', () => {
  it("only shows the sections the given role can access", () => {
    // Arrange / Act
    render(<QuickLinks role="chef" />);

    // Assert
    expect(screen.getByRole('link', { name: /Kitchen \(KDS\)/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Staff management/ })).not.toBeInTheDocument();
  });

  it('shows every section for an admin', () => {
    // Arrange / Act
    render(<QuickLinks role="admin" />);

    // Assert
    expect(screen.getByRole('link', { name: /Settings/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Staff management/ })).toBeInTheDocument();
  });
});

describe('role-widgets', () => {
  describe('FloorWidgets', () => {
    it("shows the signed-in waiter's own tables and ready-order count", () => {
      // Arrange
      const user = makeUser({ id: 'w1', role: 'waiter' });
      const myTable = makeTable({ id: 't1', number: 2, waiterId: 'w1', status: 'occupied' });
      const ready = [makeOrder({ id: 'o1', waiterId: 'w1' })];

      // Act
      render(<FloorWidgets user={user} placed={[]} ready={ready} tables={[myTable]} loading={false} now={Date.now()} />);

      // Assert
      expect(screen.getByText('Front of house')).toBeInTheDocument();
      expect(screen.getByText('T2 · 1 occupied')).toBeInTheDocument();
    });

    it('flags orders awaiting confirmation as needing action', () => {
      // Arrange
      const user = makeUser({ id: 'w1', role: 'waiter' });
      const placed = [makeOrder({ id: 'o1' }), makeOrder({ id: 'o2' })];

      // Act
      render(<FloorWidgets user={user} placed={placed} ready={[]} tables={[]} loading={false} now={Date.now()} />);

      // Assert
      expect(screen.getByText('Action needed')).toBeInTheDocument();
    });
  });

  describe('KitchenWidgets', () => {
    it('shows the queue length split between cooking and waiting', () => {
      // Arrange
      const kitchen = makeKitchen({
        queue: [
          { ...makeOrder({ id: 'o1' }), status: 'preparing', confirmedAt: '2026-10-01T09:00:00.000Z' } as Order,
          { ...makeOrder({ id: 'o2' }), status: 'confirmed', confirmedAt: '2026-10-01T09:00:00.000Z' } as Order,
        ],
      });

      // Act
      render(<KitchenWidgets kitchen={kitchen} loading={false} now={new Date('2026-10-01T09:05:00.000Z').getTime()} />);

      // Assert
      expect(screen.getByText('1 cooking · 1 waiting')).toBeInTheDocument();
    });

    it('flags tickets over the delay threshold', () => {
      // Arrange
      const kitchen = makeKitchen({
        delayMinutes: 10,
        queue: [{ ...makeOrder({ id: 'o1' }), status: 'confirmed', confirmedAt: '2026-10-01T09:00:00.000Z' } as Order],
      });

      // Act
      render(<KitchenWidgets kitchen={kitchen} loading={false} now={new Date('2026-10-01T09:20:00.000Z').getTime()} />);

      // Assert
      expect(screen.getByText('Over time')).toBeInTheDocument();
    });
  });

  describe('TodaySummary', () => {
    it("shows today's headline numbers", () => {
      // Arrange / Act
      render(<TodaySummary summary={makeSummary({ revenueToday: 1234.5 })} loading={false} />);

      // Assert
      expect(screen.getByText('$1234.50')).toBeInTheDocument();
      expect(screen.getByText('Today at a glance')).toBeInTheDocument();
    });

    it('flags low stock when above zero', () => {
      // Arrange / Act
      render(<TodaySummary summary={makeSummary({ lowStock: 2 })} loading={false} />);

      // Assert
      expect(screen.getByText('Reorder')).toBeInTheDocument();
    });
  });
});

describe('overviewAccess', () => {
  it('mirrors server role guards for each live widget', () => {
    // Arrange / Act / Assert
    expect(overviewAccess('waiter')).toEqual({ floor: true, kitchen: false, summary: false, inventory: false });
    expect(overviewAccess('chef')).toEqual({ floor: false, kitchen: true, summary: false, inventory: true });
    expect(overviewAccess('manager')).toEqual({ floor: true, kitchen: true, summary: true, inventory: true });
  });
});

describe('useOverviewData', () => {
  beforeEach(() => {
    toastFn.mockClear();
    vi.mocked(orderApi.list).mockResolvedValue({ orders: [makeOrder()] });
    vi.mocked(orderApi.kitchen).mockResolvedValue(makeKitchen());
    vi.mocked(tableApi.list).mockResolvedValue({ tables: [makeTable()], zones: [], statuses: [] });
    vi.mocked(analyticsApi.summary).mockResolvedValue({ summary: makeSummary() });
    vi.mocked(inventoryApi.list).mockResolvedValue({ inventory: [makeInventoryItem()], units: [], categories: [] });
    vi.mocked(staffApi.myShifts).mockResolvedValue({ shifts: [makeShift()], from: '2026-10-01', to: '2026-10-31' });
  });

  it('loads every dataset a manager can access', async () => {
    // Arrange / Act
    const { result } = renderHook(() => useOverviewData(makeUser({ role: 'manager' })));

    // Assert
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.data.placed).toHaveLength(1);
    expect(result.current.data.kitchen).not.toBeNull();
    expect(result.current.data.summary).not.toBeNull();
    expect(result.current.data.inventory).not.toBeNull();
    expect(result.current.updatedAt).not.toBeNull();
  });

  it("skips datasets the role can't access, but always loads the user's shifts", async () => {
    // Arrange / Act
    const { result } = renderHook(() => useOverviewData(makeUser({ id: 'w1', role: 'waiter' })));

    // Assert
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.data.placed).toHaveLength(1);
    expect(result.current.data.kitchen).toBeNull();
    expect(result.current.data.summary).toBeNull();
    expect(result.current.data.inventory).toBeNull();
    expect(result.current.data.shifts).toHaveLength(1);
  });

  it('toasts once on failure and keeps the last good values', async () => {
    // Arrange
    vi.mocked(staffApi.myShifts).mockRejectedValue(new Error('Network error'));

    // Act
    const { result } = renderHook(() => useOverviewData(makeUser({ role: 'manager' })));

    // Assert
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(toastFn).toHaveBeenCalledTimes(1);
    expect(result.current.updatedAt).toBeNull();
  });
});

describe('OverviewDashboard', () => {
  it("greets the user by first name and shows their role", () => {
    // Arrange / Act
    render(<OverviewDashboard user={makeUser({ name: 'Jamie Manager', role: 'manager' })} />);

    // Assert
    expect(screen.getByText(/Jamie/)).toBeInTheDocument();
    expect(screen.getByText('Manager')).toBeInTheDocument();
  });

  it('shows "Connecting…" before the first successful refresh', () => {
    // Arrange
    vi.mocked(orderApi.list).mockReturnValue(new Promise(() => {}));
    vi.mocked(tableApi.list).mockReturnValue(new Promise(() => {}));
    vi.mocked(staffApi.myShifts).mockReturnValue(new Promise(() => {}));

    // Act
    render(<OverviewDashboard user={makeUser({ role: 'waiter' })} />);

    // Assert
    expect(screen.getByText('Connecting…')).toBeInTheDocument();
  });

  it('shows the low-stock banner and quick links once data has loaded for a manager', async () => {
    // Arrange
    vi.mocked(orderApi.list).mockResolvedValue({ orders: [] });
    vi.mocked(orderApi.kitchen).mockResolvedValue(makeKitchen());
    vi.mocked(tableApi.list).mockResolvedValue({ tables: [], zones: [], statuses: [] });
    vi.mocked(analyticsApi.summary).mockResolvedValue({ summary: makeSummary() });
    vi.mocked(inventoryApi.list).mockResolvedValue({ inventory: [makeInventoryItem({ lowStock: true })], units: [], categories: [] });
    vi.mocked(staffApi.myShifts).mockResolvedValue({ shifts: [], from: '2026-10-01', to: '2026-10-31' });

    // Act
    render(<OverviewDashboard user={makeUser({ role: 'manager' })} />);

    // Assert
    expect(await screen.findByText(/at or below the reorder level/)).toBeInTheDocument();
    expect(screen.getByText('Quick links')).toBeInTheDocument();
    expect(screen.getByText('Today at a glance')).toBeInTheDocument();
  });

  it("doesn't show manager-only widgets for a waiter", async () => {
    // Arrange
    vi.mocked(orderApi.list).mockResolvedValue({ orders: [] });
    vi.mocked(tableApi.list).mockResolvedValue({ tables: [], zones: [], statuses: [] });
    vi.mocked(staffApi.myShifts).mockResolvedValue({ shifts: [], from: '2026-10-01', to: '2026-10-31' });

    // Act
    render(<OverviewDashboard user={makeUser({ id: 'w1', role: 'waiter' })} />);

    // Assert
    await waitFor(() => expect(screen.getByText('Front of house')).toBeInTheDocument());
    expect(screen.queryByText('Today at a glance')).not.toBeInTheDocument();
    expect(screen.queryByText('Kitchen')).not.toBeInTheDocument();
  });
});
