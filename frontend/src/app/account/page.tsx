'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Customer } from '@/types';
import { customerApi } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { errorMessage, money } from '@/lib/format';
import { StorefrontShell } from '@/components/layout/storefront-shell';
import { MyOrders } from '@/components/account/my-orders';
import { ProfileEditor } from '@/components/account/profile-editor';
import { MyReservations } from '@/components/account/my-reservations';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

/**
 * My account: live order tracking and past orders (US3.3, US3.4, US1.4), the
 * self-service profile with preferences and Flame Points (US1.2, US1.5), and
 * bookings (US7.4).
 */
export default function AccountPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isCustomer = user?.role === 'customer';

  useEffect(() => {
    if (!loading && user && !isCustomer) router.replace('/staff');
  }, [loading, user, isCustomer, router]);

  const loadCustomer = useCallback(async () => {
    try {
      const res = await customerApi.me();
      setCustomer(res.customer);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Could not load your profile.'));
    }
  }, []);

  useEffect(() => {
    if (isCustomer) loadCustomer();
  }, [isCustomer, loadCustomer]);

  if (loading || !user || !isCustomer) {
    return (
      <StorefrontShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Spinner label="Loading account…" />
        </div>
      </StorefrontShell>
    );
  }

  return (
    <StorefrontShell>
      <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 md:py-10">
        <header className="mb-6 border-b border-char-hairline pb-6 md:mb-8 md:pb-8">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-bone">Your account</h1>
          <p className="mt-3 text-sm text-bone-dim">
            Track your orders, and keep your allergies and contact details up to date so the kitchen cooks for you.
          </p>
          {customer ? (
            <dl className="stat-row mt-5 grid grid-cols-3 gap-2 sm:gap-3 md:mt-6">
              <Stat label="Flame Points" value={String(customer.loyaltyPoints)} accent />
              <Stat label="Orders" value={String(customer.orderCount ?? customer.orderHistory?.length ?? 0)} />
              <Stat label="Total spend" value={money(customer.totalSpend)} />
            </dl>
          ) : null}
        </header>

        <div className="space-y-4 sm:space-y-6 md:space-y-8">
          <MyOrders onActivity={loadCustomer} />

          {customer ? (
            <ProfileEditor key={customer.id} customer={customer} onSaved={setCustomer} />
          ) : (
            <Card>
              {error ? (
                <p className="text-sm text-red-300">
                  {error}{' '}
                  <button type="button" className="underline underline-offset-2" onClick={loadCustomer}>
                    Try again
                  </button>
                </p>
              ) : (
                <Spinner label="Loading your profile…" />
              )}
            </Card>
          )}

          <MyReservations />
        </div>
      </section>
    </StorefrontShell>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="stat flex min-w-0 flex-col-reverse rounded-xl border border-char-hairline bg-char-raised px-4 py-3 text-center">
      <dt className="stat-label mt-0.5 text-xs font-medium uppercase tracking-wide text-bone-faint">{label}</dt>
      <dd className={`stat-value font-display text-2xl font-semibold tabular-nums ${accent ? 'text-ember-soft' : 'text-bone'}`}>{value}</dd>
    </div>
  );
}
