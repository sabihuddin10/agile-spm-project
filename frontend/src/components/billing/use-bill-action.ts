'use client';

import { useCallback, useState } from 'react';
import type { Invoice } from '@/types';
import { ApiError } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { useToast } from '@/components/ui/toast';

/**
 * Runs one billing API call: tracks which action is pending, hands the fresh
 * invoice back, and toasts the outcome. A 409 (bill changed elsewhere, already
 * settled, share already paid…) also triggers `onConflict` so the view reloads.
 */
export function useBillAction(onUpdated: (invoice: Invoice) => void, onConflict?: () => void) {
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);

  const run = useCallback(
    async (
      key: string,
      action: () => Promise<{ invoice: Invoice }>,
      success: string | ((invoice: Invoice) => string),
    ): Promise<boolean> => {
      setPending(key);
      try {
        const { invoice } = await action();
        onUpdated(invoice);
        toast(typeof success === 'function' ? success(invoice) : success, 'success');
        return true;
      } catch (err) {
        toast(errorMessage(err), 'error');
        if (err instanceof ApiError && err.status === 409) onConflict?.();
        return false;
      } finally {
        setPending(null);
      }
    },
    [onUpdated, onConflict, toast],
  );

  return { pending, run };
}
