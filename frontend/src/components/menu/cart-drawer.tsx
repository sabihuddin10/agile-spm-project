'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Order } from '@/types';
import { useCart } from '@/context/cart-context';
import { useAuth } from '@/context/auth-context';
import { CartLines } from '@/components/storefront/cart-lines';
import { CheckoutForm } from '@/components/storefront/checkout-form';
import { OrderPlaced } from '@/components/storefront/order-placed';
import { money } from '@/lib/format';

type View = 'cart' | 'checkout' | 'placed';

const TITLES: Record<View, string> = { cart: 'Your order', checkout: 'Checkout', placed: 'Order placed' };

/**
 * Storefront cart and checkout drawer: lines with options and line totals
 * (US2.3), checkout for dine-in / pickup / delivery with card or cash and Flame
 * Points (US3.1), then the server's confirmation.
 */
export function CartDrawer() {
  const { user } = useAuth();
  const { lines, count, subtotal, canOrder, setQty, clear, open, setOpen } = useCart();
  const [view, setView] = useState<View>('cart');
  const [placed, setPlaced] = useState<Order | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setView('cart');
    setPlaced(null);
  }, [setOpen]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  function handlePlaced(order: Order) {
    setPlaced(order);
    setView('placed');
  }

  return (
    <>
      {!open && count > 0 ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-16 left-1/2 z-[54] flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 items-center justify-between gap-3 rounded-pill bg-ember px-4 py-2.5 text-bone shadow-[0_12px_30px_rgba(226,87,27,.4)] lg:bottom-6 lg:left-auto lg:right-6 lg:w-auto lg:max-w-none lg:translate-x-0 lg:rounded-2xl lg:px-4"
          aria-label={`View your order, ${count} ${count === 1 ? 'item' : 'items'}, ${money(subtotal)}`}
        >
          <span className="flex min-w-0 items-baseline gap-2">
            <small className="truncate text-xs font-semibold opacity-90">
              {count} {count === 1 ? 'item' : 'items'}
            </small>
            <span className="font-display text-base font-extrabold">{money(subtotal)}</span>
          </span>
          <span className="text-xs font-bold">View order →</span>
        </button>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={TITLES[view]}>
          <div
            className="fade-in absolute inset-0 z-0 bg-char-deep/70 backdrop-blur-sm"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          />
          <aside className="drawer-in relative z-10 ml-auto flex h-full w-full max-w-[440px] flex-col border-l border-char-hairline bg-char-raised shadow-ember">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-char-hairline px-4 py-3 sm:px-5">
              <p className="font-display text-lg font-extrabold tracking-tight text-bone">{TITLES[view]}</p>
              <div className="flex items-center gap-2">
                {view === 'cart' && lines.length > 0 ? (
                  <button
                    type="button"
                    onClick={clear}
                    className="rounded-pill border border-char-hairline px-2.5 py-1 text-xs text-bone-faint transition hover:text-bone"
                  >
                    Clear
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={close}
                  className="flex h-9 w-9 items-center justify-center rounded-pill border border-char-hairline text-bone-faint transition hover:bg-char-deep hover:text-bone"
                  aria-label="Close"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden="true">
                    <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            </div>

            {view === 'placed' && placed ? (
              <OrderPlaced order={placed} onDone={close} />
            ) : view === 'checkout' && canOrder ? (
              <div className="flex-1 overflow-y-auto">
                <CheckoutForm onBack={() => setView('cart')} onPlaced={handlePlaced} />
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-4 sm:px-5">
                  {lines.length === 0 ? (
                    <div className="px-3 py-10 text-center text-bone-dim sm:py-16">
                      <h3 className="font-display text-base font-extrabold text-bone">Your order is empty</h3>
                      <p className="mt-2 text-xs">
                        {canOrder
                          ? 'Add a few dishes from the menu.'
                          : user
                            ? 'Staff place orders from the staff console.'
                            : 'Sign in to start an order.'}
                      </p>
                      {canOrder || user ? (
                        <Link href="/menu" className="btn-primary mt-5" onClick={close}>
                          Browse the menu
                        </Link>
                      ) : (
                        <Link href="/login" className="btn-primary mt-5" onClick={close}>
                          Sign in
                        </Link>
                      )}
                    </div>
                  ) : (
                    <CartLines lines={lines} onQty={setQty} />
                  )}
                </div>

                {lines.length > 0 ? (
                  <div className="flex shrink-0 flex-col gap-2 border-t border-char-hairline bg-char-raised px-4 py-3 sm:px-5 sm:py-4">
                    <p className="flex justify-between text-sm text-bone">
                      <span>Subtotal</span>
                      <span className="font-semibold">{money(subtotal)}</span>
                    </p>
                    <p className="text-xs text-bone-faint">Tax, service and Flame Points are worked out at checkout.</p>
                    {canOrder ? (
                      <button type="button" className="btn-primary mt-1 w-full sm:h-10 lg:h-12" onClick={() => setView('checkout')}>
                        Checkout · {money(subtotal)}
                      </button>
                    ) : user ? (
                      <p className="mt-1 rounded-xl border border-char-hairline bg-char-deep px-3 py-2 text-center text-xs text-bone-dim">
                        Staff place orders from the staff console.
                      </p>
                    ) : (
                      <Link href="/login" onClick={close} className="btn-primary mt-1 w-full sm:h-10 lg:h-12">
                        Sign in to check out
                      </Link>
                    )}
                  </div>
                ) : null}
              </>
            )}
          </aside>
        </div>
      ) : null}
    </>
  );
}
