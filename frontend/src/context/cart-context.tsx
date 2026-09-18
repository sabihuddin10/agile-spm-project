'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { MenuItem } from '@/types';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/ui/toast';

export interface CartLine {
  item: MenuItem;
  qty: number;
}

interface CartValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (item: MenuItem) => void;
  setQty: (menuItemId: string, delta: number) => void;
  clear: () => void;
  open: boolean;
  setOpen: (v: boolean) => void;
}

const CartContext = createContext<CartValue | null>(null);

const STORAGE_KEY = 'plate_flame_cart';

function readStoredLines(): CartLine[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartLine[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const { user } = useAuth();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setLines(readStoredLines());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* storage unavailable */
    }
  }, [lines]);

  function add(item: MenuItem) {
    if (!user) {
      toast('Sign in to start an order.', 'info');
      return;
    }
    setLines((prev) => {
      const found = prev.find((l) => l.item.id === item.id);
      if (found) {
        return prev.map((l) => (l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { item, qty: 1 }];
    });
    toast(`${item.name} added to your order.`, 'success');
  }

  function setQty(menuItemId: string, delta: number) {
    setLines((prev) =>
      prev
        .map((l) => (l.item.id === menuItemId ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    );
  }

  function clear() {
    setLines([]);
  }

  const count = useMemo(() => lines.reduce((s, l) => s + l.qty, 0), [lines]);
  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.item.price * l.qty, 0), [lines]);

  return (
    <CartContext.Provider value={{ lines, count, subtotal, add, setQty, clear, open, setOpen }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}