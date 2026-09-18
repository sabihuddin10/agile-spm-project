'use client';

import { useEffect, useState } from 'react';
import { customerApi } from '@/lib/api';
import type { Customer } from '@/types';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

export function OrderHistory() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    customerApi
      .me()
      .then((res) => {
        if (cancelled) return;
        setCustomer(res.customer);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load orders.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Card>
        <Spinner label="Loading order history…" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <p className="text-sm text-red-400">{error}</p>
      </Card>
    );
  }

  if (!customer) return null;

  const orders = customer.orderHistory ?? [];

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl font-semibold tracking-tight text-bone">
          Order history
        </h3>
        <span className="rounded-full border border-char-hairline bg-char-deep px-2.5 py-0.5 text-xs text-bone-faint">
          {orders.length} {orders.length === 1 ? 'order' : 'orders'}
        </span>
      </div>

      {orders.length === 0 ? (
        <p className="mt-4 text-sm text-bone-dim">
          No orders yet. Head over to the menu and place your first one.
        </p>
      ) : (
        <div className="mt-5 overflow-hidden rounded-xl border border-char-hairline">
          <table className="w-full text-left text-sm">
            <thead className="bg-char-deep">
              <tr>
                <th className="px-4 py-2.5 font-medium text-bone-faint">Date</th>
                <th className="px-4 py-2.5 font-medium text-bone-faint">Items</th>
                <th className="px-4 py-2.5 text-right font-medium text-bone-faint">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-char-hairline bg-char-raised">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3 text-bone-dim">{o.date}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {o.items.map((i) => (
                        <span key={i} className="chip chip-muted">
                          {i}
                        </span>
                      ))}
                      {o.pointsEarned ? (
                        <span className="chip chip-diet">+{o.pointsEarned} pts</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-bone">${o.total.toFixed(2)}</span>
                    {o.paymentMethod ? (
                      <span className="block text-xs capitalize text-bone-faint">
                        {o.paymentMethod}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {orders.length > 0 ? (
        <p className="mt-4 text-xs text-bone-faint">
          Spending: ${customer.totalSpend?.toFixed(2) ?? '0.00'} total, {customer.loyaltyPoints}{' '}
          Flame Points
        </p>
      ) : null}
    </Card>
  );
}