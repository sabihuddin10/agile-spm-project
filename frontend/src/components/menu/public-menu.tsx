'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { menuApi } from '@/lib/api';
import type { MenuCategory, MenuItem } from '@/types';
import { MenuItemCard } from '@/components/menu/menu-item-card';
import { Spinner } from '@/components/ui/spinner';
import { useCart } from '@/context/cart-context';

export function PublicMenu({ compact = false }: { compact?: boolean }) {
  const { add } = useCart();
  const [menu, setMenu] = useState<MenuCategory[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    menuApi
      .get()
      .then((res) => {
        if (cancelled) return;
        setMenu(res.menu.filter((c) => c.active));
        setTags(res.tags);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load menu.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
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
    ? menu.map((c) => ({
        ...c,
        items: c.items?.filter((i) => i.dietaryTags.includes(activeTag)),
      })).filter((c) => (c.items?.length ?? 0) > 0)
    : menu;

  const visible = compact ? categories.slice(0, 3) : categories;

  const tagChip = (active: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-sm font-medium capitalize transition ${
      active
        ? 'border-ember bg-ember text-bone'
        : 'border-char-hairline bg-char-raised text-bone-dim hover:border-ember/40 hover:text-bone'
    }`;

  return (
    <div>
      {!compact && tags.length > 0 ? (
        <div className="mb-8 flex flex-wrap items-center gap-2">
          <button onClick={() => setActiveTag(null)} className={tagChip(activeTag === null)}>
            All
          </button>
          {tags.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTag(activeTag === t ? null : t)}
              className={tagChip(activeTag === t)}
            >
              {t}
            </button>
          ))}
        </div>
      ) : null}

      <div className="space-y-12">
        {visible.map((cat) => (
          <section key={cat.id}>
            <div className="mb-4 flex items-center gap-3">
              <h2 className="font-display text-2xl font-semibold tracking-tight text-bone">
                {cat.name}
              </h2>
              <span className="rounded-full border border-char-hairline bg-char-raised px-2.5 py-0.5 text-xs text-bone-faint">
                {cat.items?.length ?? 0}, {((cat.items?.length ?? 0) === 1 ? 'dish' : 'dishes')}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(cat.items ?? []).map((item) => (
                <MenuItemCard key={item.id} item={item} onAdd={add} />
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
        <div className="mt-8 text-center">
          <Link href="/menu" className="btn-secondary">
            View full menu
          </Link>
        </div>
      ) : null}
    </div>
  );
}