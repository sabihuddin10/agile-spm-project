'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { EllipsisHorizontalIcon } from '@/components/ui/icons';

export interface RowAction {
  label: string;
  /** Accessible name when the visible label alone is ambiguous across rows. */
  ariaLabel?: string;
  onSelect: () => void;
  disabled?: boolean;
  title?: string;
  /** Destructive: rendered red, below a divider. */
  danger?: boolean;
}

/**
 * Compact "More" menu for secondary row actions. Follows the WAI-ARIA menu
 * button pattern: the trigger has aria-haspopup / aria-expanded, arrow keys
 * move between items, Escape (or a click outside) closes and returns focus.
 */
export function RowActionsMenu({
  label,
  actions,
  disabled = false,
  title,
}: {
  /** Accessible name for the trigger, e.g. "More actions for Sam". */
  label: string;
  actions: RowAction[];
  disabled?: boolean;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const regular = actions.filter((a) => !a.danger);
  const destructive = actions.filter((a) => a.danger);

  useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');
    first?.focus();
    function onPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function onMenuKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [],
    );
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  }

  function renderItem(a: RowAction) {
    return (
      <button
        key={a.label}
        type="button"
        role="menuitem"
        aria-label={a.ariaLabel}
        title={a.title}
        disabled={a.disabled}
        className={`block w-full px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
          a.danger
            ? 'text-red-600 hover:bg-red-50 focus:bg-red-50'
            : 'text-stone-700 hover:bg-stone-50 focus:bg-stone-50'
        } focus:outline-none`}
        onClick={() => {
          close(false);
          a.onSelect();
        }}
      >
        {a.label}
      </button>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        className="btn-secondary h-9 w-9 shrink-0 p-0 lg:h-9 lg:min-h-[36px] lg:px-0"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        title={title}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <EllipsisHorizontalIcon className="h-4 w-4" />
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-lg border border-stone-200 bg-white py-1 shadow-lg"
        >
          {regular.map(renderItem)}
          {regular.length && destructive.length ? <div role="separator" className="my-1 border-t border-stone-100" /> : null}
          {destructive.map(renderItem)}
        </div>
      ) : null}
    </div>
  );
}
