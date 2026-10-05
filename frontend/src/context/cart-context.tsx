'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { MenuItem, ModifierSelection } from '@/types';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/ui/toast';
import { selectionKey, unitPriceFor } from '@/lib/menu';

/** One cart line: a dish with a specific set of modifier choices (US2.3). */
export interface CartLine {
  /** selectionKey(item.id, modifiers) — the same dish with the same options merges into one line. */
  key: string;
  item: MenuItem;
  qty: number;
  modifiers: ModifierSelection[];
}

interface CartValue {
  lines: CartLine[];
  count: number;
  /** Sum of unit price (base + modifier deltas) × qty. */
  subtotal: number;
  /** Only signed-in customers can build an order. */
  canOrder: boolean;
  /** Returns false (and explains why) when the current user cannot order. */
  add: (item: MenuItem, modifiers?: ModifierSelection[], qty?: number) => boolean;
  setQty: (key: string, delta: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  open: boolean;
  setOpen: (v: boolean) => void;
}

const CartContext = createContext<CartValue | null>(null);

const STORAGE_KEY = 'plate_flame_cart_v2';
const LEGACY_KEYS = ['plate_flame_cart'];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function isSelection(v: unknown): v is ModifierSelection {
  return isObject(v) && typeof v.group === 'string' && typeof v.label === 'string';
}

function isMenuItem(v: unknown): v is MenuItem {
  return (
    isObject(v) &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.price === 'number' &&
    Array.isArray(v.modifiers) &&
    Array.isArray(v.allergens) &&
    Array.isArray(v.dietaryTags)
  );
}

/** Rebuild a stored line, or null when it is malformed (older cart format, hand-edited storage…). */
function reviveLine(raw: unknown): CartLine | null {
  if (!isObject(raw) || !isMenuItem(raw.item)) return null;
  const qty = Number(raw.qty);
  if (!Number.isInteger(qty) || qty < 1) return null;
  if (!Array.isArray(raw.modifiers) || !raw.modifiers.every(isSelection)) return null;
  const modifiers = raw.modifiers.map((m) => ({ group: m.group, label: m.label }));
  return { key: selectionKey(raw.item.id, modifiers), item: raw.item, qty: Math.min(qty, 99), modifiers };
}

function readStoredLines(): CartLine[] {
  try {
    LEGACY_KEYS.forEach((k) => window.localStorage.removeItem(k));
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(reviveLine).filter((l): l is CartLine => l !== null);
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const { user } = useAuth();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(false);
  const lastUserId = useRef<string | null>(null);

  const canOrder = user?.role === 'customer';

  useEffect(() => {
    setLines(readStoredLines());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* storage unavailable */
    }
  }, [lines, hydrated]);

  // A different account signing in on this browser starts with an empty cart.
  useEffect(() => {
    if (!user) return;
    if (lastUserId.current && lastUserId.current !== user.id) setLines([]);
    lastUserId.current = user.id;
  }, [user]);

  const add = useCallback(
    (item: MenuItem, modifiers: ModifierSelection[] = [], qty = 1) => {
      if (!user) {
        toast('Sign in to start an order.', 'info');
        return false;
      }
      if (user.role !== 'customer') {
        toast('Staff place orders from the staff console.', 'info');
        return false;
      }
      if (!item.available) {
        toast(`${item.name} is unavailable right now.`, 'error');
        return false;
      }
      const amount = Math.max(1, Math.floor(qty));
      const key = selectionKey(item.id, modifiers);
      setLines((prev) =>
        prev.some((l) => l.key === key)
          ? prev.map((l) => (l.key === key ? { ...l, item, qty: Math.min(99, l.qty + amount) } : l))
          : [...prev, { key, item, qty: Math.min(99, amount), modifiers }],
      );
      toast(`${amount > 1 ? `${amount} × ` : ''}${item.name} added to your order.`, 'success');
      return true;
    },
    [user, toast],
  );

  const setQty = useCallback((key: string, delta: number) => {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, qty: Math.min(99, l.qty + delta) } : l)).filter((l) => l.qty > 0),
    );
  }, []);

  const remove = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const count = useMemo(() => lines.reduce((s, l) => s + l.qty, 0), [lines]);
  const subtotal = useMemo(() => {
    const cents = lines.reduce((s, l) => s + Math.round(unitPriceFor(l.item, l.modifiers) * 100) * l.qty, 0);
    return cents / 100;
  }, [lines]);

  const value = useMemo(
    () => ({ lines, count, subtotal, canOrder, add, setQty, remove, clear, open, setOpen }),
    [lines, count, subtotal, canOrder, add, setQty, remove, clear, open],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
