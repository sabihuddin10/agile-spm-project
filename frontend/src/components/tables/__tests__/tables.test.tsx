/**
 * Tests for src/components/tables: floor-legend, table-form and table-tile.
 * (status-style has its own test file in this folder.)
 *
 * Every test follows Arrange-Act-Assert, with each phase commented.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FloorLegend } from '@/components/tables/floor-legend';
import { TableForm } from '@/components/tables/table-form';
import { TableTile } from '@/components/tables/table-tile';
import { dotClass, tileClass } from '@/components/tables/status-style';
import type { Table, TableStatus } from '@/types';

const ALL_STATUSES: TableStatus[] = ['free', 'occupied', 'reserved', 'cleaning'];

function makeTable(overrides: Partial<Table> = {}): Table {
  return {
    id: 'tbl_1',
    number: 1,
    seats: 4,
    zone: 'Main',
    status: 'free',
    waiterId: null,
    waiterName: null,
    held: false,
    reservedFor: null,
    activeOrders: [],
    nextReservation: null,
    ...overrides,
  };
}

/* ------------------------------------------------------------ floor-legend */

describe('FloorLegend', () => {
  it('lists every table status with its colour swatch and a live count', () => {
    // Arrange
    const tables = [
      makeTable({ id: 'a', number: 1, status: 'free' }),
      makeTable({ id: 'b', number: 2, status: 'free' }),
      makeTable({ id: 'c', number: 3, status: 'occupied' }),
      makeTable({ id: 'd', number: 4, status: 'cleaning' }),
    ];

    // Act
    render(<FloorLegend tables={tables} statuses={ALL_STATUSES} />);

    // Assert
    const legend = screen.getByLabelText('Table status legend');
    const expected: Record<TableStatus, [string, string]> = {
      free: ['Free', '2'],
      occupied: ['Occupied', '1'],
      reserved: ['Reserved', '0'],
      cleaning: ['Cleaning', '1'],
    };
    for (const status of ALL_STATUSES) {
      const [label, count] = expected[status];
      const chip = within(legend).getByText(label).parentElement as HTMLElement;
      expect(chip).toHaveTextContent(`${label}${count}`);
      const swatch = chip.querySelector('[aria-hidden="true"]') as HTMLElement;
      expect(swatch.className).toContain(dotClass(status));
    }
  });

  it('shows the held count and the floor totals of tables and seats', () => {
    // Arrange
    const tables = [
      makeTable({ id: 'a', seats: 2, held: true }),
      makeTable({ id: 'b', seats: 6 }),
    ];

    // Act
    render(<FloorLegend tables={tables} statuses={ALL_STATUSES} />);

    // Assert
    expect(screen.getByText('Held').parentElement).toHaveTextContent('Held 1');
    expect(screen.getByText('2 tables · 8 seats')).toBeInTheDocument();
  });

  it('hides the held chip when no table is held', () => {
    // Arrange
    const tables = [makeTable()];

    // Act
    render(<FloorLegend tables={tables} statuses={ALL_STATUSES} />);

    // Assert
    expect(screen.queryByText('Held')).not.toBeInTheDocument();
  });
});

/* -------------------------------------------------------------- table-form */

describe('TableForm', () => {
  function renderForm(props: Partial<React.ComponentProps<typeof TableForm>> = {}) {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const view = render(
      <TableForm
        initial={null}
        zones={['Main', 'Patio']}
        takenNumbers={[1, 2, 5]}
        submitting={false}
        onSubmit={onSubmit}
        onCancel={onCancel}
        {...props}
      />,
    );
    return { onSubmit, onCancel, unmount: view.unmount };
  }

  it('suggests the next free number and adds a table', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const { onSubmit } = renderForm();
    expect(screen.getByLabelText('Table number')).toHaveValue(6);

    // Act
    await user.clear(screen.getByLabelText('Seats'));
    await user.type(screen.getByLabelText('Seats'), '2');
    await user.selectOptions(screen.getByLabelText('Zone'), 'Patio');
    await user.click(screen.getByRole('button', { name: 'Add table' }));

    // Assert
    expect(onSubmit).toHaveBeenCalledWith({ number: 6, seats: 2, zone: 'Patio' });
  });

  it('rejects a number already used by another table', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const { onSubmit } = renderForm();

    // Act
    await user.clear(screen.getByLabelText('Table number'));
    await user.type(screen.getByLabelText('Table number'), '5');
    await user.click(screen.getByRole('button', { name: 'Add table' }));

    // Assert
    expect(screen.getByText('Table 5 already exists.')).toBeInTheDocument();
    expect(screen.getByLabelText('Table number')).toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('edits an existing table, keeping its own number', async () => {
    // Arrange — takenNumbers excludes the table being edited
    const user = userEvent.setup({ delay: null });
    const initial = makeTable({ id: 't3', number: 3, seats: 4, zone: 'Main' });
    const { onSubmit } = renderForm({ initial, takenNumbers: [1, 2] });
    expect(screen.getByLabelText('Table number')).toHaveValue(3);

    // Act
    await user.clear(screen.getByLabelText('Seats'));
    await user.type(screen.getByLabelText('Seats'), '8');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    // Assert
    expect(onSubmit).toHaveBeenCalledWith({ number: 3, seats: 8, zone: 'Main' });
  });

  it('caps the table number at 9999 (server limit) and keeps "Add table" disabled', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const { onSubmit } = renderForm();
    const number = screen.getByLabelText('Table number');

    // Act
    await user.clear(number);
    await user.type(number, '10000');

    // Assert
    expect(number).toHaveAccessibleDescription('Table numbers go up to 9999.');
    expect(number).toHaveAttribute('max', '9999');
    expect(screen.getByRole('button', { name: 'Add table' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add table' })).toHaveAccessibleDescription(
      'Complete these fields to continue: Table number.',
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('validates the number and seat range', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const { onSubmit } = renderForm();

    // Act
    await user.clear(screen.getByLabelText('Table number'));
    await user.type(screen.getByLabelText('Table number'), '0');
    await user.clear(screen.getByLabelText('Seats'));
    await user.type(screen.getByLabelText('Seats'), '21');
    await user.click(screen.getByRole('button', { name: 'Add table' }));

    // Assert
    expect(screen.getByText('Enter a whole number of 1 or more.')).toBeInTheDocument();
    expect(screen.getByText('Seats must be between 1 and 20.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('requires a name when creating a new zone, then submits it trimmed', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const { onSubmit } = renderForm();
    await user.selectOptions(screen.getByLabelText('Zone'), '+ New zone…');

    // Act
    await user.click(screen.getByRole('button', { name: 'Add table' }));

    // Assert
    expect(screen.getByText('Choose a zone or type a new one.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    // Act
    await user.type(screen.getByLabelText('New zone name'), '  Terrace  ');
    await user.click(screen.getByRole('button', { name: 'Add table' }));

    // Assert
    expect(onSubmit).toHaveBeenCalledWith({ number: 6, seats: 4, zone: 'Terrace' });
  });

  it('cancels, and disables both buttons while saving', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const { onCancel, unmount } = renderForm();

    // Act
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    expect(onCancel).toHaveBeenCalledTimes(1);

    // Arrange / Act — re-render in the saving state
    unmount();
    renderForm({ submitting: true });

    // Assert
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});

/* -------------------------------------------------------------- table-tile */

describe('TableTile', () => {
  function renderTile(table: Table, props: Partial<React.ComponentProps<typeof TableTile>> = {}) {
    const handlers = {
      onStatus: vi.fn(),
      onToggleHold: vi.fn(),
      onTake: vi.fn(),
      onEdit: vi.fn(),
      onRemove: vi.fn(),
    };
    const view = render(
      <TableTile table={table} currentUserId="u_me" canEditLayout={false} busy={false} {...handlers} {...props} />,
    );
    return { ...handlers, unmount: view.unmount };
  }

  it.each(ALL_STATUSES)('renders the %s status label and colour', (status) => {
    // Arrange
    const table = makeTable({ number: 7, status });
    const label = { free: 'Free', occupied: 'Occupied', reserved: 'Reserved', cleaning: 'Cleaning' }[status];

    // Act
    renderTile(table);

    // Assert
    const tile = screen.getByRole('article', { name: `Table 7, ${label}` });
    for (const cls of tileClass(status).split(' ')) expect(tile.className).toContain(cls);
    expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: label })).toBeDisabled();
  });

  it('shows seats, the waiter and each active order with its status and total', () => {
    // Arrange
    const table = makeTable({
      status: 'occupied',
      seats: 6,
      waiterId: 'u_other',
      waiterName: 'Marco',
      activeOrders: [
        { id: 'o1', number: 42, status: 'preparing', total: 37.5, paymentStatus: 'unpaid' },
        { id: 'o2', number: 43, status: 'served', total: 12, paymentStatus: 'unpaid' },
      ],
    });

    // Act
    renderTile(table);

    // Assert
    expect(screen.getByText('6 seats')).toBeInTheDocument();
    expect(screen.getByText('Marco')).toBeInTheDocument();
    const first = screen.getByText('#42').closest('a') as HTMLElement;
    expect(first).toHaveAttribute('href', '/staff/orders#order-42');
    expect(first).toHaveTextContent('#42 · Preparing$37.50');
    expect(screen.getByText('#43').closest('a')).toHaveTextContent('#43 · Served$12.00');
  });

  it('says when there are no active orders or waiter, and shows the next booking', () => {
    // Arrange
    const table = makeTable({
      status: 'reserved',
      nextReservation: { id: 'r1', customerName: 'Ana Silva', time: '19:30', partySize: 1, status: 'confirmed', late: true },
    });

    // Act
    renderTile(table);

    // Assert
    expect(screen.getByText('No active orders')).toBeInTheDocument();
    expect(screen.getByText('No waiter assigned')).toBeInTheDocument();
    expect(screen.getByText('Next booking today')).toBeInTheDocument();
    expect(screen.getByText(/Ana Silva/)).toHaveTextContent('19:30 · Ana Silva · 1 guest');
    expect(screen.getByText('Late')).toBeInTheDocument();
  });

  it('calls back for status changes, hold and take-over', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const handlers = renderTile(makeTable({ status: 'free' }));

    // Act
    await user.click(screen.getByRole('button', { name: 'Cleaning' }));
    await user.click(screen.getByRole('button', { name: 'Hold' }));
    await user.click(screen.getByRole('button', { name: 'Take this table' }));

    // Assert
    expect(handlers.onStatus).toHaveBeenCalledWith('cleaning');
    expect(handlers.onToggleHold).toHaveBeenCalledTimes(1);
    expect(handlers.onTake).toHaveBeenCalledTimes(1);
  });

  it('labels the current user as the waiter and hides take-over for their own table', () => {
    // Arrange
    const table = makeTable({ waiterId: 'u_me', waiterName: 'Me Myself', held: true });

    // Act
    renderTile(table);

    // Assert
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Take this table' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Release hold' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('offers edit/remove only to layout editors', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const handlers = renderTile(makeTable({ number: 9 }), { canEditLayout: true });

    // Act
    await user.click(screen.getByRole('button', { name: 'Edit table 9' }));
    await user.click(screen.getByRole('button', { name: 'Remove table 9' }));

    // Assert
    expect(handlers.onEdit).toHaveBeenCalledTimes(1);
    expect(handlers.onRemove).toHaveBeenCalledTimes(1);

    // Arrange / Act — a non-editor sees neither
    handlers.unmount();
    renderTile(makeTable({ number: 9 }), { canEditLayout: false });

    // Assert
    expect(screen.queryByRole('button', { name: 'Edit table 9' })).not.toBeInTheDocument();
  });

  it('disables every control while busy', () => {
    // Arrange / Act
    renderTile(makeTable(), { busy: true, canEditLayout: true });

    // Assert
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
  });
});
