import { Router } from 'express';
import { orders, inventory, reservations, tables, settings } from '../data/store.js';
import { requireRole } from '../middleware/auth.js';
import { ACTIVE_STATUSES } from '../lib/orders.js';
import { lineTotal, toCents, fromCents } from '../lib/order-math.js';
import { MINUTE, addDays, combine, isValidDate, localDate, weekStart } from '../lib/time.js';

const router = Router();
const analyticsRoles = requireRole('manager', 'admin');

const netCents = (o) => toCents(o.total) - toCents(o.refund?.amount ?? 0);
const isRevenue = (o) => o.status !== 'cancelled' && o.paymentStatus !== 'unpaid';
const round1 = (n) => Math.round(n * 10) / 10;

function bucketKey(date, granularity) {
  if (granularity === 'month') return localDate(date).slice(0, 7);
  if (granularity === 'week') return weekStart(date);
  return localDate(date);
}

function bucketsBetween(from, to, granularity) {
  const keys = [];
  for (let d = combine(from, '00:00'); localDate(d) <= to; d = addDays(d, 1)) {
    const key = bucketKey(d, granularity);
    if (!keys.includes(key)) keys.push(key);
  }
  return keys;
}

/** GET /api/analytics/summary — today's headline numbers for the staff overview. */
router.get('/summary', analyticsRoles, (req, res) => {
  const today = localDate();
  const todays = orders.filter((o) => localDate(new Date(o.createdAt)) === today && o.status !== 'cancelled');
  const revenueToday = todays.filter(isRevenue).reduce((s, o) => s + netCents(o), 0);
  res.json({
    summary: {
      revenueToday: fromCents(revenueToday),
      ordersToday: todays.length,
      activeOrders: orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length,
      openBills: orders.filter((o) => o.status !== 'cancelled' && o.paymentStatus === 'unpaid').length,
      lowStock: inventory.filter((i) => i.stock <= i.reorderLevel).length,
      bookingsToday: reservations.filter((r) => r.date === today && ['requested', 'confirmed'].includes(r.status)).length,
    },
  });
});

/**
 * GET /api/analytics/dashboard?from=&to=&granularity=day|week|month
 * KPI dashboard (US10.1–US10.6). Defaults to the last 30 days by day.
 */
router.get('/dashboard', analyticsRoles, (req, res) => {
  const today = localDate();
  const to = isValidDate(req.query.to) ? req.query.to : today;
  const from = isValidDate(req.query.from) ? req.query.from : localDate(addDays(combine(to, '00:00'), -29));
  if (from > to) return res.status(400).json({ error: '"from" must be on or before "to".' });
  const granularity = ['day', 'week', 'month'].includes(req.query.granularity) ? req.query.granularity : 'day';

  const inRange = orders.filter((o) => {
    const d = localDate(new Date(o.createdAt));
    return d >= from && d <= to;
  });
  const placed = inRange.filter((o) => o.status !== 'cancelled');
  const paid = inRange.filter(isRevenue);

  /* KPIs */
  const revenueC = paid.reduce((s, o) => s + netCents(o), 0);
  const kpis = {
    revenue: fromCents(revenueC),
    orders: placed.length,
    avgOrder: paid.length ? fromCents(Math.round(revenueC / paid.length)) : 0,
    tips: fromCents(paid.reduce((s, o) => s + toCents(o.tip), 0)),
    refunds: fromCents(inRange.reduce((s, o) => s + toCents(o.refund?.amount ?? 0), 0)),
    cancelled: inRange.length - placed.length,
    customers: new Set(placed.filter((o) => o.customerId).map((o) => o.customerId)).size,
  };

  /* US10.1 revenue & order trend */
  const trendMap = new Map(bucketsBetween(from, to, granularity).map((k) => [k, { period: k, revenue: 0, orders: 0 }]));
  for (const o of placed) {
    const b = trendMap.get(bucketKey(new Date(o.createdAt), granularity));
    if (!b) continue;
    b.orders += 1;
    if (isRevenue(o)) b.revenue += netCents(o);
  }
  const trend = [...trendMap.values()].map((b) => ({ ...b, revenue: fromCents(b.revenue) }));

  /* US10.2 top-selling dishes by quantity and revenue */
  const dishMap = new Map();
  for (const o of paid) {
    for (const i of o.items) {
      const d = dishMap.get(i.name) || { name: i.name, qty: 0, revenue: 0 };
      d.qty += i.qty;
      d.revenue += toCents(lineTotal(i));
      dishMap.set(i.name, d);
    }
  }
  const dishes = [...dishMap.values()].map((d) => ({ ...d, revenue: fromCents(d.revenue) }));

  /* US10.3 table turnover & utilization */
  const days = bucketsBetween(from, to, 'day').length;
  const openMinutes = days * (settings.closingHour - settings.openingHour) * 60;
  const tableStats = tables
    .slice()
    .sort((a, b) => a.number - b.number)
    .map((t) => {
      const sittings = inRange.filter((o) => o.tableId === t.id && o.status === 'closed' && o.closedAt);
      const minutes = sittings.map((o) => (new Date(o.closedAt) - new Date(o.createdAt)) / MINUTE);
      const occupied = minutes.reduce((s, m) => s + m, 0);
      return {
        tableId: t.id,
        number: t.number,
        zone: t.zone,
        seats: t.seats,
        turns: sittings.length,
        avgTurnoverMinutes: sittings.length ? Math.round(occupied / sittings.length) : 0,
        occupancyRate: openMinutes ? round1((occupied / openMinutes) * 100) : 0,
      };
    });
  const zones = [...new Set(tableStats.map((t) => t.zone))].map((zone) => {
    const list = tableStats.filter((t) => t.zone === zone);
    const turns = list.reduce((s, t) => s + t.turns, 0);
    return {
      zone,
      tables: list.length,
      turns,
      avgTurnoverMinutes: turns ? Math.round(list.reduce((s, t) => s + t.avgTurnoverMinutes * t.turns, 0) / turns) : 0,
      occupancyRate: round1(list.reduce((s, t) => s + t.occupancyRate, 0) / list.length),
    };
  });

  /* US10.4 peak hours */
  const peakHours = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, revenue: 0 }));
  for (const o of placed) {
    const h = peakHours[new Date(o.createdAt).getHours()];
    h.orders += 1;
    if (isRevenue(o)) h.revenue += netCents(o);
  }
  const hours = peakHours
    .map((h) => ({ ...h, revenue: fromCents(h.revenue), avgPerDay: round1(h.orders / days) }))
    .filter((h) => h.hour >= settings.openingHour - 1 && h.hour <= settings.closingHour);

  /* US10.5 inventory health */
  const inventoryHealth = inventory
    .map((i) => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      stock: i.stock,
      reorderLevel: i.reorderLevel,
      status: i.stock <= i.reorderLevel ? 'low' : i.stock <= i.reorderLevel * 1.25 ? 'near' : 'ok',
      coverage: i.reorderLevel ? round1((i.stock / i.reorderLevel) * 100) : 100,
    }))
    .sort((a, b) => a.coverage - b.coverage);

  /* US10.6 reservation no-show rate (bookings that were due to arrive) */
  const bookings = reservations.filter((r) => r.date >= from && r.date <= to);
  const seated = bookings.filter((r) => r.status === 'seated').length;
  const noShows = bookings.filter((r) => r.status === 'no_show').length;
  const cancelledBookings = bookings.filter((r) => r.status === 'cancelled').length;
  const due = seated + noShows;

  res.json({
    range: { from, to, granularity, days },
    kpis,
    trend,
    dishes,
    tables: tableStats,
    zones,
    peakHours: hours,
    inventory: inventoryHealth,
    reservations: {
      total: bookings.length,
      seated,
      noShows,
      cancelled: cancelledBookings,
      noShowRate: due ? round1((noShows / due) * 100) : 0,
      cancellationRate: bookings.length ? round1((cancelledBookings / bookings.length) * 100) : 0,
    },
  });
});

export default router;
