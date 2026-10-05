'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { notificationApi } from '@/lib/api';
import type { AppNotification } from '@/types';
import { usePolling } from '@/hooks/use-polling';
import { timeAgo } from '@/lib/format';

/**
 * In-app notifications with an unread badge, polled every 8 s — e.g. waiters
 * hear about ready dishes (US4.4), customers about confirmed bookings (US7.2).
 */
export function NotificationBell({ variant = 'light', align = 'right' }: { variant?: 'light' | 'dark'; align?: 'left' | 'right' }) {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await notificationApi.list();
      setItems(res.notifications);
      setUnread(res.unreadCount);
    } catch {
      /* transient — try again on the next poll */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  usePolling(load, 8000);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  async function openItem(n: AppNotification) {
    if (!n.read) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      notificationApi.read(n.id).catch(() => undefined);
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  async function readAll() {
    setItems((list) => list.map((x) => ({ ...x, read: true })));
    setUnread(0);
    await notificationApi.readAll().catch(() => undefined);
  }

  const dark = variant === 'dark';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative flex h-9 w-9 items-center justify-center rounded-full transition ${
          dark ? 'text-bone-dim hover:bg-char-raised hover:text-bone' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
        }`}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-5 w-5" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border shadow-lg ${
            dark ? 'border-char-hairline bg-char-raised' : 'border-stone-200 bg-white'
          }`}
        >
          <div className={`flex items-center justify-between border-b px-4 py-2.5 ${dark ? 'border-char-hairline' : 'border-stone-100'}`}>
            <p className={`text-sm font-semibold ${dark ? 'text-bone' : 'text-stone-800'}`}>Notifications</p>
            {unread > 0 ? (
              <button onClick={readAll} className={`text-xs ${dark ? 'text-ember-soft' : 'text-brand-600'} hover:underline`}>
                Mark all read
              </button>
            ) : null}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <li className={`px-4 py-8 text-center text-sm ${dark ? 'text-bone-faint' : 'text-stone-400'}`}>You&apos;re all caught up.</li>
            ) : (
              items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => openItem(n)}
                    className={`flex w-full gap-3 px-4 py-3 text-left transition ${
                      dark ? 'hover:bg-char-deep' : 'hover:bg-stone-50'
                    } ${n.read ? 'opacity-60' : ''}`}
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : dark ? 'bg-ember' : 'bg-brand-500'}`} />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm font-medium ${dark ? 'text-bone' : 'text-stone-800'}`}>{n.title}</span>
                      <span className={`block text-xs ${dark ? 'text-bone-dim' : 'text-stone-500'}`}>{n.message}</span>
                      <span className={`mt-0.5 block text-[11px] ${dark ? 'text-bone-faint' : 'text-stone-400'}`}>{timeAgo(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
