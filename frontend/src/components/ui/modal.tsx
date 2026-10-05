'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';

export function Modal({
  title,
  children,
  onClose,
  wide = false,
  dark = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  /** Storefront (charcoal) styling. */
  dark?: boolean;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className={`fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 sm:p-8 ${
        dark ? 'bg-char-deep/75 backdrop-blur-sm' : 'bg-stone-900/40'
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`w-full ${wide ? 'max-w-2xl' : 'max-w-xl'} rounded-xl shadow-xl ${
          dark ? 'border border-char-hairline bg-char-raised text-bone' : 'bg-white'
        }`}
      >
        <div className={`flex items-center justify-between border-b px-5 py-4 ${dark ? 'border-char-hairline' : 'border-stone-200'}`}>
          <h2 className={`font-semibold ${dark ? 'font-display text-lg text-bone' : ''}`}>{title}</h2>
          <button
            onClick={onClose}
            className={dark ? 'text-bone-faint hover:text-bone' : 'text-stone-400 hover:text-stone-600'}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
