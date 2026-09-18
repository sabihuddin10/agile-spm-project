'use client';

import { useCallback, useEffect, useState } from 'react';
import { StaffLayout } from '@/components/layout/staff-layout';
import { billingApi } from '@/lib/api';
import type { Bill } from '@/types';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/spinner';

export default function BillingPage() {
  const toast = useToast();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await billingApi.list();
      setBills(res.bills);
    } catch {
      toast('Failed to load bills.', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function pay(bill: Bill) {
    try {
      await billingApi.pay(bill.id);
      toast(`Bill #${bill.number} marked as paid.`, 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Payment failed.', 'error');
    }
  }

  const open = bills.filter((b) => !b.paid);
  const paid = bills.filter((b) => b.paid);
  const openTotal = open.reduce((s, b) => s + b.total, 0);
  const paidTotal = paid.reduce((s, b) => s + b.total, 0);

  function Row({ bill }: { bill: Bill }) {
    return (
      <tr>
        <td className="font-mono text-stone-500">#{bill.number}</td>
        <td className="capitalize">{bill.type}</td>
        <td>{bill.tableNumber ?? '—'}</td>
        <td>
          <Badge tone={bill.paid ? 'emerald' : 'amber'}>{bill.paid ? 'Paid' : bill.status}</Badge>
        </td>
        <td className="text-stone-500">${bill.subtotal.toFixed(2)}</td>
        <td className="text-stone-500">${bill.tax.toFixed(2)}</td>
        <td className="font-semibold">${bill.total.toFixed(2)}</td>
        <td className="text-right">
          {!bill.paid ? (
            <button className="btn-primary !py-1.5 text-xs" onClick={() => pay(bill)}>
              Mark paid
            </button>
          ) : null}
        </td>
      </tr>
    );
  }

  return (
    <StaffLayout>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold">Billing</h1>
        <Badge tone="blue">Sprint 5 · Live</Badge>
        <div className="ml-auto flex gap-2 text-sm">
          <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-amber-700">Open: ${openTotal.toFixed(2)}</span>
          <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-emerald-700">Paid: ${paidTotal.toFixed(2)}</span>
        </div>
      </div>

      {loading ? (
        <Spinner label="Loading bills…" />
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="table-base">
            <thead>
              <tr>
                <th>Bill</th>
                <th>Type</th>
                <th>Table</th>
                <th>Status</th>
                <th>Subtotal</th>
                <th>Tax (10%)</th>
                <th>Total</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => (
                <Row key={b.id} bill={b} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </StaffLayout>
  );
}