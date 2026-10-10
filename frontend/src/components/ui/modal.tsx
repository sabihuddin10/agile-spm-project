'use client';

import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { XMarkIcon } from '@/components/ui/icons';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Open modals, innermost last — only the topmost one reacts to Escape / Tab. */
const modalStack: { token: symbol; panel: HTMLElement | null }[] = [];

function pushModal(entry: { token: symbol; panel: HTMLElement | null }) {
  // Effects run child-first, so a nested modal may register before its parent:
  // keep any modal rendered inside this one above it.
  const i = entry.panel ? modalStack.findIndex((m) => m.panel && entry.panel!.contains(m.panel)) : -1;
  if (i === -1) modalStack.push(entry);
  else modalStack.splice(i, 0, entry);
}

function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.hasAttribute('inert'));
}

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
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Focus management: move focus in on open, restore it on close.
  useEffect(() => {
    const token = Symbol('modal');
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    pushModal({ token, panel });
    // Skip when a nested modal (whose effect ran first) already took focus.
    if (panel && !panel.contains(document.activeElement)) {
      // Prefer the first control in the body over the header close button.
      const body = panel.querySelector<HTMLElement>('[data-modal-body]');
      const target = (body && focusableIn(body)[0]) || focusableIn(panel)[0] || panel;
      target.focus();
    }

    function onKey(e: KeyboardEvent) {
      if (modalStack[modalStack.length - 1]?.token !== token) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab' && panel) {
        const items = focusableIn(panel);
        if (items.length === 0) {
          e.preventDefault();
          panel.focus();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !panel.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const i = modalStack.findIndex((m) => m.token === token);
      if (i !== -1) modalStack.splice(i, 1);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function' && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-3 sm:p-8 ${
        dark ? 'bg-char-deep/75 backdrop-blur-sm' : 'bg-stone-900/40'
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`w-full ${wide ? 'max-w-2xl' : 'max-w-xl'} rounded-xl shadow-xl focus:outline-none ${
          dark ? 'border border-char-hairline bg-char-raised text-bone' : 'bg-white'
        }`}
      >
        <div
          className={`flex items-center justify-between gap-3 border-b py-2 pl-4 pr-2 sm:py-3 sm:pl-5 sm:pr-3 ${dark ? 'border-char-hairline' : 'border-stone-200'}`}
        >
          <h2 id={titleId} className={`font-semibold ${dark ? 'font-display text-lg text-bone' : ''}`}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
              dark ? 'text-bone-faint hover:bg-char-hairline hover:text-bone' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-700'
            }`}
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 sm:p-5" data-modal-body>
          {children}
        </div>
      </div>
    </div>
  );
}
