import type { AnalyticsSummary, KitchenResponse, Order, Table, User } from '@/types';
import { minutesSince, money, timeAgo } from '@/lib/format';
import { LiveTile, TileGroup } from '@/components/overview/live-tile';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Floor widgets for waiters, managers and admins: orders awaiting confirmation,
 * orders ready to serve, and the tables assigned to the signed-in user.
 */
export function FloorWidgets({
  user,
  placed,
  ready,
  tables,
  loading,
  now,
}: {
  user: User;
  placed: Order[] | null;
  ready: Order[] | null;
  tables: Table[] | null;
  loading: boolean;
  now: number;
}) {
  const myTables = (tables ?? []).filter((t) => t.waiterId === user.id).sort((a, b) => a.number - b.number);
  const myTableIds = new Set(myTables.map((t) => t.id));
  const oldestPlaced = placed?.reduce<Order | null>((o, x) => (!o || x.createdAt < o.createdAt ? x : o), null) ?? null;
  const readyForMe = (ready ?? []).filter((o) => o.waiterId === user.id || (o.tableId && myTableIds.has(o.tableId))).length;
  const occupied = myTables.filter((t) => t.status === 'occupied').length;

  return (
    <TileGroup title="Front of house">
      <LiveTile
        href="/staff/orders"
        label="Needs confirmation"
        loading={loading && !placed}
        value={placed ? placed.length : '—'}
        flag={placed && placed.length > 0 ? { tone: 'amber', label: 'Action needed' } : null}
        hint={oldestPlaced ? `Oldest placed ${timeAgo(oldestPlaced.createdAt, now)}` : 'No orders waiting'}
      />
      <LiveTile
        href="/staff/orders"
        label="Ready to serve"
        loading={loading && !ready}
        value={ready ? ready.length : '—'}
        flag={ready && ready.length > 0 ? { tone: 'emerald', label: 'At the pass' } : null}
        hint={ready && ready.length > 0 ? `${readyForMe} for your tables` : 'Nothing waiting at the pass'}
      />
      <LiveTile
        href="/staff/tables"
        label="My tables"
        loading={loading && !tables}
        value={tables ? myTables.length : '—'}
        hint={
          myTables.length > 0
            ? `${myTables.map((t) => `T${t.number}`).join(', ')} · ${occupied} occupied`
            : 'No tables assigned to you'
        }
      />
    </TileGroup>
  );
}

/** Kitchen widgets for chefs, managers and admins: queue size, delayed tickets and pickups. */
export function KitchenWidgets({
  kitchen,
  loading,
  now,
}: {
  kitchen: KitchenResponse | null;
  loading: boolean;
  now: number;
}) {
  const queue = kitchen?.queue ?? [];
  const delayed = kitchen
    ? queue.filter((o) => minutesSince(o.confirmedAt ?? o.createdAt, now) > kitchen.delayMinutes).length
    : 0;
  const cooking = queue.filter((o) => o.status === 'preparing').length;
  const isLoading = loading && !kitchen;

  return (
    <TileGroup title="Kitchen">
      <LiveTile
        href="/staff/kitchen"
        label="Kitchen queue"
        loading={isLoading}
        value={kitchen ? queue.length : '—'}
        hint={kitchen ? `${cooking} cooking · ${queue.length - cooking} waiting` : undefined}
      />
      <LiveTile
        href="/staff/kitchen"
        label="Delayed"
        loading={isLoading}
        value={kitchen ? delayed : '—'}
        flag={delayed > 0 ? { tone: 'red', label: 'Over time' } : null}
        hint={kitchen ? `Over ${kitchen.delayMinutes} min since confirmed` : undefined}
      />
      <LiveTile
        href="/staff/kitchen"
        label="Ready for pickup"
        loading={isLoading}
        value={kitchen ? kitchen.ready.length : '—'}
        flag={kitchen && kitchen.ready.length > 0 ? { tone: 'emerald', label: 'At the pass' } : null}
        hint={kitchen ? (kitchen.ready.length ? `${plural(kitchen.ready.length, 'order')} waiting for service` : 'Pass is clear') : undefined}
      />
    </TileGroup>
  );
}

/** Today's headline numbers for managers and admins (GET /analytics/summary). */
export function TodaySummary({ summary, loading }: { summary: AnalyticsSummary | null; loading: boolean }) {
  const isLoading = loading && !summary;
  const v = (n: number | undefined) => (summary ? n : '—');
  return (
    <TileGroup title="Today at a glance" cols={6}>
      <LiveTile href="/staff/billing" label="Revenue today" loading={isLoading} value={summary ? money(summary.revenueToday) : '—'} hint="Paid, net of refunds" />
      <LiveTile href="/staff/orders" label="Orders today" loading={isLoading} value={v(summary?.ordersToday)} hint="Excluding cancelled" />
      <LiveTile href="/staff/orders" label="Active orders" loading={isLoading} value={v(summary?.activeOrders)} hint="In progress now" />
      <LiveTile
        href="/staff/billing"
        label="Open bills"
        loading={isLoading}
        value={v(summary?.openBills)}
        hint="Awaiting payment"
      />
      <LiveTile
        href="/staff/reservations"
        label="Bookings today"
        loading={isLoading}
        value={v(summary?.bookingsToday)}
        hint="Requested or confirmed"
      />
      <LiveTile
        href="/staff/inventory"
        label="Low stock"
        loading={isLoading}
        value={v(summary?.lowStock)}
        flag={summary && summary.lowStock > 0 ? { tone: 'red', label: 'Reorder' } : null}
        hint="At or below reorder level"
      />
    </TileGroup>
  );
}
