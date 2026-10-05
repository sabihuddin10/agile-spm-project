'use client';

import { useEffect, useMemo, useState } from 'react';
import type { NewOrderInput, Order, PublicTable, Settings } from '@/types';
import { ApiError, customerApi, orderApi, settingsApi, tableApi } from '@/lib/api';
import { useCart } from '@/context/cart-context';
import { useToast } from '@/components/ui/toast';
import { CartLines } from '@/components/storefront/cart-lines';
import { ORDER_PLACED_EVENT, estimateCheckout, maxRedeemablePoints } from '@/components/storefront/checkout-estimate';
import { errorMessage, money, percent } from '@/lib/format';

type Fulfillment = 'dine-in' | 'pickup' | 'delivery';
type Payment = 'card' | 'cash';

const FULFILLMENT: { id: Fulfillment; label: string; hint: string }[] = [
  { id: 'dine-in', label: 'Dine in', hint: 'At your table' },
  { id: 'pickup', label: 'Pickup', hint: '~30 minutes' },
  { id: 'delivery', label: 'Delivery', hint: 'To your door' },
];

const CASH_HINT: Record<Fulfillment, string> = {
  'dine-in': 'Pay at the table',
  pickup: 'Pay on collection',
  delivery: 'Pay on delivery',
};

/**
 * Checkout (US3.1): dine in at a chosen table, pickup or delivery; card now or
 * cash later; Flame Points redemption; estimated totals from the restaurant's
 * settings. The server prices the order — on 409 (a dish sold out) the cart is kept.
 */
export function CheckoutForm({ onBack, onPlaced }: { onBack: () => void; onPlaced: (order: Order) => void }) {
  const toast = useToast();
  const { lines, subtotal, setQty, remove, clear } = useCart();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [tables, setTables] = useState<PublicTable[]>([]);
  const [balance, setBalance] = useState(0);
  const [loadIssue, setLoadIssue] = useState<string | null>(null);

  const [fulfillment, setFulfillment] = useState<Fulfillment>('pickup');
  const [tableId, setTableId] = useState('');
  const [address, setAddress] = useState('');
  const [payment, setPayment] = useState<Payment>('card');
  const [usePoints, setUsePoints] = useState(false);
  const [points, setPoints] = useState(0);
  const [notes, setNotes] = useState('');

  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flagged, setFlagged] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([settingsApi.get(), customerApi.me(), tableApi.publicList()]).then(([s, c, t]) => {
      if (cancelled) return;
      if (s.status === 'fulfilled') setSettings(s.value.settings);
      if (c.status === 'fulfilled') setBalance(c.value.customer.loyaltyPoints ?? 0);
      if (t.status === 'fulfilled') setTables(t.value.tables);
      const failed = [s, c, t].find((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failed) setLoadIssue(errorMessage(failed.reason, 'Some checkout details could not be loaded.'));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const pointValue = settings?.pointValue ?? 0;
  const maxPoints = maxRedeemablePoints(subtotal, balance, pointValue);
  const pointsUsed = usePoints ? Math.min(points, maxPoints) : 0;
  const dineIn = fulfillment === 'dine-in';

  const estimate = useMemo(
    () => (settings ? estimateCheckout(subtotal, pointsUsed, settings, dineIn) : null),
    [settings, subtotal, pointsUsed, dineIn],
  );

  const missing =
    lines.length === 0
      ? 'Your cart is empty.'
      : dineIn && !tableId
        ? 'Choose the table you are sitting at.'
        : fulfillment === 'delivery' && !address.trim()
          ? 'Enter a delivery address.'
          : flagged.some((k) => lines.some((l) => l.key === k))
            ? 'Remove the unavailable dish to continue.'
            : null;

  function removeLine(key: string) {
    remove(key);
    setFlagged((keys) => keys.filter((k) => k !== key));
    setError(null);
  }

  function togglePoints() {
    if (!usePoints) setPoints(maxPoints);
    setUsePoints((v) => !v);
  }

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    if (missing || placing) return;
    setPlacing(true);
    setError(null);
    const items = lines.map((l) => ({ menuItemId: l.item.id, qty: l.qty, modifiers: l.modifiers }));
    const base = { paymentMethod: payment, notes: notes.trim(), pointsUsed, items };
    const payload: NewOrderInput = dineIn
      ? { ...base, type: 'dine-in', tableId }
      : {
          ...base,
          type: 'online',
          fulfillment,
          ...(fulfillment === 'delivery' ? { deliveryAddress: address.trim() } : {}),
        };
    try {
      const { order } = await orderApi.create(payload);
      clear();
      onPlaced(order);
      window.dispatchEvent(new Event(ORDER_PLACED_EVENT));
    } catch (err) {
      const message = errorMessage(err, 'Your order could not be placed.');
      setError(message);
      if (err instanceof ApiError && err.status === 409) {
        // A dish sold out since it was added: keep the cart and point at the culprit.
        setFlagged(lines.filter((l) => message.includes(l.item.name)).map((l) => l.key));
      } else {
        toast(message, 'error');
      }
    } finally {
      setPlacing(false);
    }
  }

  const optionCard = (active: boolean) =>
    `rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
      active ? 'border-ember bg-ember/10' : 'border-char-hairline bg-char-deep hover:border-ember/40'
    }`;

  return (
    <form onSubmit={placeOrder} className="space-y-6 px-5 py-5">
      {loadIssue ? (
        <p className="rounded-xl border border-char-hairline bg-char-deep px-3.5 py-2.5 text-xs text-bone-dim">
          {loadIssue} Totals below are approximate.
        </p>
      ) : null}

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-bone">How would you like it?</legend>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Fulfillment">
          {FULFILLMENT.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={fulfillment === f.id}
              disabled={placing}
              onClick={() => setFulfillment(f.id)}
              className={optionCard(fulfillment === f.id)}
            >
              <span className="block text-sm font-medium text-bone">{f.label}</span>
              <span className="mt-0.5 block text-[11px] leading-tight text-bone-dim">{f.hint}</span>
            </button>
          ))}
        </div>

        {dineIn ? (
          <div className="mt-3">
            <label htmlFor="checkout-table" className="label">
              Your table number
            </label>
            <select
              id="checkout-table"
              className="input [color-scheme:dark]"
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
              disabled={placing}
              required
            >
              <option value="">Choose your table…</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  Table {t.number} · {t.zone} · {t.seats} seats
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-bone-faint">The number is on the stand on your table.</p>
          </div>
        ) : null}

        {fulfillment === 'delivery' ? (
          <div className="mt-3">
            <label htmlFor="checkout-address" className="label">
              Delivery address
            </label>
            <textarea
              id="checkout-address"
              className="input min-h-[64px] resize-y"
              placeholder="Street, number, flat, postcode"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={placing}
              required
              maxLength={300}
            />
          </div>
        ) : null}
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-bone">How will you pay?</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Payment method">
          <button
            type="button"
            role="radio"
            aria-checked={payment === 'card'}
            disabled={placing}
            onClick={() => setPayment('card')}
            className={optionCard(payment === 'card')}
          >
            <span className="block text-sm font-medium text-bone">Card</span>
            <span className="mt-0.5 block text-[11px] text-bone-dim">Pay now</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={payment === 'cash'}
            disabled={placing}
            onClick={() => setPayment('cash')}
            className={optionCard(payment === 'cash')}
          >
            <span className="block text-sm font-medium text-bone">Cash</span>
            <span className="mt-0.5 block text-[11px] text-bone-dim">{CASH_HINT[fulfillment]}</span>
          </button>
        </div>
      </fieldset>

      <div className="rounded-xl border border-char-hairline bg-char-deep p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-bone">Flame Points</p>
            <p className="mt-0.5 text-xs text-bone-dim">
              You have {balance} {balance === 1 ? 'point' : 'points'}
              {pointValue > 0 ? ` · each worth ${money(pointValue)}` : ''}.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={usePoints}
            disabled={maxPoints <= 0 || placing}
            onClick={togglePoints}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
              usePoints
                ? 'border-ember bg-ember text-bone'
                : 'border-char-hairline bg-char-raised text-bone-dim hover:border-ember/40 hover:text-bone'
            }`}
          >
            {maxPoints <= 0 ? 'Nothing to redeem' : usePoints ? 'Redeeming' : 'Redeem points'}
          </button>
        </div>
        {usePoints && maxPoints > 0 ? (
          <div className="mt-3">
            <label htmlFor="checkout-points" className="flex justify-between text-xs text-bone-dim">
              <span>Points to use</span>
              <span className="font-medium text-bone">
                {pointsUsed} → −{money(pointsUsed * pointValue)}
              </span>
            </label>
            <input
              id="checkout-points"
              type="range"
              min={0}
              max={maxPoints}
              step={1}
              value={pointsUsed}
              onChange={(e) => setPoints(Number(e.target.value))}
              disabled={placing}
              className="mt-2 w-full accent-ember"
            />
          </div>
        ) : null}
      </div>

      <div>
        <label htmlFor="checkout-notes" className="label">
          Notes for the kitchen <span className="text-bone-faint">(optional)</span>
        </label>
        <textarea
          id="checkout-notes"
          className="input min-h-[56px] resize-y"
          placeholder="e.g. no onions, cutlery for two"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={placing}
          maxLength={500}
        />
      </div>

      <div className="border-t border-char-hairline">
        <CartLines lines={lines} onQty={setQty} onRemove={removeLine} flagged={flagged} disabled={placing} />
      </div>

      <div className="space-y-1.5 border-t border-char-hairline pt-4 text-sm text-bone-dim">
        <Row label="Subtotal" value={money(subtotal)} />
        {estimate && settings ? (
          <>
            {estimate.discount > 0 ? (
              <Row label={`Flame Points (${pointsUsed})`} value={`−${money(estimate.discount)}`} accent />
            ) : null}
            {dineIn && estimate.serviceCharge > 0 ? (
              <Row label={`Service charge (${percent(settings.serviceChargeRate)})`} value={money(estimate.serviceCharge)} />
            ) : null}
            <Row label={`Tax (${percent(settings.taxRate)})`} value={money(estimate.tax)} />
            <p className="flex items-baseline justify-between pt-1 text-base font-semibold text-bone">
              <span>Estimated total</span>
              <span>{money(estimate.total)}</span>
            </p>
          </>
        ) : (
          <p className="text-xs text-bone-faint">Tax and charges are added when the restaurant prices your order.</p>
        )}
        <p className="pt-1 text-xs text-bone-faint">
          Estimated — the restaurant prices your order when it is placed
          {payment === 'cash' ? `; pay by cash ${CASH_HINT[fulfillment].replace('Pay ', '')}` : ''}.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2 pt-1">
        <button type="button" className="btn-ghost flex-1 !py-2.5 text-sm" onClick={onBack} disabled={placing}>
          Back to cart
        </button>
        <button type="submit" className="btn-primary flex-[2] !py-2.5 text-sm" disabled={placing || Boolean(missing)}>
          {placing
            ? 'Placing…'
            : payment === 'card'
              ? `Pay${estimate ? ` ${money(estimate.total)}` : ''} & place order`
              : 'Place order'}
        </button>
      </div>
      {missing && !placing ? <p className="-mt-3 text-center text-xs text-bone-faint">{missing}</p> : null}
    </form>
  );
}

function Row({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <p className={`flex justify-between gap-3 ${accent ? 'text-ember-soft' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </p>
  );
}
