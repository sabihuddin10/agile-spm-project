import type { ItemStatus, OrderStatus, PaymentStatus, ReservationStatus, SelectedModifier, ShiftStatus, TableStatus } from '@/types';

export type Tone = 'emerald' | 'amber' | 'red' | 'stone' | 'brand' | 'blue';

export function money(amount: number | null | undefined): string {
  return `$${(amount ?? 0).toFixed(2)}`;
}

export function percent(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local date as 'YYYY-MM-DD' (matches the server's date strings). */
export function localDateISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDaysISO(days: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return localDateISO(d);
}

/** 'YYYY-MM-DD' → 'Mon 5 Oct'. */
export function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function minutesSince(iso: string | null | undefined, now: number = Date.now()): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

/** '3 min', '1 h 05 min'. */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${pad(minutes % 60)} min`;
}

export function timeAgo(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '';
  const m = minutesSince(iso, now);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 24 * 60) return `${Math.floor(m / 60)} h ago`;
  return formatDateTime(iso);
}

/** 'Large (+$4.00), Mushrooms (+$1.50)'. */
export function modifierText(mods: SelectedModifier[] | undefined): string {
  return (mods ?? [])
    .map((m) => (m.priceDelta ? `${m.label} (+${money(m.priceDelta)})` : m.label))
    .join(', ');
}

export function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  placed: { label: 'Placed', tone: 'stone' },
  confirmed: { label: 'Confirmed', tone: 'blue' },
  preparing: { label: 'Preparing', tone: 'amber' },
  ready: { label: 'Ready', tone: 'emerald' },
  served: { label: 'Served', tone: 'brand' },
  closed: { label: 'Closed', tone: 'stone' },
  cancelled: { label: 'Cancelled', tone: 'red' },
};

/** Lifecycle order for progress indicators (cancelled excluded). */
export const ORDER_FLOW: OrderStatus[] = ['placed', 'confirmed', 'preparing', 'ready', 'served', 'closed'];

export const ITEM_STATUS: Record<ItemStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Awaiting confirm', tone: 'stone' },
  queued: { label: 'Queued', tone: 'blue' },
  preparing: { label: 'In prep', tone: 'amber' },
  ready: { label: 'Ready', tone: 'emerald' },
  served: { label: 'Served', tone: 'stone' },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  unpaid: { label: 'Unpaid', tone: 'amber' },
  paid: { label: 'Paid', tone: 'emerald' },
  refunded: { label: 'Refunded', tone: 'red' },
};

export const RESERVATION_STATUS: Record<ReservationStatus, { label: string; tone: Tone }> = {
  requested: { label: 'Requested', tone: 'amber' },
  confirmed: { label: 'Confirmed', tone: 'blue' },
  seated: { label: 'Seated', tone: 'emerald' },
  cancelled: { label: 'Cancelled', tone: 'red' },
  no_show: { label: 'No-show', tone: 'stone' },
};

export const TABLE_STATUS: Record<TableStatus, { label: string; tone: Tone }> = {
  free: { label: 'Free', tone: 'emerald' },
  occupied: { label: 'Occupied', tone: 'amber' },
  reserved: { label: 'Reserved', tone: 'blue' },
  cleaning: { label: 'Cleaning', tone: 'stone' },
};

export const SHIFT_STATUS: Record<ShiftStatus, { label: string; tone: Tone }> = {
  scheduled: { label: 'Scheduled', tone: 'blue' },
  completed: { label: 'Completed', tone: 'emerald' },
  missed: { label: 'Missed', tone: 'red' },
};

export function errorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  return err instanceof Error ? err.message : fallback;
}
