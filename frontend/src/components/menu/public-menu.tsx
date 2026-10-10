'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { customerApi, menuApi } from '@/lib/api';
import type { MenuCategory } from '@/types';
import { MenuItemCard } from '@/components/menu/menu-item-card';
import { Spinner } from '@/components/ui/spinner';
import { useCart } from '@/context/cart-context';
import { useAuth } from '@/context/auth-context';
import { errorMessage } from '@/lib/format';

/**
 * The storefront menu: categories of dishes with dietary/allergen tags and a
 * dietary filter (US2.2), allergy warnings for the signed-in customer (US2.4),
 * out-of-stock reasons (US2.5) and add-to-order with options (US2.3).
 */
export function PublicMenu({ compact = false }: { compact?: boolean }) {
  const { add, canOrder } = useCart();
  const { user } = useAuth();
  const [menu, setMenu] = useState<MenuCategory[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [allergies, setAllergies] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    menuApi
      .get()
      .then((res) => {
        if (cancelled) return;
        setMenu(res.menu.filter((c) => c.active));
        setTags(res.tags);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Failed to load menu.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // US2.4: load the customer's recorded allergies once, to flag clashing dishes.
  const customerId = user?.role === 'customer' ? user.id : null;
  useEffect(() => {
    if (!customerId) {
      setAllergies([]);
      return;
    }
    let cancelled = false;
    customerApi
      .me()
      .then((res) => {
        if (!cancelled) setAllergies(res.customer.preferences?.allergies ?? []);
      })
      .catch(() => {
        /* warnings are a convenience — the menu still works without them */
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  if (loading) {
    return (
      <div className="flex justify-center py-10 md:py-16">
        <Spinner label="Loading menu…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card mx-auto max-w-md p-6 text-center">
        <p className="text-sm text-red-400">{error}</p>
        <p className="mt-2 text-sm text-bone-dim">Is the kitchen open? Try again in a moment.</p>
      </div>
    );
  }

  const categories = activeTag
    ? menu
        .map((c) => ({ ...c, items: c.items?.filter((i) => i.dietaryTags.includes(activeTag)) }))
        .filter((c) => (c.items?.length ?? 0) > 0)
    : menu;

  const visible = compact ? categories.slice(0, 3) : categories;

  const tagChip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm font-medium capitalize transition ${
      active
        ? 'border-ember bg-ember text-bone'
        : 'border-char-hairline bg-char-raised text-bone-dim hover:border-ember/40 hover:text-bone'
    }`;

  return (
    <div>
      {customerId && allergies.length > 0 ? (
        <p className="mb-4 rounded-xl border border-char-hairline bg-char-raised px-3.5 py-2.5 text-sm text-bone-dim sm:mb-6 sm:px-4 sm:py-3">
          We&apos;re flagging dishes that contain <span className="font-medium text-bone">{allergies.join(', ')}</span>{' '}
          from your allergy list.{' '}
          <Link href="/account" className="text-ember-soft underline-offset-2 hover:underline">
            Update your allergies
          </Link>
        </p>
      ) : null}

      {!compact && tags.length > 0 ? (
        <div className="mb-6 flex flex-wrap items-center gap-2 md:mb-8" role="group" aria-label="Filter by dietary tag">
          <button type="button" onClick={() => setActiveTag(null)} className={tagChip(activeTag === null)} aria-pressed={activeTag === null}>
            All
          </button>
          {tags.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setActiveTag(activeTag === t ? null : t)}
              className={tagChip(activeTag === t)}
              aria-pressed={activeTag === t}
            >
              {t}
            </button>
          ))}
        </div>
      ) : null}

      <div className="space-y-6 sm:space-y-8 md:space-y-12">
        {visible.map((cat) => (
          <section key={cat.id}>
            <div className="mb-3 flex items-center gap-3 sm:mb-4">
              <h2 className="font-display text-2xl font-semibold tracking-tight text-bone">{cat.name}</h2>
              <span className="rounded-full border border-char-hairline bg-char-raised px-2.5 py-0.5 text-xs text-bone-faint">
                {cat.items?.length ?? 0} {(cat.items?.length ?? 0) === 1 ? 'dish' : 'dishes'}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {(cat.items ?? []).map((item) => (
                <MenuItemCard key={item.id} item={item} onAdd={add} canOrder={canOrder} allergies={allergies} />
              ))}
            </div>
          </section>
        ))}
        {visible.length === 0 ? (
          <p className="text-center text-sm text-bone-dim">
            {activeTag ? 'Nothing matches this tag right now.' : 'The menu is empty this evening.'}
          </p>
        ) : null}
      </div>

      {compact ? (
        <div className="mt-6 text-center md:mt-8">
          <Link href="/menu" className="btn-secondary">
            View full menu
          </Link>
        </div>
      ) : null}
    </div>
  );
}
