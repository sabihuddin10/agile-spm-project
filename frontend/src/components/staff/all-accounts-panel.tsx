'use client';

import { useCallback, useEffect, useState } from 'react';
import type { User } from '@/types';
import { authApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { AccountTable } from '@/components/staff/account-table';

/**
 * Every account on the platform, customers included (admin only), with the same
 * role (US9.2) and suspend/remove (US9.4) controls as the team roster.
 */
export function AllAccountsPanel({ onChanged }: { onChanged?: () => unknown }) {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { users: list } = await authApi.users();
      setUsers(list);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function changed() {
    await load();
    await onChanged?.();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-600">
        Includes customer accounts. Promote a customer to a staff role, or demote staff to customer to remove console
        access. Changes apply on the user&apos;s next request; suspended or removed users are signed out on their next
        request.
      </p>
      <Card className="p-0">
        {loading ? <Spinner label="Loading accounts…" /> : <AccountTable users={users} onChanged={changed} searchable />}
      </Card>
    </div>
  );
}
