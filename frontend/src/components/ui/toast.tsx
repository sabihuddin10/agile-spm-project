'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { XMarkIcon } from '@/components/ui/icons';

type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
}

const ToastContext = createContext<{
  toast: (message: string, tone?: ToastTone) => void;
} | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = `toast_${++counter}`;
      setItems((prev) => [...prev, { id, message, tone }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed bottom-24 right-4 z-[90] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 lg:bottom-4"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : undefined}
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg ${
              t.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : t.tone === 'error'
                  ? 'border-red-200 bg-red-50 text-red-800'
                  : 'border-stone-200 bg-white text-stone-800'
            }`}
          >
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => remove(t.id)}
              type="button"
              className="-my-1 -mr-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md opacity-70 transition hover:opacity-100"
              aria-label="Dismiss"
            >
              <XMarkIcon />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx.toast;
}