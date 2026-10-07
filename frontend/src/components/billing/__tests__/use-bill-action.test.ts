import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBillAction } from '@/components/billing/use-bill-action';
import { ApiError } from '@/lib/api';
import type { Invoice } from '@/types';

const toast = vi.fn();
vi.mock('@/components/ui/toast', () => ({ useToast: () => toast }));

describe('useBillAction', () => {
  it('reports the updated invoice and a success toast', async () => {
    // Arrange
    const onUpdated = vi.fn();
    const invoice = { id: 'inv_1', number: 1 } as Invoice;
    const { result } = renderHook(() => useBillAction(onUpdated));

    // Act
    let ok: boolean;
    await act(async () => {
      ok = await result.current.run('pay-card', async () => ({ invoice }), 'Paid.');
    });

    // Assert
    expect(ok!).toBe(true);
    expect(onUpdated).toHaveBeenCalledWith(invoice);
    expect(toast).toHaveBeenCalledWith('Paid.', 'success');
    expect(result.current.pending).toBe(null);
  });

  it('supports a success message derived from the invoice', async () => {
    // Arrange
    const invoice = { id: 'inv_1', number: 42 } as Invoice;
    const { result } = renderHook(() => useBillAction(vi.fn()));

    // Act
    await act(async () => {
      await result.current.run('tip-10', async () => ({ invoice }), (inv) => `Bill #${inv.number} updated.`);
    });

    // Assert
    expect(toast).toHaveBeenCalledWith('Bill #42 updated.', 'success');
  });

  it('toasts the error and triggers onConflict on a 409', async () => {
    // Arrange
    const onConflict = vi.fn();
    const { result } = renderHook(() => useBillAction(vi.fn(), onConflict));

    // Act
    let ok: boolean;
    await act(async () => {
      ok = await result.current.run('pay-card', async () => {
        throw new ApiError('Bill already settled.', 409, null);
      }, 'Paid.');
    });

    // Assert
    expect(ok!).toBe(false);
    expect(toast).toHaveBeenCalledWith('Bill already settled.', 'error');
    expect(onConflict).toHaveBeenCalled();
  });

  it('does not call onConflict for a non-409 failure', async () => {
    // Arrange
    const onConflict = vi.fn();
    const { result } = renderHook(() => useBillAction(vi.fn(), onConflict));

    // Act
    await act(async () => {
      await result.current.run('pay-card', async () => {
        throw new Error('network down');
      }, 'Paid.');
    });

    // Assert
    expect(onConflict).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('network down', 'error');
  });
});
