'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Invoice, Order } from '@/types';
import { billingApi, orderApi } from '@/lib/api';
import { usePolling, useNow } from '@/hooks/use-polling';
import { errorMessage } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { Receipt } from '@/components/billing/receipt';
import { ActiveOrderCard } from '@/components/account/active-order-card';
import { OrderHistory } from '@/components/account/order-history';
import { ORDER_PLACED_EVENT } from '@/components/storefront/checkout-estimate';

const ACTIVE = ['placed', 'confirmed', 'preparing', 'ready', 'served'];

/**
 * "Your orders" on My account: live tracking of active orders polled every 10 s
 * (US3.3, US3.4), cancel while still 'placed', and past orders with receipts (US1.4).
 */
export function MyOrders({ onActivity }: { onActivity?: () => void }) {
  const toast = useToast();
  const now = useNow(30000);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Invoice | null>(null);
  const [receiptLoadingId, setReceiptLoadingId] = useState<string | null>(null);
  const signature = useRef('');
  const scrolled = useRef(false);
  const activityRef = useRef(onActivity);

  useEffect(() => {
    activityRef.current = onActivity;
  }, [onActivity]);

  const load = useCallback(async () => {
    try {
      const res = await orderApi.mine();
      setOrders(res.orders);
      setError(null);
      // Status or payment changes can move the loyalty balance — let the page refresh it.
      const sig = res.orders.map((o) => `${o.id}:${o.status}:${o.paymentStatus}`).join('|');
      if (signature.current && sig !== signature.current) activityRef.current?.();
      signature.current = sig;
    } catch (err) {
      setError(errorMessage(err, 'Could not load your orders.'));
    }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(ORDER_PLACED_EVENT, load);
    return () => window.removeEventListener(ORDER_PLACED_EVENT, load);
  }, [load]);
  usePolling(load, 10000);

  // Arriving via /account#orders: jump here once the list has rendered.
  useEffect(() => {
    if (orders && !scrolled.current && window.location.hash === '#orders') {
      scrolled.current = true;
      document.getElementById('orders')?.scrollIntoView({ block: 'start' });
    }
  }, [orders]);

  async function cancel(order: Order) {
    const prepaid = order.paymentStatus === 'paid';
    const ok = window.confirm(
      `Cancel order #${order.number}?${prepaid ? ' Your card payment will be refunded.' : ''}`,
    );
    if (!ok) return;
    setCancellingId(order.id);
    try {
      await orderApi.setStatus(order.id, 'cancelled', 'Cancelled by customer');
      toast(`Order #${order.number} cancelled.${prepaid ? ' A refund is on its way.' : ''}`, 'success');
      await load();
    } catch (err) {
      toast(errorMessage(err, 'Could not cancel the order.'), 'error');
      await load();
    } finally {
      setCancellingId(null);
    }
  }

  async function openReceipt(order: Order) {
    setReceiptLoadingId(order.id);
    try {
      const res = await billingApi.receipt(order.id);
      setReceipt(res.receipt);
    } catch (err) {
      toast(errorMessage(err, 'Could not load the receipt.'), 'error');
    } finally {
      setReceiptLoadingId(null);
    }
  }

  const active = (orders ?? []).filter((o) => ACTIVE.includes(o.status));
  const past = (orders ?? []).filter((o) => !ACTIVE.includes(o.status));

  return (
    <section id="orders" className="scroll-mt-24" aria-labelledby="orders-title">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="orders-title" className="font-display text-xl font-semibold tracking-tight text-bone">
            Your orders
          </h3>
          {orders ? (
            <span className="text-xs text-bone-faint">Updates automatically</span>
          ) : null}
        </div>

        {!orders ? (
          error ? (
            <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}{' '}
              <button type="button" className="underline underline-offset-2" onClick={load}>
                Try again
              </button>
            </div>
          ) : (
            <Spinner label="Loading your orders…" />
          )
        ) : (
          <div className="mt-5 space-y-8">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-bone-faint">
                In progress {active.length > 0 ? `(${active.length})` : ''}
              </p>
              {active.length === 0 ? (
                <p className="text-sm text-bone-dim">
                  Nothing cooking right now.{' '}
                  <Link href="/menu" className="text-ember-soft underline-offset-2 hover:underline">
                    Start an order
                  </Link>
                </p>
              ) : (
                <div className="space-y-4">
                  {active.map((o) => (
                    <ActiveOrderCard
                      key={o.id}
                      order={o}
                      now={now}
                      onCancel={cancel}
                      cancelling={cancellingId === o.id}
                      onReceipt={openReceipt}
                      receiptLoading={receiptLoadingId === o.id}
                    />
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-bone-faint">Past orders</p>
              <OrderHistory orders={past} onReceipt={openReceipt} receiptLoadingId={receiptLoadingId} />
            </div>
          </div>
        )}
      </Card>

      {receipt ? (
        <Modal title={`Receipt ${receipt.receiptNumber}`} onClose={() => setReceipt(null)} dark>
          <Receipt invoice={receipt} />
        </Modal>
      ) : null}
    </section>
  );
}
