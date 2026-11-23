/**
 * Seed one month of realistic restaurant operations into the database:
 * orders (completed, refunded, partially refunded, cancelled, unpaid/left),
 * reservations (seated, cancelled, no-shows, upcoming), shifts (worked,
 * missed, off days), attendance (late, early leave, breaks, open sessions)
 * and pay adjustments.
 *
 *   node scripts/seed-operations.js --dry-run     # generate, print, roll back
 *   node scripts/seed-operations.js               # DATABASE_URL from server/.env
 *   node scripts/seed-operations.js --url=postgres://...
 *
 * Only operational history is replaced. Users, menu, inventory, tables,
 * settings and applications are kept. The database must already hold the app
 * state (run `db:init` or start the API once first). `state_version` is bumped
 * so running instances reload the new data on their next request.
 */
import 'dotenv/config';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { createPool } from '../src/data/db.js';
import { ensureSchema as applySchema } from '../src/data/relational/schema.js';
import { loadStore, saveStore } from '../src/data/relational/index.js';
import { snapshot, restore } from '../src/data/snapshot.js';
import {
  users, customers, stockMovements, menuItems, tables,
  orders, reservations, shifts, notifications, attendance, payAdjustments,
  counters, orderSeq, settings, nextId, createOrderRecord, buildOrderItem, TIME_SLOTS,
} from '../src/data/store.js';
import { computeTotals, toCents, fromCents, splitEvenCents } from '../src/lib/order-math.js';
import { MINUTE, combine, localDate, addDays, iso } from '../src/lib/time.js';
import { lateness, matchShift, rulesFrom } from '../src/lib/attendance.js';
import { syncTableHolds } from '../src/lib/reservations.js';
import { ACTIVE_STATUSES } from '../src/lib/orders.js';
import { mulberry32 } from '../src/data/seed-history.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = resolve(HERE, '..');
const LOCK_KEY = 727274;

const RANGE_START = '2026-10-15';
const RANGE_END = '2026-11-15';
const SCHEDULE_END = '2026-11-22';

const HOUR_WEIGHTS = [[12, 4], [13, 5], [14, 2], [15, 1], [16, 1], [17, 2], [18, 4], [19, 6], [20, 5], [21, 2]];
const TODAY_HOURS = [[12, 4], [13, 5], [14, 3], [15, 2], [16, 2], [17, 2]];
const POPULARITY = {
  'Margherita Pizza': 9,
  'Beef Burger': 8,
  Fries: 7,
  Lemonade: 6,
  Soda: 6,
  'Vegan Bowl': 5,
  'Caesar Salad': 5,
  'Garlic Bread': 5,
  'Iced Tea': 4,
  'Hummus Plate': 3,
  'Peanut Satay Skewers': 3,
};

const NAMED_CUSTOMERS = [
  ['Shayan Danish', 'walk-in', ['halal'], []],
  ['Umair Asad', 'online', ['halal'], ['peanuts']],
  ['Tawab Junejo', 'walk-in', ['vegetarian'], []],
  ['Ali Ansari', 'online', ['halal', 'gluten-free'], ['gluten']],
  ['Hamza Sheikh', 'walk-in', [], []],
  ['Bilal Ahmed', 'online', ['halal'], ['dairy']],
  ['Ayesha Khan', 'walk-in', ['vegetarian'], ['tree nuts']],
  ['Zainab Malik', 'online', ['vegan'], ['sesame']],
  ['Faizan Raza', 'walk-in', ['halal'], []],
  ['Hira Shah', 'online', ['gluten-free'], ['gluten']],
  ['Daniyal Qureshi', 'walk-in', ['halal'], ['shellfish']],
  ['Mahnoor Ali', 'online', ['vegetarian', 'nut-free'], ['tree nuts']],
  ['Usman Tariq', 'walk-in', [], []],
  ['Sana Javed', 'online', ['halal'], ['dairy']],
  ['Ahmed Raza', 'walk-in', ['halal'], []],
  ['Fatima Noor', 'online', ['vegan', 'gluten-free'], ['gluten', 'sesame']],
  ['Saad Iqbal', 'walk-in', [], []],
  ['Maryam Hussain', 'online', ['vegetarian'], ['eggs']],
];

const GUEST_NAMES = [
  'Adnan Sheikh', 'Mariam Farooq', 'Rohail Abbas', 'Nimra Shahid', 'Kashif Mehmood',
  'Laiba Anwar', 'Tanveer Hussain', 'Rabia Aslam', 'Junaid Akhtar', 'Areeba Siddiqui',
];

const REFUND_REASONS = [
  'Wrong dish served', 'Long wait — goodwill refund', 'Duplicate card charge',
  'Cold food on delivery', 'Order missing an item',
];
const CANCEL_REASONS = [
  'Guest changed plans', 'Duplicate order', 'Item unavailable', 'Guest left before ordering',
];
const SPECIAL_REQUESTS = ['', '', 'Window table', 'Birthday — bring dessert', 'High chair needed', 'Anniversary dinner', 'Quiet corner'];
const ADJUSTMENTS = [
  [0, 50, 'Quarterly performance bonus', -26],
  [1, 25, 'Covered a double shift', -14],
  [2, -10, 'Broken glassware', -9],
  [0, 40, 'Customer compliment — named in review', -5],
  [3, -15, 'Cash drawer shortage', -3],
  [4, 30, 'Training new hire', -2],
];

const log = (...parts) => console.log('[seed:operations]', ...parts);

if (!process.env.DATABASE_URL) {
  const envFile = join(SERVER_ROOT, '.env');
  if (existsSync(envFile)) loadDotenv({ path: envFile });
}

function resolveUrl(argv) {
  const inline = argv.find((arg) => arg.startsWith('--url='));
  if (inline) return inline.slice('--url='.length);
  const at = argv.indexOf('--url');
  if (at !== -1 && argv[at + 1] && !argv[at + 1].startsWith('--')) return argv[at + 1];
  return (process.env.DATABASE_URL ?? '').trim().replace(/^['"]|['"]$/g, '') || null;
}

const slugOf = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '');
const money = (n) => Math.round(Number(n) * 100) / 100;
const numericSuffix = (id, prefix) => {
  const m = new RegExp(`^${prefix}_(\\d+)$`).exec(String(id));
  return m ? Number(m[1]) : 0;
};
const maxSuffix = (ids, prefix) => ids.reduce((max, id) => Math.max(max, numericSuffix(id, prefix)), 0);
const roundSlot = (date, direction) => {
  const out = new Date(date);
  out.setSeconds(0, 0);
  const minutes = out.getMinutes();
  if (direction === 'up') out.setMinutes(minutes === 0 || minutes === 30 ? minutes : minutes < 30 ? 30 : 60);
  else out.setMinutes(minutes < 30 ? 0 : 30);
  return out;
};
const eachDate = (from, to, fn) => {
  for (let d = combine(from, '00:00'); localDate(d) <= to; d = addDays(d, 1)) fn(d);
};

function applyOperations(now = new Date()) {
  const rand = mulberry32(20261115);
  const between = (min, max) => min + Math.floor(rand() * (max - min + 1));
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const chance = (p) => rand() < p;
  const weighted = (entries) => {
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let r = rand() * total;
    for (const [value, w] of entries) {
      r -= w;
      if (r <= 0) return value;
    }
    return entries[entries.length - 1][0];
  };
  const nowMs = now.getTime();
  const today = localDate(now);
  const cutoffMs = nowMs - 90 * MINUTE;
  const rules = rulesFrom(settings);

  const byRole = (role) => users.filter((u) => u.active !== false && u.role === role);
  const waiters = byRole('waiter');
  const chefs = byRole('chef');
  const managers = byRole('manager');
  const admins = byRole('admin');
  if (!waiters.length || !chefs.length || !managers.length) {
    throw new Error('database needs at least one waiter, one chef and one manager account');
  }
  const refundBy = pick(managers).id;
  const shiftBy = pick(managers).id;
  const adjustBy = pick(admins.length ? admins : managers).id;

  const named = NAMED_CUSTOMERS.map(([name, type, dietary, allergies], i) => ({
    id: `cus_${slugOf(name)}`,
    userId: null,
    name,
    email: `${slugOf(name)}@gmail.com`,
    phone: `+92 300 555${String(200 + i).padStart(4, '0')}`,
    type,
    loyaltyPoints: 0,
    preferences: { dietary, allergies },
    notes: pick(['', '', 'Prefers a booth', 'Regular Friday lunch', 'Corporate account', 'Likes a window table']),
    createdAt: iso(addDays(combine(RANGE_START, '00:00'), -between(20, 120))),
  }));
  const namedIds = new Set(named.map((c) => c.id));
  for (let i = customers.length - 1; i >= 0; i -= 1) if (namedIds.has(customers[i].id)) customers.splice(i, 1);
  customers.push(...named);
  const regulars = customers.filter((c) => !namedIds.has(c.id));

  counters.cus = Math.max(counters.cus || 0, maxSuffix(customers.map((c) => c.id), 'cus'));
  counters.usr = Math.max(counters.usr || 0, maxSuffix(users.map((u) => u.id), 'usr'));
  for (const key of ['ord', 'oi', 'res', 'shf', 'att', 'adj', 'ntf', 'mov']) counters[key] = 0;
  orders.length = 0;
  reservations.length = 0;
  shifts.length = 0;
  attendance.length = 0;
  payAdjustments.length = 0;
  notifications.length = 0;
  stockMovements.length = 0;

  function randomItems(lines) {
    const entries = menuItems.filter((m) => m.available).map((m) => [m, POPULARITY[m.name] ?? 2]);
    const out = [];
    for (let i = 0; i < lines; i += 1) {
      const item = weighted(entries);
      if (out.some((l) => l.menuItemId === item.id)) continue;
      const selections = [];
      for (const g of item.modifiers) {
        if (g.type === 'single' && chance(0.4)) selections.push({ group: g.name, label: pick(g.options).label });
        if (g.type === 'multi' && chance(0.25)) selections.push({ group: g.name, label: pick(g.options).label });
      }
      out.push(buildOrderItem(item, chance(0.8) ? 1 : 2, selections, 'pending', { preparedBy: pick(chefs).id }));
    }
    if (out.length) return out;
    const fallback = menuItems.find((m) => m.available);
    return [buildOrderItem(fallback, 1, [], 'pending', { preparedBy: pick(chefs).id })];
  }

  function chooseCustomer(dineIn) {
    if (dineIn) {
      const r = rand();
      if (r < 0.35) return pick(named);
      if (r < 0.5) return pick(regulars);
      return null;
    }
    const r = rand();
    if (r < 0.7) return pick(named);
    if (r < 0.9) return pick(regulars);
    return null;
  }

  function markItems(order, status) {
    order.items.forEach((item, i) => {
      item.status = status === 'closed' ? 'served'
        : status === 'cancelled' ? 'queued'
        : status === 'served' ? 'served'
        : status === 'ready' ? 'ready'
        : status === 'preparing' ? (i === 0 ? 'preparing' : 'queued')
        : status === 'confirmed' ? 'queued'
        : 'pending';
      item.readyAt = ['closed', 'served', 'ready'].includes(status) ? order.readyAt : null;
      item.servedAt = ['closed', 'served'].includes(status) ? order.servedAt : null;
    });
  }

  function finishTimestamps(order, times, status) {
    if (status === 'closed') {
      order.status = 'closed';
      order.paymentStatus = 'paid';
      order.paidAt = iso(new Date(times.paidMs));
      order.closedAt = order.paidAt;
      markItems(order, 'closed');
      order.stockDeducted = true;
    } else if (status === 'cancelled') {
      order.status = 'cancelled';
      order.cancelledAt = iso(new Date(times.cancelledMs));
      order.readyAt = null;
      order.servedAt = null;
      order.servedBy = null;
      order.paidAt = null;
      order.closedAt = null;
      order.paymentStatus = 'unpaid';
      order.paymentMethod = null;
      order.refund = null;
      order.pointsEarned = 0;
      order.stockDeducted = false;
      markItems(order, 'cancelled');
    } else if (status === 'served') {
      order.status = 'served';
      order.paymentStatus = 'unpaid';
      order.paidAt = null;
      order.closedAt = null;
      order.pointsEarned = 0;
      order.stockDeducted = false;
      markItems(order, 'served');
    }
    order.updatedAt = order.closedAt ?? order.cancelledAt ?? order.servedAt ?? order.readyAt ?? order.confirmedAt ?? order.createdAt;
  }

  function applySplit(order, payMs) {
    const ways = between(2, Math.min(4, Math.max(2, order.partySize ?? 2)));
    const cents = splitEvenCents(toCents(order.total), ways);
    const parts = cents.map((c, i) => ({
      label: `Guest ${i + 1}`,
      amount: fromCents(c),
      itemIds: [],
      paid: true,
      method: chance(0.7) ? 'card' : 'cash',
      paidAt: iso(new Date(payMs + i * between(1, 4) * MINUTE)),
    }));
    order.split = { mode: 'even', parts, createdAt: order.servedAt };
    order.paymentMethod = 'split';
    order.paidAt = parts.reduce((max, p) => (p.paidAt > max ? p.paidAt : max), parts[0].paidAt);
    order.closedAt = order.paidAt;
    order.updatedAt = order.paidAt;
  }

  function addOrder({ startMs, table, online }) {
    const party = online ? 1 : weighted([[1, 1], [2, 6], [3, 3], [4, 4], [5, 2], [6, 1]]);
    const customer = chooseCustomer(Boolean(table));
    const waiter = pick(waiters);
    const fulfillment = online ? (chance(0.6) ? 'pickup' : 'delivery') : 'dine-in';
    const lines = online ? between(1, 4) : between(1, Math.min(5, party + 1));
    const confirmedMs = startMs + between(1, 3) * MINUTE;
    const readyMs = confirmedMs + between(12, 30) * MINUTE;
    const servedMs = readyMs + (online ? between(2, 12) : between(3, 15)) * MINUTE;
    const prepaid = online && chance(0.55);
    const order = createOrderRecord({
      type: online ? 'online' : 'dine-in',
      fulfillment,
      tableId: table?.id ?? null,
      customerId: customer?.id ?? null,
      waiterId: waiter.id,
      createdBy: online ? customer?.userId ?? waiter.id : waiter.id,
      source: online ? 'customer' : 'staff',
      paymentMethod: prepaid ? 'card' : chance(0.7) ? 'card' : 'cash',
      priority: chance(0.06) ? 'rush' : 'normal',
      createdAt: iso(new Date(startMs)),
      confirmedAt: iso(new Date(confirmedMs)),
      readyAt: iso(new Date(readyMs)),
      servedAt: iso(new Date(servedMs)),
      servedBy: waiter.id,
      kitchenRank: confirmedMs,
      items: randomItems(lines),
      deliveryAddress: fulfillment === 'delivery' ? `${between(1, 99)} Market Street` : '',
      notes: fulfillment === 'delivery' && chance(0.3) ? 'Leave at reception.' : '',
    });
    order.partySize = party;
    if ((table && chance(0.55)) || (online && chance(0.2))) {
      order.tip = money(order.subtotal * pick([0.1, 0.12, 0.15]));
    }
    if (chance(0.06)) order.discount = money(Math.min(5, order.subtotal * 0.1));
    computeTotals(order);

    const roll = rand();
    if (roll < 0.035) {
      const paid = chance(0.45);
      finishTimestamps(order, {
        cancelledMs: startMs + between(6, 20) * MINUTE,
      }, 'cancelled');
      if (paid) {
        order.paymentStatus = 'refunded';
        order.paymentMethod = chance(0.8) ? 'card' : 'cash';
        order.paidAt = iso(new Date(startMs + between(1, 5) * MINUTE));
        order.refund = { amount: order.total, reason: pick(CANCEL_REASONS), at: order.cancelledAt, by: refundBy };
        order.pointsEarned = 0;
      }
      return order;
    }

    const paidMs = prepaid ? startMs + between(0, 2) * MINUTE : servedMs + between(4, 30) * MINUTE;
    finishTimestamps(order, { paidMs }, 'closed');
    if (prepaid) order.closedAt = iso(new Date(servedMs + between(3, 12) * MINUTE));
    if (customer) order.pointsEarned = Math.floor(order.total);

    if (table && chance(0.08)) {
      applySplit(order, servedMs + between(10, 35) * MINUTE);
      if (customer) order.pointsEarned = Math.floor(order.total);
    }

    if (chance(0.02)) {
      order.paymentStatus = 'refunded';
      order.refund = {
        amount: order.total,
        reason: pick(REFUND_REASONS),
        at: iso(new Date(Math.min(Date.parse(order.closedAt) + between(10, 180) * MINUTE, nowMs - MINUTE))),
        by: refundBy,
      };
      order.pointsEarned = 0;
    } else if (chance(0.028)) {
      order.paymentStatus = 'paid';
      order.refund = {
        amount: money(order.total * pick([0.1, 0.15, 0.25, 0.4])),
        reason: pick(REFUND_REASONS),
        at: iso(new Date(Math.min(Date.parse(order.closedAt) + between(10, 180) * MINUTE, nowMs - MINUTE))),
        by: refundBy,
      };
    }
    order.updatedAt = order.refund?.at ?? order.closedAt;
    return order;
  }

  eachDate(RANGE_START, RANGE_END, (day) => {
    const date = localDate(day);
    const isToday = date === today;
    const dow = day.getDay();
    const weekend = dow === 5 || dow === 6;
    const count = isToday ? between(12, 18) : weekend ? between(22, 30) : dow === 0 ? between(16, 22) : between(14, 20);
    const busyUntil = {};
    for (let i = 0; i < count; i += 1) {
      const hour = weighted(isToday ? TODAY_HOURS : HOUR_WEIGHTS);
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, between(0, 59));
      const startMs = start.getTime();
      if (isToday && startMs > cutoffMs) continue;
      const party = weighted([[1, 1], [2, 6], [3, 3], [4, 4], [5, 2], [6, 1]]);
      const wantsDineIn = chance(0.65);
      const table = wantsDineIn
        ? tables.filter((t) => t.seats >= party && (busyUntil[t.id] || 0) <= startMs).sort((a, b) => a.seats - b.seats)[0]
        : null;
      if (table) busyUntil[table.id] = startMs + (between(45, 85) + party * 5) * MINUTE;
      const order = addOrder({ startMs, table, online: !table });
      if (table && order.status !== 'closed' && order.status !== 'cancelled') {
        busyUntil[table.id] = Date.parse(order.servedAt ?? order.createdAt) + 15 * MINUTE;
      }
      orders.push(order);
    }
  });

  function liveOrder({ status, tableId, customer, minutesAgo, items, online = false, fulfillment = 'pickup', paymentStatus = 'unpaid', priority = 'normal', address = '' }) {
    const startMs = nowMs - minutesAgo * MINUTE;
    const waiter = pick(waiters);
    const confirmedMs = status === 'placed' ? null : startMs + between(1, 3) * MINUTE;
    const readyMs = ['ready', 'served'].includes(status) ? Math.min(startMs + between(12, 24) * MINUTE, nowMs - MINUTE) : null;
    const servedMs = status === 'served' ? startMs + between(30, 45) * MINUTE : null;
    const order = createOrderRecord({
      type: online ? 'online' : 'dine-in',
      fulfillment: online ? fulfillment : 'dine-in',
      tableId: tableId ?? null,
      customerId: customer?.id ?? null,
      waiterId: waiter.id,
      createdBy: customer?.userId ?? waiter.id,
      source: online ? 'customer' : 'staff',
      status,
      paymentStatus,
      paymentMethod: paymentStatus === 'paid' ? 'card' : online && fulfillment === 'pickup' ? 'cash' : null,
      priority,
      createdAt: iso(new Date(startMs)),
      confirmedAt: confirmedMs ? iso(new Date(confirmedMs)) : null,
      kitchenRank: confirmedMs,
      readyAt: readyMs ? iso(new Date(readyMs)) : null,
      servedAt: servedMs ? iso(new Date(servedMs)) : null,
      servedBy: ['ready', 'served'].includes(status) ? waiter.id : null,
      paidAt: paymentStatus === 'paid' ? iso(new Date(startMs + between(0, 2) * MINUTE)) : null,
      deliveryAddress: address,
      items: items.map(({ name, qty, selections, chef }) => {
        const item = menuItems.find((m) => m.name === name);
        return buildOrderItem(item, qty, selections ?? [], 'pending', { preparedBy: chef?.id ?? pick(chefs).id });
      }),
      notes: '',
    });
    markItems(order, status);
    if (paymentStatus === 'paid' && customer) order.pointsEarned = Math.floor(order.total);
    order.updatedAt = servedMs ? iso(new Date(servedMs)) : readyMs ? iso(new Date(readyMs)) : order.confirmedAt ?? order.createdAt;
    orders.push(order);
    return order;
  }

  const shayan = named.find((c) => c.name === 'Shayan Danish');
  const umair = named.find((c) => c.name === 'Umair Asad');
  const tawab = named.find((c) => c.name === 'Tawab Junejo');
  const ali = named.find((c) => c.name === 'Ali Ansari');
  const existing = regulars.find((c) => c.name === 'Emma Thompson') ?? regulars[0];

  liveOrder({ status: 'preparing', tableId: tables.find((t) => t.number === 4)?.id, customer: existing, minutesAgo: 28, items: [
    { name: 'Margherita Pizza', qty: 2, selections: [{ group: 'Size', label: 'Large' }, { group: 'Extras', label: 'Mushrooms' }] },
    { name: 'Garlic Bread', qty: 1 },
  ] });
  liveOrder({ status: 'placed', customer: umair, online: true, minutesAgo: 4, paymentStatus: 'paid', items: [
    { name: 'Vegan Bowl', qty: 1 },
    { name: 'Lemonade', qty: 2, selections: [{ group: 'Size', label: 'Large' }] },
  ] });
  liveOrder({ status: 'served', tableId: tables.find((t) => t.number === 6)?.id, customer: tawab, minutesAgo: 74, items: [
    { name: 'Beef Burger', qty: 2, selections: [{ group: 'Cook', label: 'Medium' }, { group: 'Extras', label: 'Bacon' }] },
    { name: 'Fries', qty: 2 },
    { name: 'Soda', qty: 2 },
  ] });
  liveOrder({ status: 'ready', customer: shayan, online: true, minutesAgo: 22, items: [
    { name: 'Caesar Salad', qty: 1, selections: [{ group: 'Add-ons', label: 'Grilled Chicken' }] },
    { name: 'Iced Tea', qty: 1 },
  ] });
  liveOrder({ status: 'confirmed', tableId: tables.find((t) => t.number === 3)?.id, customer: ali, minutesAgo: 6, priority: 'rush', items: [
    { name: 'Hummus Plate', qty: 1 },
    { name: 'Vegan Bowl', qty: 2 },
  ] });
  liveOrder({ status: 'preparing', customer: umair, online: true, fulfillment: 'delivery', minutesAgo: 18, paymentStatus: 'paid', address: '42 Garden Avenue', items: [
    { name: 'Peanut Satay Skewers', qty: 2 },
    { name: 'Fries', qty: 1, selections: [{ group: 'Size', label: 'Large' }] },
    { name: 'Soda', qty: 2 },
  ] });

  for (const offset of [4, 2, 1, 0]) {
    const day = addDays(combine(RANGE_END, '00:00'), -offset);
    const date = localDate(day);
    const table = tables.find((t) => t.seats >= 2) ?? tables[0];
    const customer = pick(named);
    const waiter = pick(waiters);
    const startMs = combine(date, offset === 0 ? '17:40' : '19:20').getTime();
    const confirmedMs = startMs + 2 * MINUTE;
    const readyMs = confirmedMs + 22 * MINUTE;
    const servedMs = readyMs + 8 * MINUTE;
    const order = createOrderRecord({
      tableId: table.id,
      customerId: customer.id,
      waiterId: waiter.id,
      createdBy: waiter.id,
      source: 'staff',
      status: 'served',
      paymentStatus: 'unpaid',
      createdAt: iso(new Date(startMs)),
      confirmedAt: iso(new Date(confirmedMs)),
      readyAt: iso(new Date(readyMs)),
      servedAt: iso(new Date(servedMs)),
      servedBy: waiter.id,
      kitchenRank: confirmedMs,
      items: randomItems(between(2, 4)),
      notes: 'Guest left before settling — manager follow-up.',
    });
    markItems(order, 'served');
    order.updatedAt = order.servedAt;
    orders.push(order);
  }

  const heldTables = new Set(
    orders
      .filter((o) => o.tableId && localDate(new Date(o.createdAt)) === today && ACTIVE_STATUSES.includes(o.status))
      .map((o) => o.tableId),
  );

  const slots = new Map();
  function tableFor(date, time, party, track = true) {
    const start = combine(date, time).getTime();
    const end = start + settings.reservationDurationMinutes * MINUTE;
    const fits = tables.filter((t) => t.seats >= party).sort((a, b) => a.seats - b.seats);
    const candidates = fits.filter((t) => !(date === today && heldTables.has(t.id)));
    if (!candidates.length) return fits[0]?.id ?? tables[tables.length - 1].id;
    for (const t of candidates) {
      const key = `${date}:${t.id}`;
      const list = slots.get(key) ?? [];
      if (!list.some(([s, e]) => start < e && end > s)) {
        if (track) {
          list.push([start, end]);
          slots.set(key, list);
        }
        return t.id;
      }
    }
    return candidates[0].id;
  }

  function guestContact() {
    const name = pick(GUEST_NAMES);
    return { name, email: `${slugOf(name)}@gmail.com`, phone: `+92 300 555${String(between(300, 399)).padStart(4, '0')}` };
  }

  function addReservation({ date, time, partySize, status, customer, createdAtMs, specialRequests = '', tableId }) {
    const startMs = combine(date, time).getTime();
    const guest = customer ? null : guestContact();
    const created = createdAtMs ?? addDays(new Date(startMs), -between(1, 10)).getTime();
    const confirmedMs = ['confirmed', 'seated', 'no_show'].includes(status) ? Math.min(created + between(5, 60) * MINUTE, startMs - 30 * MINUTE) : null;
    reservations.push({
      id: nextId('res'),
      customerName: customer?.name ?? guest.name,
      email: customer?.email ?? guest.email,
      phone: customer?.phone ?? guest.phone,
      partySize,
      date,
      time,
      tableId: tableId !== undefined
        ? tableId
        : status === 'requested'
          ? null
          : tableFor(date, time, partySize, !['cancelled', 'no_show'].includes(status)),
      status,
      specialRequests,
      customerId: customer?.id ?? null,
      createdAt: iso(new Date(created)),
      confirmedAt: confirmedMs ? iso(new Date(Math.max(created, confirmedMs))) : null,
      seatedAt: status === 'seated' ? iso(new Date(startMs + between(0, 12) * MINUTE)) : null,
      cancelledAt: status === 'cancelled' ? iso(new Date(Math.max(created, Math.min(created + between(60, 240) * MINUTE, startMs - 60 * MINUTE)))) : null,
      notifiedAt: ['confirmed', 'seated', 'no_show'].includes(status) ? iso(new Date(Math.max(created, confirmedMs))) : null,
    });
  }

  eachDate(RANGE_START, SCHEDULE_END, (day) => {
    const date = localDate(day);
    const past = date < today;
    const isToday = date === today;
    const n = past ? between(2, 5) : between(3, 6);
    for (let i = 0; i < n; i += 1) {
      const partySize = weighted([[2, 6], [3, 2], [4, 4], [5, 1], [6, 2], [8, 1]]);
      const time = pick(TIME_SLOTS);
      const startMs = combine(date, time).getTime();
      let status;
      if (past) status = chance(0.12) ? 'no_show' : chance(0.14) ? 'cancelled' : 'seated';
      else if (isToday) {
        if (startMs < nowMs - 15 * MINUTE) status = chance(0.25) ? 'no_show' : chance(0.15) ? 'cancelled' : 'seated';
        else status = chance(0.55) ? 'confirmed' : 'requested';
      } else status = chance(0.5) ? 'confirmed' : 'requested';
      const customer = chance(0.35) ? pick(named) : chance(0.2) ? pick(regulars) : null;
      addReservation({ date, time, partySize, status, customer, specialRequests: pick(SPECIAL_REQUESTS) });
    }
  });

  const soon = roundSlot(new Date(nowMs + 25 * MINUTE), 'up');
  const soonTime = `${String(soon.getHours()).padStart(2, '0')}:${String(soon.getMinutes()).padStart(2, '0')}`;
  addReservation({
    date: today,
    time: soonTime,
    partySize: 4,
    status: 'confirmed',
    customer: named.find((c) => c.name === 'Shayan Danish'),
    createdAtMs: addDays(new Date(nowMs), -2).getTime(),
    specialRequests: 'Anniversary dinner',
  });
  const late = roundSlot(new Date(nowMs - 30 * MINUTE), 'down');
  const lateTime = `${String(late.getHours()).padStart(2, '0')}:${String(late.getMinutes()).padStart(2, '0')}`;
  addReservation({
    date: today,
    time: lateTime,
    partySize: 2,
    status: 'confirmed',
    customer: named.find((c) => c.name === 'Umair Asad'),
    createdAtMs: addDays(new Date(nowMs), -1).getTime(),
  });

  const rotaPatterns = {
    waiter: [['11:30', '16:00'], ['16:30', '22:30']],
    chef: [['11:00', '19:00'], ['15:00', '23:00']],
    manager: [['10:00', '18:00'], ['12:00', '20:00']],
  };
  const offs = [[1, 2], [3, 4], [0, 1], [2, 3], [4, 5], [5, 6], [0, 6], [1, 3]];
  const rota = [...waiters, ...chefs, ...managers].map((user, i) => ({
    user,
    off: offs[i % offs.length],
    patterns: rotaPatterns[user.role],
    patternOffset: i % 2,
  }));
  const startMs = combine(RANGE_START, '00:00').getTime();

  eachDate(RANGE_START, SCHEDULE_END, (day) => {
    const date = localDate(day);
    const dow = day.getDay();
    const week = Math.floor((day.getTime() - startMs) / (7 * 24 * 60 * MINUTE));
    for (const member of rota) {
      if (member.off.includes(dow)) continue;
      const [start, end] = member.patterns[(week + member.patternOffset) % member.patterns.length];
      const past = date < today;
      shifts.push({
        id: nextId('shf'),
        userId: member.user.id,
        date,
        start,
        end,
        notes: '',
        status: past ? (chance(0.07) ? 'missed' : 'completed') : 'scheduled',
        createdBy: shiftBy,
        createdAt: iso(addDays(day, -7)),
      });
    }
  });

  const orderedShifts = shifts
    .filter((s) => s.date <= today)
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));

  for (const shift of orderedShifts) {
    if (shift.date < today && shift.status === 'missed') continue;
    const shiftStart = combine(shift.date, shift.start).getTime();
    const shiftEnd = combine(shift.date, shift.end).getTime();
    if (shiftStart > nowMs) continue;
    const inOffset = chance(0.1) ? between(6, 25) : between(-10, 3);
    const clockInMs = shiftStart + inOffset * MINUTE;
    if (clockInMs > nowMs) continue;
    const outOffset = chance(0.12) ? -between(5, 30) : chance(0.85) ? between(0, 8) : between(10, 30);
    const clockOutMs = shiftEnd + outOffset * MINUTE;
    const closed = clockOutMs <= nowMs;
    const length = (shiftEnd - shiftStart) / MINUTE;
    const breaks = [];
    if (length >= 360 && chance(0.85)) {
      const breakStart = clockInMs + between(150, 240) * MINUTE;
      let breakEnd = breakStart + between(25, 45) * MINUTE;
      if (breakStart <= nowMs) {
        if (breakEnd > nowMs) breakEnd = null;
        if (breakEnd === null || breakEnd <= (closed ? clockOutMs : nowMs)) {
          breaks.push({ start: iso(new Date(breakStart)), end: breakEnd === null ? null : iso(new Date(Math.min(breakEnd, closed ? clockOutMs : nowMs))) });
        }
      }
    } else if (length < 360 && chance(0.3)) {
      const breakStart = clockInMs + between(90, 150) * MINUTE;
      let breakEnd = breakStart + 15 * MINUTE;
      if (breakStart <= nowMs) {
        if (breakEnd > nowMs) breakEnd = null;
        if (breakEnd === null || breakEnd <= (closed ? clockOutMs : nowMs)) {
          breaks.push({ start: iso(new Date(breakStart)), end: breakEnd === null ? null : iso(new Date(Math.min(breakEnd, closed ? clockOutMs : nowMs))) });
        }
      }
    }
    const clockIn = iso(new Date(clockInMs));
    const { late, lateMinutes } = lateness(shift, clockIn, rules.lateGraceMinutes);
    attendance.push({
      id: nextId('att'),
      userId: shift.userId,
      date: shift.date,
      clockIn,
      clockOut: closed ? iso(new Date(clockOutMs)) : null,
      breaks,
      shiftId: shift.id,
      late,
      lateMinutes,
    });
    shift.status = 'completed';
  }

  const openSessions = () => attendance.filter((s) => !s.clockOut);
  if (openSessions().length < 2) {
    const inProgress = shifts
      .filter((s) => s.date === today && combine(s.date, s.start).getTime() <= nowMs && combine(s.date, s.end).getTime() > nowMs)
      .filter((s) => !attendance.some((a) => !a.clockOut && a.userId === s.userId));
    for (const shift of inProgress) {
      if (openSessions().length >= 2) break;
      const clockInMs = Math.max(combine(shift.date, shift.start).getTime() - 5 * MINUTE, nowMs - 100 * MINUTE);
      if (clockInMs > nowMs - 5 * MINUTE) continue;
      const clockIn = iso(new Date(clockInMs));
      const { late, lateMinutes } = lateness(shift, clockIn, rules.lateGraceMinutes);
      attendance.push({ id: nextId('att'), userId: shift.userId, date: shift.date, clockIn, clockOut: null, breaks: [], shiftId: shift.id, late, lateMinutes });
      shift.status = 'completed';
    }
    if (openSessions().length < 2) {
      for (const user of [...waiters, ...chefs, ...managers]) {
        if (openSessions().length >= 2) break;
        if (openSessions().some((a) => a.userId === user.id)) continue;
        const clockInMs = nowMs - between(60, 110) * MINUTE;
        const clockIn = iso(new Date(clockInMs));
        const shift = matchShift(shifts, user.id, clockIn);
        const { late, lateMinutes } = lateness(shift, clockIn, rules.lateGraceMinutes);
        attendance.push({ id: nextId('att'), userId: user.id, date: localDate(new Date(clockInMs)), clockIn, clockOut: null, breaks: [], shiftId: shift?.id ?? null, late, lateMinutes });
        if (shift) shift.status = 'completed';
      }
    }
  }

  for (const shift of shifts) {
    if (shift.status !== 'scheduled' || shift.date > today) continue;
    if (combine(shift.date, shift.end).getTime() > nowMs) continue;
    if (attendance.some((a) => a.shiftId === shift.id)) continue;
    shift.status = 'missed';
  }

  const adjustCandidates = [...waiters, ...chefs, ...managers, ...admins];
  for (const [index, amount, reason, daysAgo] of ADJUSTMENTS) {
    const user = adjustCandidates[index % adjustCandidates.length];
    const date = localDate(addDays(now, daysAgo));
    payAdjustments.push({
      id: nextId('adj'),
      userId: user.id,
      amount,
      reason,
      date,
      createdBy: adjustBy,
      createdAt: iso(combine(date, '09:00')),
    });
  }

  const note = (fields, minutesAgo) => notifications.push({
    id: nextId('ntf'),
    userId: null,
    role: null,
    channel: 'in-app',
    to: null,
    link: null,
    orderId: null,
    reservationId: null,
    readBy: [],
    createdAt: iso(new Date(nowMs - minutesAgo * MINUTE)),
    ...fields,
  });
  const openBill = orders.find((o) => o.status === 'served' && o.paymentStatus === 'unpaid' && localDate(new Date(o.createdAt)) === today);
  const readyOrder = orders.find((o) => o.status === 'ready');
  const placedOrder = orders.find((o) => o.status === 'placed');
  const soonBooking = reservations
    .filter((r) => r.status === 'confirmed' && r.date === today && combine(r.date, r.time).getTime() > nowMs)
    .sort((a, b) => combine(a.date, a.time) - combine(b.date, b.time))[0];
  note({ role: 'manager', type: 'low_stock', title: 'Low stock', message: 'Mozzarella is at or below its reorder level (9 kg left).', link: '/staff/inventory' }, 85);
  note({
    role: 'waiter', type: 'order_placed', title: 'New online order',
    message: placedOrder ? `Order #${placedOrder.number} is waiting for confirmation.` : 'A new online order is waiting for confirmation.',
    link: '/staff/orders', orderId: placedOrder?.id ?? null,
  }, 4);
  note({
    userId: waiters[0].id, type: 'order_ready', title: 'Order ready',
    message: readyOrder ? `Order #${readyOrder.number} (pickup) is ready to hand over.` : 'An order is ready at the pass.',
    link: '/staff/orders', orderId: readyOrder?.id ?? null,
  }, 2);
  note({
    role: 'manager', type: 'open_bill', title: 'Open bill',
    message: openBill ? `Order #${openBill.number} has been served but is still unpaid.` : 'An open bill needs settling.',
    link: '/staff/billing', orderId: openBill?.id ?? null,
  }, 18);
  note({
    role: 'manager', type: 'reservation_request', title: 'Booking arriving soon',
    message: soonBooking ? `${soonBooking.customerName} · party of ${soonBooking.partySize} at ${soonBooking.time}.` : 'A booking is arriving soon.',
    link: '/staff/reservations', reservationId: soonBooking?.id ?? null,
  }, 6);

  for (const t of tables) Object.assign(t, { status: 'free', waiterId: null, held: false, reservedFor: null });
  for (const order of orders) {
    if (!order.tableId || localDate(new Date(order.createdAt)) !== today) continue;
    if (!ACTIVE_STATUSES.includes(order.status)) continue;
    const table = tables.find((t) => t.id === order.tableId);
    if (table) Object.assign(table, { status: 'occupied', waiterId: order.waiterId });
  }
  for (const booking of reservations) {
    if (booking.status !== 'seated' || booking.date !== today || !booking.tableId || !booking.seatedAt) continue;
    const seatedMs = Date.parse(booking.seatedAt);
    if (seatedMs > nowMs) continue;
    if (nowMs - seatedMs > settings.reservationDurationMinutes * MINUTE) continue;
    const table = tables.find((t) => t.id === booking.tableId);
    if (table && table.status === 'free') table.status = 'occupied';
  }
  if (soonBooking) {
    const table = tables.find((t) => t.id === soonBooking.tableId);
    if (!table || table.status === 'occupied') {
      const free = tables.find((t) => t.status === 'free' && t.seats >= soonBooking.partySize);
      if (free) soonBooking.tableId = free.id;
    }
  }
  syncTableHolds(nowMs);

  for (const customer of named) {
    customer.loyaltyPoints = orders
      .filter((o) => o.customerId === customer.id && o.pointsEarned > 0)
      .reduce((sum, o) => sum + o.pointsEarned, 0);
  }

  validate({ nowMs, today });
  return summarizeData({ nowMs, today, named, rota });
}

function validate({ nowMs, today }) {
  const orderIds = new Set();
  const numbers = new Set();
  const userIds = new Set(users.map((u) => u.id));
  const customerIds = new Set(customers.map((c) => c.id));
  const tableIds = new Set(tables.map((t) => t.id));
  const menuIds = new Set(menuItems.map((m) => m.id));
  for (const order of orders) {
    if (orderIds.has(order.id)) throw new Error(`duplicate order id ${order.id}`);
    if (numbers.has(order.number)) throw new Error(`duplicate order number ${order.number}`);
    orderIds.add(order.id);
    numbers.add(order.number);
    if (!order.items.length) throw new Error(`order ${order.id} has no items`);
    if (!userIds.has(order.waiterId)) throw new Error(`order ${order.id} has unknown waiter ${order.waiterId}`);
    if (order.customerId && !customerIds.has(order.customerId)) throw new Error(`order ${order.id} has unknown customer ${order.customerId}`);
    if (order.tableId && !tableIds.has(order.tableId)) throw new Error(`order ${order.id} has unknown table ${order.tableId}`);
    for (const item of order.items) {
      if (!menuIds.has(item.menuItemId)) throw new Error(`order ${order.id} has unknown menu item ${item.menuItemId}`);
      if (item.preparedBy && !userIds.has(item.preparedBy)) throw new Error(`order ${order.id} has unknown chef ${item.preparedBy}`);
    }
    const clone = JSON.parse(JSON.stringify(order));
    computeTotals(clone);
    for (const key of ['subtotal', 'discount', 'serviceCharge', 'tax', 'tip', 'total']) {
      if (Math.abs(clone[key] - order[key]) > 0.001) throw new Error(`order ${order.id} ${key} is inconsistent`);
    }
    const created = Date.parse(order.createdAt);
    if (!Number.isFinite(created)) throw new Error(`order ${order.id} has no createdAt`);
    const createdDate = localDate(new Date(created));
    if (createdDate < RANGE_START || createdDate > RANGE_END) throw new Error(`order ${order.id} is outside ${RANGE_START}..${RANGE_END}`);
    if (order.refund && Date.parse(order.refund.at) > nowMs) throw new Error(`order ${order.id} refund is in the future`);
    if (order.refund) {
      if (!(order.refund.amount > 0 && order.refund.amount <= order.total + 0.001)) throw new Error(`order ${order.id} refund is invalid`);
      if (order.refund.amount >= order.total - 0.001 && order.paymentStatus !== 'refunded') throw new Error(`order ${order.id} full refund is not refunded`);
      if (order.refund.amount < order.total - 0.001 && order.paymentStatus !== 'paid') throw new Error(`order ${order.id} partial refund is not paid`);
    }
    if (order.split) {
      const sum = order.split.parts.reduce((s, p) => s + toCents(p.amount), 0);
      if (sum !== toCents(order.total)) throw new Error(`order ${order.id} split does not add up`);
      if (!order.split.parts.every((p) => p.paid)) throw new Error(`order ${order.id} split has unpaid parts`);
    }
    if (order.status === 'cancelled') {
      if (order.closedAt || (order.paidAt && order.paymentStatus !== 'refunded')) throw new Error(`order ${order.id} cancelled state is inconsistent`);
      if (!['unpaid', 'refunded'].includes(order.paymentStatus)) throw new Error(`order ${order.id} cancelled with status ${order.paymentStatus}`);
      if (!order.cancelledAt) throw new Error(`order ${order.id} has no cancelledAt`);
    }
    if (order.status === 'closed') {
      if (!order.servedAt) throw new Error(`order ${order.id} closed without service`);
      if (!order.paidAt || !order.closedAt) throw new Error(`order ${order.id} closed without payment`);
      if (Date.parse(order.closedAt) < Date.parse(order.servedAt)) throw new Error(`order ${order.id} closes before service`);
    }
    if (order.status === 'served') {
      if (!order.servedAt) throw new Error(`order ${order.id} served without servedAt`);
      if (order.paymentStatus !== 'unpaid') throw new Error(`order ${order.id} served but not unpaid`);
    }
  }
  const shiftKeys = new Set();
  for (const shift of shifts) {
    if (!userIds.has(shift.userId)) throw new Error(`shift ${shift.id} has unknown user ${shift.userId}`);
    const key = `${shift.userId}:${shift.date}:${shift.start}`;
    if (shiftKeys.has(key)) throw new Error(`duplicate shift ${key}`);
    shiftKeys.add(key);
  }
  const shiftIds = new Set(shifts.map((s) => s.id));
  for (const session of attendance) {
    if (!userIds.has(session.userId)) throw new Error(`session ${session.id} has unknown user ${session.userId}`);
    if (session.shiftId && !shiftIds.has(session.shiftId)) throw new Error(`session ${session.id} has unknown shift ${session.shiftId}`);
    if (session.clockOut && Date.parse(session.clockOut) < Date.parse(session.clockIn)) throw new Error(`session ${session.id} ends before it starts`);
  }
  for (const reservation of reservations) {
    if (!tableIds.has(reservation.tableId) && reservation.tableId !== null) throw new Error(`reservation ${reservation.id} has unknown table ${reservation.tableId}`);
    if (reservation.customerId && !customerIds.has(reservation.customerId)) throw new Error(`reservation ${reservation.id} has unknown customer ${reservation.customerId}`);
  }
  const lateToday = reservations.some((r) => r.date === today && r.status === 'confirmed' && combine(r.date, r.time).getTime() < nowMs - 15 * MINUTE);
  if (!lateToday) throw new Error('expected a late confirmed booking today');
}

function summarizeData({ nowMs, today, named, rota }) {
  const openBills = orders.filter((o) => o.status !== 'cancelled' && o.paymentStatus === 'unpaid');
  const servedUnpaid = openBills.filter((o) => o.status === 'served');
  const sessions = attendance;
  const early = sessions.filter((s) => {
    if (!s.clockOut) return false;
    const shift = shifts.find((x) => x.id === s.shiftId);
    return shift ? Date.parse(s.clockOut) < combine(shift.date, shift.end).getTime() - 5 * MINUTE : false;
  });
  const offDays = rota.reduce((sum, member) => {
    let count = 0;
    eachDate(RANGE_START, RANGE_END, (day) => { if (member.off.includes(day.getDay())) count += 1; });
    return sum + count;
  }, 0);
  return {
    orders: orders.length,
    closed: orders.filter((o) => o.status === 'closed').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
    refunded: orders.filter((o) => o.paymentStatus === 'refunded').length,
    partialRefunds: orders.filter((o) => o.refund && o.refund.amount < o.total - 0.001).length,
    openBills: openBills.length,
    leftBills: servedUnpaid.length,
    active: orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length,
    reservations: reservations.length,
    seated: reservations.filter((r) => r.status === 'seated').length,
    noShows: reservations.filter((r) => r.status === 'no_show').length,
    cancelledBookings: reservations.filter((r) => r.status === 'cancelled').length,
    upcomingBookings: reservations.filter((r) => ['confirmed', 'requested'].includes(r.status) && r.date >= today).length,
    shifts: shifts.length,
    shiftsWorked: shifts.filter((s) => s.status === 'completed').length,
    missedShifts: shifts.filter((s) => s.status === 'missed').length,
    offDays,
    lateSessions: sessions.filter((s) => s.late).length,
    earlyLeaves: early.length,
    openSessions: sessions.filter((s) => !s.clockOut).length,
    namedCustomers: named.length,
    orderNumber: orderSeq.lastNumber,
    now: new Date(nowMs).toLocaleString('en-GB'),
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const url = resolveUrl(argv);
  if (!url) {
    console.error('No connection string. Set DATABASE_URL in server/.env or pass --url=postgres://...');
    process.exit(1);
  }

  const pool = createPool(url, { max: 2, connectionTimeoutMillis: 20_000, query_timeout: 60_000 });
  let client;
  try {
    await applySchema(pool);
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('SET LOCAL search_path = public, pg_catalog');
    await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY]);
    const state = await client.query("SELECT last_value::int AS version FROM sequences WHERE name = 'state_version'");
    if (!state.rowCount) {
      throw new Error('database has no app state yet - run `pnpm --dir server db:init` (or start the API once) first');
    }

    restore(await loadStore(client));
    const stats = applyOperations(new Date());

    if (dryRun) {
      await saveStore(client, snapshot());
      await client.query('ROLLBACK');
      log('DRY RUN — write path exercised, transaction rolled back, nothing saved');
    } else {
      await saveStore(client, snapshot());
      const { rows } = await client.query(
        "UPDATE sequences SET last_value = last_value + 1 WHERE name = 'state_version' RETURNING last_value::int AS version",
      );
      await client.query('COMMIT');
      log(`saved — store version ${rows[0].version}; running instances reload on their next request`);
    }

    log(`range: ${RANGE_START} → ${RANGE_END} (shifts and bookings through ${SCHEDULE_END})`);
    log(`orders: ${stats.orders} total · ${stats.closed} closed · ${stats.cancelled} cancelled · ${stats.refunded} refunded · ${stats.partialRefunds} partial refunds · ${stats.leftBills} left unpaid · ${stats.active} active`);
    log(`order numbers: through #${stats.orderNumber}`);
    log(`reservations: ${stats.reservations} · ${stats.seated} seated · ${stats.noShows} no-shows · ${stats.cancelledBookings} cancelled · ${stats.upcomingBookings} upcoming`);
    log(`shifts: ${stats.shifts} · ${stats.shiftsWorked} worked · ${stats.missedShifts} missed · ${stats.offDays} off days`);
    log(`attendance: ${stats.lateSessions} late · ${stats.earlyLeaves} left early · ${stats.openSessions} open now (${stats.now})`);
    log(`customers: ${stats.namedCustomers} named profiles added/refreshed`);
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client?.release();
    await pool.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error('[seed:operations] failed:', err.message ?? err);
  process.exit(1);
});
