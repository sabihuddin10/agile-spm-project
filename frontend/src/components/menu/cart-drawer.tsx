'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/cart-context';
import { useAuth } from '@/context/auth-context';
import { customerApi, orderApi } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import type {
  FulfillmentMethod,
  Order,
  PaymentMethod,
} from '@/types';

const POINT_VALUE = 0.1;
const TAX_RATE = 0.1;

export function CartDrawer() {
  const toast = useToast();
  const { user } = useAuth();
  const { lines, count, subtotal, setQty, clear, open, setOpen } = useCart();

  const [view, setView] = useState<'cart' | 'checkout' | 'placed'>('cart');
  const [fulfillment, setFulfillment] = useState<FulfillmentMethod>('pickup');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [usePoints, setUsePoints] = useState(false);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [balanceLoaded, setBalanceLoaded] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<Order | null>(null);

  useEffect(() => {
    if (view !== 'checkout' || !user || balanceLoaded) return;
    customerApi
      .me()
      .then((res) => {
        setPointsBalance(res.customer?.loyaltyPoints ?? 0);
        setBalanceLoaded(true);
      })
      .catch(() => {
        setPointsBalance(0);
        setBalanceLoaded(true);
      });
  }, [view, user, balanceLoaded]);

  useEffect(() => {
    setBalanceLoaded(false);
  }, [user]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    if (open) {
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
  }, [open]);

  const tax = useMemo(() => subtotal * TAX_RATE, [subtotal]);
  const maxRedeemable = useMemo(
    () => Math.min(Math.max(0, Math.floor(subtotal / POINT_VALUE)), pointsBalance),
    [subtotal, pointsBalance],
  );
  const pointsUsed = usePoints ? maxRedeemable : 0;
  const pointsCredit = pointsUsed * POINT_VALUE;
  const total = Math.max(0, subtotal + tax - pointsCredit);

  async function placeOrder() {
    if (lines.length === 0) return;
    setPlacing(true);
    try {
      const { order } = await orderApi.create({
        type: 'online',
        fulfillment,
        paymentMethod,
        notes: fulfillment === 'delivery' ? address : '',
        pointsUsed,
        items: lines.map((l) => ({ menuItemId: l.item.id, qty: l.qty })),
      });
      setPlaced(order);
      setView('placed');
      clear();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Order placement failed.', 'error');
    } finally {
      setPlacing(false);
    }
  }

  function startCheckout() {
    setFulfillment('pickup');
    setPaymentMethod('card');
    setUsePoints(false);
    setView('checkout');
  }

  function close() {
    setView('cart');
    setOpen(false);
  }

  function openCart() {
    setView('cart');
    setOpen(true);
  }

  const optionCard = (active: boolean) =>
    `flex-1 rounded-xl border p-4 text-left transition ${
      active
        ? 'border-ember bg-ember/10'
        : 'border-char-hairline bg-char-raised hover:border-ember/40'
    }`;

  return (
    <>
      {!open && count > 0 ? (
        <button
          type="button"
          onClick={openCart}
          className="fixed bottom-[72px] left-1/2 z-[54] flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 items-center justify-between gap-3 rounded-pill bg-ember px-5 py-3 text-white shadow-[0_12px_30px_rgba(226,87,27,.4)] lg:bottom-6 lg:left-auto lg:right-6 lg:w-auto lg:max-w-none lg:translate-x-0 lg:rounded-2xl lg:px-4"
          aria-label={`View cart, ${count} items`}
        >
          <span className="flex min-w-0 items-baseline gap-2">
            <small className="truncate text-xs font-semibold opacity-90">
              {count} {count === 1 ? 'item' : 'items'}
            </small>
            <span className="font-display text-base font-extrabold">${total.toFixed(2)}</span>
          </span>
          <span className="text-xs font-bold">View cart →</span>
        </button>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-[70]">
          <div
            className="fade-in absolute inset-0 z-0 bg-char-deep/70 backdrop-blur-sm"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !placing) close();
            }}
          />
          <aside className="drawer-in relative z-10 ml-auto flex h-full w-full max-w-[420px] flex-col border-l border-char-hairline bg-char-raised shadow-ember">
            {view === 'cart' ? (
              <>
                <div className="flex shrink-0 items-center justify-between border-b border-char-hairline px-5 py-3">
                  <p className="font-display text-base font-extrabold tracking-tight text-bone lg:text-lg">
                    Your cart
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={clear}
                      className="rounded-pill border border-char-hairline px-2.5 py-1 text-xs text-bone-faint transition hover:text-bone"
                    >
                      Clear
                    </button>
                    <button
                      onClick={close}
                      className="flex h-7 w-7 items-center justify-center rounded-pill border border-char-hairline text-bone-faint transition hover:bg-char-deep hover:text-bone"
                      aria-label="Close cart"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                        <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                  {lines.length === 0 ? (
                    <div className="px-3 py-16 text-center text-bone-dim">
                      <h3 className="font-display text-base font-extrabold text-bone">
                        Your cart is empty
                      </h3>
                      <p className="mt-2 text-xs">Add a few dishes from the menu.</p>
                      <button
                        className="btn-primary mt-6 px-5 text-xs"
                        onClick={close}
                      >
                        Browse the menu
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-0 border-b border-char-hairline">
                      {lines.map((l) => (
                        <div
                          key={l.item.id}
                          className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-char-hairline py-4"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-bone">
                              {l.item.name}
                              <span className="ml-1 text-xs font-normal text-bone-faint">
                                × {l.qty}
                              </span>
                            </div>
                            <div className="mt-1 text-xs font-semibold text-ember-soft">
                              ${l.item.price.toFixed(2)}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className="inline-flex items-center overflow-hidden rounded-pill border border-char-hairline bg-char-deep">
                              <button
                                className="flex h-6 w-6 items-center justify-center text-sm font-bold text-bone-faint transition hover:text-bone"
                                onClick={() => setQty(l.item.id, -1)}
                                aria-label={`Remove one ${l.item.name}`}
                              >
                                −
                              </button>
                              <span className="min-w-[24px] text-center text-xs font-bold text-bone">
                                {l.qty}
                              </span>
                              <button
                                className="flex h-6 w-6 items-center justify-center text-sm font-bold text-bone-faint transition hover:text-bone"
                                onClick={() => setQty(l.item.id, 1)}
                                aria-label={`Add one ${l.item.name}`}
                              >
                                +
                              </button>
                            </div>
                            <span className="w-full text-right text-xs text-bone-faint">
                              ${(l.item.price * l.qty).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {lines.length > 0 ? (
                  <div className="flex shrink-0 flex-col gap-[6px] border-t border-char-hairline bg-char-raised px-5 py-4">
                    <div className="flex justify-between text-xs text-bone-dim">
                      <span>Subtotal</span>
                      <span>${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-bone-dim">
                      <span>Tax (10%)</span>
                      <span>${tax.toFixed(2)}</span>
                    </div>
                    <button
                      className="mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-pill bg-ember text-sm font-extrabold text-bone transition hover:bg-ember-soft"
                      onClick={startCheckout}
                    >
                      Checkout · ${total.toFixed(2)}
                    </button>
                  </div>
                ) : null}
              </>
            ) : view === 'checkout' ? (
              <div className="flex flex-1 flex-col overflow-y-auto">
                <div className="flex items-center justify-between border-b border-char-hairline px-5 py-4">
                  <p className="font-display text-base font-extrabold tracking-tight text-bone lg:text-lg">
                    Checkout
                  </p>
                  <button
                    onClick={() => setView('cart')}
                    disabled={placing}
                    className="rounded-md p-1.5 text-bone-faint transition hover:text-bone"
                    aria-label="Back to cart"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-6 px-5 py-5">
                  <div>
                    <p className="mb-2 text-sm font-medium text-bone">How would you like it?</p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setFulfillment('pickup')}
                        className={optionCard(fulfillment === 'pickup')}
                      >
                        <span className="block text-sm font-medium text-bone">Pickup</span>
                        <span className="mt-0.5 block text-xs text-bone-dim">
                          Ready in about 30 minutes
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFulfillment('delivery')}
                        className={optionCard(fulfillment === 'delivery')}
                      >
                        <span className="block text-sm font-medium text-bone">Delivery</span>
                        <span className="mt-0.5 block text-xs text-bone-dim">
                          We&apos;ll bring it to you
                        </span>
                      </button>
                    </div>
                    {fulfillment === 'delivery' ? (
                      <input
                        className="input mt-3"
                        placeholder="Delivery address"
                        required
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                      />
                    ) : null}
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium text-bone">How will you pay?</p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('card')}
                        className={optionCard(paymentMethod === 'card')}
                      >
                        <span className="block text-sm font-medium text-bone">Card</span>
                        <span className="mt-0.5 block text-xs text-bone-dim">Pay now</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('cash')}
                        className={optionCard(paymentMethod === 'cash')}
                      >
                        <span className="block text-sm font-medium text-bone">Cash</span>
                        <span className="mt-0.5 block text-xs text-bone-dim">Pay on the day</span>
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-char-hairline bg-char-deep p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-bone">Flame Points</p>
                        <p className="mt-0.5 text-xs text-bone-dim">
                          You have {pointsBalance}. Worth $
                          {(pointsBalance * POINT_VALUE).toFixed(2)} off your order.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={maxRedeemable <= 0}
                        onClick={() => setUsePoints((v) => !v)}
                        className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                          usePoints
                            ? 'border-ember bg-ember text-bone'
                            : maxRedeemable > 0
                              ? 'border-char-hairline bg-char-raised text-bone-dim hover:border-ember/40 hover:text-bone'
                              : 'cursor-not-allowed border-char-hairline bg-char-deep text-bone-faint'
                        }`}
                      >
                        {usePoints
                          ? `Redeem ${pointsUsed} points`
                          : maxRedeemable > 0
                            ? 'Redeem points'
                            : 'No points to redeem'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 border-t border-char-hairline pt-4 text-sm">
                    {lines.map((l) => (
                      <div key={l.item.id} className="flex items-center justify-between">
                        <span className="text-bone">
                          {l.item.name}{' '}
                          <span className="text-bone-faint">× {l.qty}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            className="btn-ghost !px-1.5 !py-0.5 text-xs"
                            onClick={() => setQty(l.item.id, -1)}
                            aria-label={`Remove one ${l.item.name}`}
                          >
                            −
                          </button>
                          <span className="w-4 text-center text-bone-dim">{l.qty}</span>
                          <button
                            className="btn-ghost !px-1.5 !py-0.5 text-xs"
                            onClick={() => setQty(l.item.id, 1)}
                            aria-label={`Add one ${l.item.name}`}
                          >
                            +
                          </button>
                          <span className="w-14 text-right text-bone-faint">
                            ${(l.item.price * l.qty).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1.5 border-t border-char-hairline pt-4 text-sm text-bone-dim">
                    <p className="flex justify-between">
                      <span>Subtotal</span>
                      <span>${subtotal.toFixed(2)}</span>
                    </p>
                    <p className="flex justify-between">
                      <span>Tax (10%)</span>
                      <span>${tax.toFixed(2)}</span>
                    </p>
                    {pointsCredit > 0 ? (
                      <p className="flex justify-between text-ember-soft">
                        <span>Flame Points credit</span>
                        <span>−${pointsCredit.toFixed(2)}</span>
                      </p>
                    ) : null}
                    <p className="flex justify-between pt-1 text-base font-semibold text-bone">
                      <span>Total</span>
                      <span>
                        ${total.toFixed(2)}
                        {paymentMethod === 'cash' ? (
                          <span className="ml-2 text-xs font-normal text-bone-faint">on the day</span>
                        ) : null}
                      </span>
                    </p>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button className="btn-ghost flex-1 !py-2 text-sm" onClick={() => setView('cart')} disabled={placing}>
                      Back
                    </button>
                    <button
                      className="btn-primary flex-1 !py-2 text-sm"
                      disabled={placing || (fulfillment === 'delivery' && !address.trim())}
                      onClick={placeOrder}
                    >
                      {placing ? 'Placing…' : paymentMethod === 'card' ? 'Pay and place order' : 'Place order'}
                    </button>
                  </div>
                </div>
              </div>
            ) : placed ? (
              <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ember/15 text-ember-soft">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-7 w-7">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="font-display mt-4 text-2xl font-semibold tracking-tight text-bone">
                  Order #{placed.number} received
                </h2>
                <p className="mt-2 text-sm text-bone-dim">
                  {placed.fulfillment === 'delivery'
                    ? 'The kitchen is on it and a rider is on the way to you.'
                    : 'It is on the pass and will be ready for pickup in about 30 minutes.'}
                </p>

                <div className="mt-6 w-full max-w-xs space-y-1.5 rounded-xl border border-char-hairline bg-char-deep p-4 text-sm">
                  <p className="flex justify-between text-bone-dim">
                    <span>Status</span>
                    <span className="capitalize text-bone">{placed.status}</span>
                  </p>
                  <p className="flex justify-between text-bone-dim">
                    <span>Payment</span>
                    <span className="capitalize text-bone">{placed.paymentMethod ?? 'card'}</span>
                  </p>
                  {placed.fulfillment === 'delivery' && placed.notes ? (
                    <p className="flex justify-between gap-3 text-bone-dim">
                      <span className="shrink-0">Deliver to</span>
                      <span className="text-right text-bone">{placed.notes}</span>
                    </p>
                  ) : null}
                  <p className="flex justify-between text-bone-dim">
                    <span>Total</span>
                    <span className="text-bone">${placed.total.toFixed(2)}</span>
                  </p>
                  {placed.pointsEarned ? (
                    <p className="flex justify-between text-ember-soft">
                      <span>Flame Points earned</span>
                      <span>+{placed.pointsEarned}</span>
                    </p>
                  ) : null}
                </div>

                <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
                  <Link href="/account" onClick={close} className="btn-secondary w-full !py-2 text-sm">
                    View in My account
                  </Link>
                  <button className="btn-primary w-full !py-2 text-sm" onClick={close}>
                    Done
                  </button>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}
    </>
  );
}
