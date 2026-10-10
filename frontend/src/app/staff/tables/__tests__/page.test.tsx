import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FloorPlanPage from '@/app/staff/tables/page';
import { useAuth } from '@/context/auth-context';
import { tableApi } from '@/lib/api';
import type { Table, User } from '@/types';

const toastFn = vi.fn();
vi.mock('@/components/ui/toast', () => ({ useToast: () => toastFn }));
vi.mock('@/context/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/components/layout/staff-layout', () => ({ StaffLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    tableApi: { ...actual.tableApi, list: vi.fn(), update: vi.fn(), create: vi.fn(), remove: vi.fn() },
  };
});
vi.mock('@/components/tables/floor-legend', () => ({ FloorLegend: () => <div data-testid="floor-legend" /> }));
vi.mock('@/components/tables/table-tile', () => ({
  TableTile: ({ table, canEditLayout, onStatus, onToggleHold, onTake, onEdit, onRemove }: {
    table: Table;
    canEditLayout: boolean;
    onStatus: (s: string) => void;
    onToggleHold: () => void;
    onTake: () => void;
    onEdit: () => void;
    onRemove: () => void;
  }) => (
    <div data-testid={`table-tile-${table.id}`}>
      <span>T{table.number}</span>
      <button onClick={() => onStatus('cleaning')}>Mark cleaning</button>
      <button onClick={onToggleHold}>Toggle hold</button>
      <button onClick={onTake}>Take table</button>
      {canEditLayout ? <button onClick={onEdit}>Edit</button> : null}
      {canEditLayout ? <button onClick={onRemove}>Remove</button> : null}
    </div>
  ),
}));
vi.mock('@/components/tables/table-form', () => ({
  TableForm: ({ onSubmit, onCancel }: { onSubmit: (v: { number: number; seats: number; zone: string }) => void; onCancel: () => void }) => (
    <div data-testid="table-form">
      <button onClick={() => onSubmit({ number: 9, seats: 2, zone: 'Main' })}>Save table</button>
      <button onClick={onCancel}>Cancel form</button>
    </div>
  ),
}));

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 'u1', name: 'Jamie', email: 'jamie@rest.test', role: 'manager', active: true, ...overrides };
}

function makeTable(overrides: Partial<Table> = {}): Table {
  return { id: 't1', number: 1, seats: 4, zone: 'Main', status: 'free', waiterId: null, held: false, reservedFor: null, ...overrides };
}

describe('FloorPlanPage', () => {
  beforeEach(() => {
    toastFn.mockClear();
    vi.mocked(tableApi.update).mockResolvedValue({ table: makeTable() });
    vi.mocked(tableApi.create).mockResolvedValue({ table: makeTable({ id: 't_new' }) });
    vi.mocked(tableApi.remove).mockResolvedValue({ deleted: true });
  });

  it('shows a loading spinner, then groups tables by zone', async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(tableApi.list).mockResolvedValue({ tables: [makeTable({ zone: 'Main' })], zones: ['Main'], statuses: ['free'] });

    // Act
    render(<FloorPlanPage />);

    // Assert
    expect(screen.getByText('Loading floor plan…')).toBeInTheDocument();
    expect(await screen.findByText('Main')).toBeInTheDocument();
    expect(screen.getByTestId('table-tile-t1')).toBeInTheDocument();
  });

  it('shows "+ Add table" only for a role that can edit the floor layout', async () => {
    // Arrange
    vi.mocked(tableApi.list).mockResolvedValue({ tables: [], zones: [], statuses: [] });
    vi.mocked(useAuth).mockReturnValue({ user: makeUser({ role: 'waiter' }) } as unknown as ReturnType<typeof useAuth>);

    // Act
    render(<FloorPlanPage />);
    await screen.findByText('No tables yet');

    // Assert
    expect(screen.queryByRole('button', { name: '+ Add table' })).not.toBeInTheDocument();
  });

  it('changes a table status and shows a success toast', async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(tableApi.list).mockResolvedValue({ tables: [makeTable()], zones: ['Main'], statuses: ['free'] });
    const user = userEvent.setup({ delay: null });
    render(<FloorPlanPage />);
    await screen.findByTestId('table-tile-t1');

    // Act
    await user.click(screen.getByRole('button', { name: 'Mark cleaning' }));

    // Assert
    await waitFor(() => expect(tableApi.update).toHaveBeenCalledWith('t1', { status: 'cleaning' }));
    expect(toastFn).toHaveBeenCalledWith(expect.stringContaining('marked cleaning'), 'success');
  });

  it('adds a new table via the form and reloads the floor plan', async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(tableApi.list).mockResolvedValue({ tables: [], zones: [], statuses: [] });
    const user = userEvent.setup({ delay: null });
    render(<FloorPlanPage />);
    await screen.findByRole('button', { name: '+ Add table' });

    // Act
    await user.click(screen.getByRole('button', { name: '+ Add table' }));
    await user.click(screen.getByRole('button', { name: 'Save table' }));

    // Assert
    await waitFor(() => expect(tableApi.create).toHaveBeenCalledWith({ number: 9, seats: 2, zone: 'Main' }));
    expect(screen.queryByTestId('table-form')).not.toBeInTheDocument();
  });

  it('asks in a dialog before removing a table, then removes it', async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(tableApi.list).mockResolvedValue({ tables: [makeTable()], zones: ['Main'], statuses: ['free'] });
    const user = userEvent.setup({ delay: null });
    render(<FloorPlanPage />);
    await screen.findByTestId('table-tile-t1');

    // Act
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    // Assert
    expect(screen.getByRole('dialog', { name: 'Remove table 1?' })).toBeInTheDocument();
    expect(tableApi.remove).not.toHaveBeenCalled();

    // Act
    await user.click(screen.getByRole('button', { name: 'Remove table' }));

    // Assert
    await waitFor(() => expect(tableApi.remove).toHaveBeenCalledWith('t1'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Remove table 1?' })).not.toBeInTheDocument());
  });

  it('keeps the table when the removal is cancelled', async () => {
    // Arrange
    vi.mocked(tableApi.remove).mockClear();
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(tableApi.list).mockResolvedValue({ tables: [makeTable()], zones: ['Main'], statuses: ['free'] });
    const user = userEvent.setup({ delay: null });
    render(<FloorPlanPage />);
    await screen.findByTestId('table-tile-t1');
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    // Act
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    expect(screen.queryByRole('dialog', { name: 'Remove table 1?' })).not.toBeInTheDocument();
    expect(tableApi.remove).not.toHaveBeenCalled();
  });
});
