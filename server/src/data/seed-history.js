/**
 * Generates 60 days of closed order history, past reservations and staff
 * shifts so that analytics, customer order histories and staff performance
 * have realistic data from the first run. A seeded PRNG keeps the history
 * identical across restarts (relative to today).
 */
import { computeTotals } from '../lib/order-math.js';
import { MINUTE, localDate, addDays, iso } from '../lib/time.js';

const HISTORY_DAYS = 60;

const HOUR_WEIGHTS = [[12, 4], [13, 5], [14, 2], [15, 1], [16, 1], [17, 2], [18, 4], [19, 6], [20, 5], [21, 2]];

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
  'Chocolate Ganache Cake': 3,
};

const GUEST_NAMES = [
  'Ava Johnson', 'Mason Lee', 'Isabella Garcia', 'Lucas Brown', 'Mia Wilson', 'Ethan Davis',
  'Harper Moore', 'James Taylor', 'Amelia Clark', 'Benjamin Hall', 'Charlotte King', 'Henry Wright',
];

const REFUND_REASONS = ['Wrong dish served', 'Long wait — goodwill refund', 'Duplicate card charge'];

/** Small deterministic PRNG (mulberry32). */
function mulberry32(seed) {
  let a = seed;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedHistory({ orders, reservations, shifts, tables, menuItems, customers, TIME_SLOTS, buildOrderItem, createOrderRecord, nextId }) {
  const rand = mulberry32(20261005);
  const between = (min, max) => min + Math.floor(rand() * (max - min + 1));
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const weighted = (entries) => {
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let r = rand() * total;
    for (const [value, w] of entries) {
      r -= w;
      if (r <= 0) return value;
    }
    return entries[entries.length - 1][0];
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const waiters = ['usr_waiter', 'usr_waiter2'];
  const chefs = ['usr_chef', 'usr_chef2'];
  const walkInRegulars = customers.filter((c) => c.type === 'walk-in');
  const onlineRegulars = customers.filter((c) => c.type === 'online');
  const menuEntries = menuItems.map((m) => [m, POPULARITY[m.name] || 2]);

  function randomItems(lines) {
    const out = [];
    for (let i = 0; i < lines; i += 1) {
      const item = weighted(menuEntries);
      if (out.some((l) => l.menuItemId === item.id)) continue;
      const selections = [];
      for (const g of item.modifiers) {
        if (g.type === 'single' && rand() < 0.35) selections.push({ group: g.name, label: pick(g.options).label });
        if (g.type === 'multi' && rand() < 0.25) selections.push({ group: g.name, label: pick(g.options).label });
      }
      out.push(buildOrderItem(item, rand() < 0.75 ? 1 : 2, selections, 'served', { preparedBy: pick(chefs) }));
    }
    return out;
  }

  /* ----------------------------------------------------------- orders */

  for (let d = HISTORY_DAYS; d >= 1; d -= 1) {
    const day = addDays(today, -d);
    const dow = day.getDay();
    const weekendBoost = dow === 5 || dow === 6 ? 6 : dow === 0 ? 3 : 0;
    const growth = Math.round((HISTORY_DAYS - d) / 15);
    const count = 8 + weekendBoost + growth + between(0, 4);

    const times = Array.from({ length: count }, () => {
      const hour = weighted(HOUR_WEIGHTS);
      return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, between(0, 59));
    }).sort((a, b) => a - b);

    const busyUntil = {};

    for (const t of times) {
      const start = t.getTime();
      const at = (minutes) => iso(new Date(start + minutes * MINUTE));
      let order;

      const wantsDineIn = rand() < 0.65;
      const party = weighted([[1, 1], [2, 6], [3, 2], [4, 4], [5, 1], [6, 2]]);
      const table = wantsDineIn
        ? tables
            .filter((tb) => tb.seats >= party && (busyUntil[tb.id] || 0) <= start)
            .sort((a, b) => a.seats - b.seats)[0]
        : null;

      if (table) {
        const duration = between(40, 70) + party * 6;
        busyUntil[table.id] = start + (duration + 10) * MINUTE;
        const waiter = rand() < 0.55 ? waiters[0] : waiters[1];
        order = createOrderRecord({
          tableId: table.id,
          customerId: rand() < 0.25 ? pick(walkInRegulars).id : null,
          waiterId: waiter,
          createdBy: waiter,
          servedBy: waiter,
          items: randomItems(between(1, Math.min(5, party + 1))),
          paymentMethod: rand() < 0.7 ? 'card' : 'cash',
          createdAt: iso(t),
          confirmedAt: at(2),
          readyAt: at(between(15, 28)),
          servedAt: at(30),
          paidAt: at(duration),
          closedAt: at(duration),
        });
        if (rand() < 0.5) {
          order.tip = Math.round(order.subtotal * pick([0.1, 0.12, 0.15]) * 100) / 100;
          computeTotals(order);
        }
      } else {
        const customer = rand() < 0.7 ? pick(onlineRegulars) : null;
        const card = rand() < 0.75;
        const duration = between(25, 45);
        order = createOrderRecord({
          type: 'online',
          fulfillment: rand() < 0.6 ? 'pickup' : 'delivery',
          customerId: customer ? customer.id : null,
          createdBy: customer?.userId ?? 'usr_waiter',
          source: customer?.userId ? 'customer' : 'staff',
          waiterId: pick(waiters),
          servedBy: pick(waiters),
          items: randomItems(between(1, 3)),
          paymentMethod: card ? 'card' : 'cash',
          createdAt: iso(t),
          confirmedAt: at(2),
          readyAt: at(between(15, 25)),
          servedAt: at(duration),
          paidAt: card ? iso(t) : at(duration),
          closedAt: at(duration),
        });
        if (order.fulfillment === 'delivery') order.deliveryAddress = `${between(1, 99)} Market Street`;
      }

      order.kitchenRank = start + 2 * MINUTE;
      order.stockDeducted = true;
      order.updatedAt = order.closedAt;

      const outcome = rand();
      if (outcome < 0.03) {
        order.status = 'cancelled';
        order.cancelledAt = order.confirmedAt;
        order.items.forEach((i) => { i.status = 'queued'; });
        Object.assign(order, { readyAt: null, servedAt: null, servedBy: null, paidAt: null, closedAt: null, paymentStatus: 'unpaid' });
        order.updatedAt = order.cancelledAt;
      } else {
        order.status = 'closed';
        order.paymentStatus = 'paid';
        order.items.forEach((i) => {
          i.readyAt = order.readyAt;
          i.servedAt = order.servedAt;
        });
        if (order.customerId) order.pointsEarned = Math.floor(order.total);
        if (outcome < 0.045) {
          order.paymentStatus = 'refunded';
          order.refund = { amount: order.total, reason: pick(REFUND_REASONS), at: order.closedAt, by: 'usr_manager' };
        }
      }

      orders.push(order);
    }
  }

  /* ----------------------------------------------------- reservations */

  for (let d = HISTORY_DAYS; d >= 1; d -= 1) {
    const day = addDays(today, -d);
    const n = between(2, 5);
    for (let i = 0; i < n; i += 1) {
      const partySize = between(2, 6);
      const regular = rand() < 0.3 ? pick(customers) : null;
      const r = rand();
      const status = r < 0.12 ? 'no_show' : r < 0.25 ? 'cancelled' : 'seated';
      const table = pick(tables.filter((tb) => tb.seats >= partySize));
      const created = iso(addDays(day, -between(1, 10)));
      reservations.push({
        id: nextId('res'),
        customerName: regular ? regular.name : pick(GUEST_NAMES),
        email: regular ? regular.email : '',
        phone: '',
        partySize,
        date: localDate(day),
        time: pick(TIME_SLOTS),
        tableId: table.id,
        status,
        specialRequests: '',
        customerId: regular ? regular.id : null,
        createdAt: created,
        confirmedAt: status === 'cancelled' ? null : created,
        seatedAt: status === 'seated' ? iso(day) : null,
        cancelledAt: status === 'cancelled' ? iso(day) : null,
        notifiedAt: status === 'cancelled' ? null : created,
      });
    }
  }

  /* ----------------------------------------------------------- shifts */

  const rota = [
    { userId: 'usr_waiter', off: [1, 2], shifts: [['11:30', '16:00'], ['16:30', '22:30']] },
    { userId: 'usr_waiter2', off: [3, 4], shifts: [['16:30', '22:30'], ['11:30', '16:00']] },
    { userId: 'usr_chef', off: [0, 1], shifts: [['11:00', '19:00'], ['15:00', '23:00']] },
    { userId: 'usr_chef2', off: [2, 3], shifts: [['15:00', '23:00'], ['11:00', '19:00']] },
    { userId: 'usr_manager', off: [0, 6], shifts: [['10:00', '18:00'], ['10:00', '18:00']] },
  ];

  for (let d = -14; d <= 6; d += 1) {
    const day = addDays(today, d);
    const weekParity = Math.floor((d + 14) / 7) % 2;
    for (const member of rota) {
      if (member.off.includes(day.getDay())) continue;
      const [start, end] = member.shifts[weekParity];
      shifts.push({
        id: nextId('shf'),
        userId: member.userId,
        date: localDate(day),
        start,
        end,
        notes: '',
        status: d < 0 ? (rand() < 0.93 ? 'completed' : 'missed') : 'scheduled',
        createdBy: 'usr_manager',
        createdAt: iso(addDays(day, -7)),
      });
    }
  }
}
