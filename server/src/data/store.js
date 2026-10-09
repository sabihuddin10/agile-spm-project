/**
 * In-memory data store.
 *
 * All data lives in memory and is seeded on server start — no database is used,
 * and data resets every time the server restarts. Seed data is generated
 * relative to the current date so the demo always has a live "today" (active
 * orders, tonight's bookings), 60 days of closed history for analytics, 90
 * days of shifts and attendance, and upcoming shifts.
 */
import bcrypt from 'bcryptjs';
import { priceSelection, computeTotals } from '../lib/order-math.js';
import { MINUTE, localDate, localTime, addDays, iso } from '../lib/time.js';
import { seedHistory } from './seed-history.js';
import { seedAttendance } from './seed-attendance.js';
import { DEFAULT_WAGES } from '../lib/payroll.js';

export const ROLES = ['customer', 'waiter', 'chef', 'manager', 'admin'];
export const STAFF_ROLES = ['waiter', 'chef', 'manager', 'admin'];

export const counters = {};

export function nextId(prefix) {
  counters[prefix] = (counters[prefix] || 0) + 1;
  return `${prefix}_${counters[prefix]}`;
}

/* --------------------------------------------------------------- settings */

/** Restaurant policy, editable by Manager/Admin (Settings screen). */
export const settings = {
  restaurantName: 'Plate & Flame',
  address: '12 Ember Lane, Old Town',
  taxRate: 0.1,
  serviceChargeRate: 0.05, // dine-in only
  pointValue: 0.1, // each Flame Point is worth $0.10
  kitchenDelayMinutes: 15, // KDS flags orders older than this
  reservationDurationMinutes: 90,
  reservationGraceMinutes: 15,
  openingHour: 12,
  closingHour: 22,
  // Attendance and pay (lib/attendance.js, lib/payroll.js)
  lateGraceMinutes: 5, // a clock-in later than shift start + grace is late
  latePenalty: 5, // deducted from pay for each late arrival
  autoBreakMinutes: 60, // unpaid break applied when none was recorded…
  autoBreakAfterHours: 6, // …on a session longer than this
};

export const TIME_SLOTS = [
  '12:00', '12:30', '13:00', '13:30', '14:00',
  '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00',
];

/* ------------------------------------------------------------------ users */

const DEMO_PASSWORD_HASH = bcrypt.hashSync('password', 10);

const seedUsers = [
  { id: 'usr_admin', name: 'Alex Admin', email: 'admin@rest.test', role: 'admin' },
  { id: 'usr_manager', name: 'Maya Manager', email: 'manager@rest.test', role: 'manager' },
  { id: 'usr_chef', name: 'Carlos Chef', email: 'chef@rest.test', role: 'chef' },
  { id: 'usr_chef2', name: 'Cara Cook', email: 'chef2@rest.test', role: 'chef' },
  { id: 'usr_waiter', name: 'Will Waiter', email: 'waiter@rest.test', role: 'waiter' },
  { id: 'usr_waiter2', name: 'Wendy Server', email: 'waiter2@rest.test', role: 'waiter' },
  { id: 'usr_customer', name: 'Casey Customer', email: 'customer@rest.test', role: 'customer' },
];

export const users = seedUsers.map((u) => ({
  ...u,
  phone: '',
  active: true,
  mustChangePassword: false,
  tokenVersion: 0,
  passwordHash: DEMO_PASSWORD_HASH,
  ...(STAFF_ROLES.includes(u.role) ? { hourlyWage: DEFAULT_WAGES[u.role] } : {}),
  createdAt: iso(addDays(new Date(), -120)),
}));

export function findUserByEmail(email) {
  return users.find((u) => u.email.toLowerCase() === String(email || '').toLowerCase().trim());
}

export function findUserById(id) {
  return users.find((u) => u.id === id);
}

export function sanitizeUser(user) {
  if (!user) return null;
  // hourlyWage is private: only the workforce endpoints show it (to the person and the admin).
  const { passwordHash, tokenVersion, hourlyWage, ...safe } = user;
  return { phone: '', mustChangePassword: false, ...safe };
}

export function createUser({ name, email, password, role = 'customer', mustChangePassword = false }) {
  const user = {
    id: nextId('usr'),
    name: String(name).trim(),
    email: String(email).toLowerCase().trim(),
    phone: '',
    passwordHash: bcrypt.hashSync(password, 10),
    role,
    active: true,
    mustChangePassword,
    tokenVersion: 0,
    ...(STAFF_ROLES.includes(role) ? { hourlyWage: DEFAULT_WAGES[role] } : {}),
    createdAt: iso(),
  };
  users.push(user);
  return user;
}

/* ------------------------------------------------------------- customers */

function customer(fields) {
  return {
    id: nextId('cus'),
    userId: null,
    phone: '',
    type: 'walk-in',
    loyaltyPoints: 0,
    preferences: { dietary: [], allergies: [] },
    notes: '',
    createdAt: iso(addDays(new Date(), -90)),
    ...fields,
  };
}

export const customers = [
  customer({ name: 'Emma Thompson', email: 'emma@example.com', phone: '+1 555-0101', loyaltyPoints: 320, preferences: { dietary: ['vegetarian'], allergies: ['peanuts'] } }),
  customer({ name: 'Liam Nguyen', email: 'liam@example.com', phone: '+1 555-0102', type: 'online', loyaltyPoints: 85, preferences: { dietary: ['gluten-free'], allergies: [] }, notes: 'Prefers window table' }),
  customer({ name: 'Sofia Ramirez', email: 'sofia@example.com', phone: '+1 555-0103', loyaltyPoints: 540, preferences: { dietary: ['vegan'], allergies: ['shellfish', 'dairy'] }, notes: 'Regular weekend dinner guest' }),
  customer({ name: 'Casey Customer', email: 'customer@rest.test', phone: '+1 555-0199', type: 'online', userId: 'usr_customer', loyaltyPoints: 210, preferences: { dietary: ['vegetarian', 'gluten-free'], allergies: ['peanuts'] }, notes: 'Online customer · prefers contactless' }),
  customer({ name: 'Olivia Chen', email: 'olivia@example.com', phone: '+1 555-0104', type: 'online', loyaltyPoints: 120, preferences: { dietary: ['nut-free'], allergies: ['tree nuts'] } }),
  customer({ name: 'Noah Patel', email: 'noah@example.com', phone: '+1 555-0105', loyaltyPoints: 60, preferences: { dietary: ['halal'], allergies: [] } }),
];

export function findCustomerByUserId(userId) {
  return customers.find((c) => c.userId === userId);
}

/* ------------------------------------------------------------- inventory */

function ingredient(name, category, stock, unit, reorderLevel, costPerUnit, supplier) {
  return { id: nextId('inv'), name, category, stock, unit, reorderLevel, costPerUnit, supplier };
}

export const inventory = [
  ingredient('Tomatoes', 'Produce', 42, 'kg', 15, 2.5, 'Green Valley Farms'),
  ingredient('Mozzarella', 'Dairy', 9, 'kg', 10, 9.0, 'Alpine Dairy Co.'),
  ingredient('Flour', 'Dry Goods', 60, 'kg', 25, 1.2, 'Miller & Sons'),
  ingredient('Beef Patties', 'Meat', 36, 'units', 40, 2.0, 'Prime Cuts'),
  ingredient('Chicken Breast', 'Meat', 12, 'kg', 8, 7.8, 'Prime Cuts'),
  ingredient('Romaine Lettuce', 'Produce', 9, 'kg', 6, 3.1, 'Green Valley Farms'),
  ingredient('Lemons', 'Produce', 80, 'units', 60, 0.5, 'Green Valley Farms'),
  ingredient('Dark Chocolate', 'Dry Goods', 3, 'kg', 5, 18.0, 'Cocoa Trading'),
  ingredient('Olive Oil', 'Pantry', 14, 'L', 8, 11.0, 'Mediterraneo Imports'),
  ingredient('Quinoa', 'Dry Goods', 11, 'kg', 6, 6.5, 'Miller & Sons'),
  ingredient('Chickpeas', 'Dry Goods', 8, 'kg', 5, 3.2, 'Miller & Sons'),
  ingredient('Potatoes', 'Produce', 50, 'kg', 20, 1.1, 'Green Valley Farms'),
  ingredient('Burger Buns', 'Bakery', 48, 'units', 40, 0.6, 'Old Town Bakery'),
  ingredient('Cheddar', 'Dairy', 6, 'kg', 4, 10.5, 'Alpine Dairy Co.'),
  ingredient('Peanuts', 'Dry Goods', 4, 'kg', 2, 5.0, 'Cocoa Trading'),
  ingredient('Tea Leaves', 'Pantry', 2.5, 'kg', 1, 22.0, 'Leaf & Co.'),
  ingredient('Soda (cans)', 'Drinks', 70, 'units', 48, 0.45, 'City Beverages'),
  ingredient('Eggs', 'Dairy', 90, 'units', 60, 0.25, 'Alpine Dairy Co.'),
];

export const inventoryUnits = ['g', 'kg', 'L', 'ml', 'units', 'dozen', 'boxes'];

const inv = (name) => inventory.find((i) => i.name === name).id;

/** Stock movement log: sales deductions, manual adjustments, restocks. */
export const stockMovements = [];

/** Supplier reorder forms (purchase orders). */
export const purchaseOrders = [];

/* ------------------------------------------------------------------ menu */

export const categories = [
  { id: nextId('cat'), name: 'Starters', sort: 1, active: true },
  { id: nextId('cat'), name: 'Mains', sort: 2, active: true },
  { id: nextId('cat'), name: 'Drinks', sort: 3, active: true },
  { id: nextId('cat'), name: 'Desserts', sort: 4, active: true },
];

const opt = (label, priceDelta = 0) => ({ label, priceDelta });
const group = (name, type, options) => ({ id: nextId('mod'), name, type, options });

function menuItem(fields) {
  return {
    id: nextId('mi'),
    description: '',
    dietaryTags: [],
    allergens: [],
    modifiers: [],
    recipe: [],
    available: true,
    outOfStockReason: '',
    ...fields,
  };
}

const [STARTERS, MAINS, DRINKS, DESSERTS] = categories.map((c) => c.id);

export const menuItems = [
  menuItem({
    name: 'Margherita Pizza', categoryId: MAINS, price: 18.0,
    description: 'San Marzano tomatoes, fresh mozzarella, basil.',
    dietaryTags: ['vegetarian'], allergens: ['gluten', 'dairy'],
    modifiers: [
      group('Size', 'single', [opt('Regular'), opt('Large', 4)]),
      group('Extras', 'multi', [opt('Extra Cheese', 1.5), opt('Pepperoni', 2), opt('Mushrooms', 1.5)]),
    ],
    recipe: [{ inventoryId: inv('Tomatoes'), qty: 0.15 }, { inventoryId: inv('Mozzarella'), qty: 0.12 }, { inventoryId: inv('Flour'), qty: 0.25 }, { inventoryId: inv('Olive Oil'), qty: 0.02 }],
  }),
  menuItem({
    name: 'Caesar Salad', categoryId: STARTERS, price: 12.5,
    description: 'Romaine, parmesan, croutons, house Caesar dressing.',
    dietaryTags: ['vegetarian'], allergens: ['gluten', 'dairy', 'eggs'],
    modifiers: [group('Add-ons', 'multi', [opt('Grilled Chicken', 4)])],
    recipe: [{ inventoryId: inv('Romaine Lettuce'), qty: 0.2 }, { inventoryId: inv('Eggs'), qty: 1 }, { inventoryId: inv('Flour'), qty: 0.03 }, { inventoryId: inv('Olive Oil'), qty: 0.02 }],
  }),
  menuItem({
    name: 'Beef Burger', categoryId: MAINS, price: 16.0,
    description: 'Grass-fed beef, cheddar, lettuce, tomato, house bun.',
    allergens: ['gluten', 'dairy'],
    modifiers: [
      group('Cook', 'single', [opt('Medium Rare'), opt('Medium'), opt('Well Done')]),
      group('Extras', 'multi', [opt('Bacon', 2), opt('Avocado', 1.5), opt('Fried Egg', 1)]),
    ],
    recipe: [{ inventoryId: inv('Beef Patties'), qty: 1 }, { inventoryId: inv('Burger Buns'), qty: 1 }, { inventoryId: inv('Cheddar'), qty: 0.03 }, { inventoryId: inv('Tomatoes'), qty: 0.05 }, { inventoryId: inv('Romaine Lettuce'), qty: 0.03 }],
  }),
  menuItem({
    name: 'Vegan Bowl', categoryId: MAINS, price: 15.0,
    description: 'Quinoa, roasted vegetables, tahini, pickled onions.',
    dietaryTags: ['vegan', 'gluten-free'], allergens: ['sesame'],
    recipe: [{ inventoryId: inv('Quinoa'), qty: 0.12 }, { inventoryId: inv('Chickpeas'), qty: 0.08 }, { inventoryId: inv('Tomatoes'), qty: 0.08 }, { inventoryId: inv('Olive Oil'), qty: 0.02 }],
  }),
  menuItem({
    name: 'Garlic Bread', categoryId: STARTERS, price: 6.0,
    description: 'Wood-fired baguette, roasted garlic butter.',
    dietaryTags: ['vegetarian'], allergens: ['gluten', 'dairy'],
    recipe: [{ inventoryId: inv('Flour'), qty: 0.15 }, { inventoryId: inv('Olive Oil'), qty: 0.02 }],
  }),
  menuItem({
    name: 'Hummus Plate', categoryId: STARTERS, price: 8.0,
    description: 'House hummus, warm pita, olive oil.',
    dietaryTags: ['vegan'], allergens: ['sesame', 'gluten'],
    recipe: [{ inventoryId: inv('Chickpeas'), qty: 0.15 }, { inventoryId: inv('Olive Oil'), qty: 0.03 }, { inventoryId: inv('Flour'), qty: 0.1 }],
  }),
  menuItem({
    name: 'Peanut Satay Skewers', categoryId: STARTERS, price: 11.0,
    description: 'Chargrilled chicken skewers, peanut satay, lime.',
    dietaryTags: ['halal'], allergens: ['peanuts', 'soy'],
    recipe: [{ inventoryId: inv('Chicken Breast'), qty: 0.15 }, { inventoryId: inv('Peanuts'), qty: 0.05 }],
  }),
  menuItem({
    name: 'Lemonade', categoryId: DRINKS, price: 3.5,
    description: 'Fresh-squeezed, lightly sweetened.',
    dietaryTags: ['vegan', 'gluten-free'],
    modifiers: [group('Size', 'single', [opt('Small'), opt('Large', 1.5)])],
    recipe: [{ inventoryId: inv('Lemons'), qty: 2 }],
  }),
  menuItem({
    name: 'Iced Tea', categoryId: DRINKS, price: 3.0,
    description: 'Seasonal iced tea, unsweetened.',
    dietaryTags: ['vegan', 'gluten-free'],
    recipe: [{ inventoryId: inv('Tea Leaves'), qty: 0.01 }, { inventoryId: inv('Lemons'), qty: 1 }],
  }),
  menuItem({
    name: 'Soda', categoryId: DRINKS, price: 2.5,
    description: 'Classic soda, served chilled.',
    dietaryTags: ['vegan', 'gluten-free'],
    recipe: [{ inventoryId: inv('Soda (cans)'), qty: 1 }],
  }),
  menuItem({
    name: 'Chocolate Ganache Cake', categoryId: DESSERTS, price: 7.5,
    description: 'Dark chocolate, silk ganache, salted caramel.',
    dietaryTags: ['vegetarian'], allergens: ['gluten', 'dairy', 'eggs'],
    available: false, outOfStockReason: 'Bakery delivery delayed',
    recipe: [{ inventoryId: inv('Dark Chocolate'), qty: 0.08 }, { inventoryId: inv('Flour'), qty: 0.08 }, { inventoryId: inv('Eggs'), qty: 2 }],
  }),
  menuItem({
    name: 'Fries', categoryId: STARTERS, price: 5.0,
    description: 'Crispy golden fries, sea salt.',
    dietaryTags: ['vegan', 'gluten-free'],
    modifiers: [group('Size', 'single', [opt('Regular'), opt('Large', 2)])],
    recipe: [{ inventoryId: inv('Potatoes'), qty: 0.25 }, { inventoryId: inv('Olive Oil'), qty: 0.05 }],
  }),
];

export const cuisineTagList = ['vegetarian', 'vegan', 'gluten-free', 'halal', 'keto', 'nut-free'];

export const allergenList = ['gluten', 'dairy', 'eggs', 'peanuts', 'tree nuts', 'shellfish', 'fish', 'soy', 'sesame'];

/* ---------------------------------------------------------------- tables */

export const ZONES = ['Main hall', 'Window', 'Terrace'];

function table(number, seats, zone) {
  return { id: nextId('tab'), number, seats, zone, status: 'free', waiterId: null, held: false, reservedFor: null };
}

export const tables = [
  table(1, 2, 'Window'),
  table(2, 2, 'Window'),
  table(3, 4, 'Main hall'),
  table(4, 4, 'Main hall'),
  table(5, 6, 'Main hall'),
  table(6, 6, 'Terrace'),
  table(7, 4, 'Terrace'),
  table(8, 8, 'Terrace'),
];

export const tableStatuses = ['free', 'occupied', 'reserved', 'cleaning'];

/* ---------------------------------------------------------------- orders */

/**
 * Order lifecycle: placed → confirmed → preparing → ready → served → closed
 * (or cancelled). Payment is tracked separately: unpaid | paid | refunded.
 * An order closes when it is both served and paid.
 * Item lifecycle: pending → queued → preparing → ready → served.
 */
export const ORDER_STATUSES = ['placed', 'confirmed', 'preparing', 'ready', 'served', 'closed', 'cancelled'];
export const ITEM_STATUSES = ['pending', 'queued', 'preparing', 'ready', 'served'];
export const PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded'];

export const orders = [];
export const orderSeq = { lastNumber: 1000 };

export function findOrderById(id) {
  return orders.find((o) => o.id === id);
}

/**
 * Build a priced order line from a menu item and modifier selections.
 * Throws when a selection is invalid (callers validate first via priceSelection).
 */
export function buildOrderItem(item, qty, selections = [], status = 'pending', extra = {}) {
  const priced = priceSelection(item, selections);
  if (priced.error) throw new Error(priced.error);
  return {
    id: nextId('oi'),
    menuItemId: item.id,
    name: item.name,
    qty: Math.max(1, Math.floor(Number(qty) || 1)),
    basePrice: item.price,
    modifiers: priced.modifiers,
    unitPrice: priced.unitPrice,
    status,
    preparedBy: null,
    readyAt: null,
    servedAt: null,
    ...extra,
  };
}

/** Create an order record with defaults and computed totals (not yet stored). */
export function createOrderRecord(fields) {
  const now = iso();
  const order = {
    id: nextId('ord'),
    number: ++orderSeq.lastNumber,
    type: 'dine-in',
    fulfillment: 'dine-in',
    tableId: null,
    customerId: null,
    waiterId: null,
    createdBy: null,
    source: 'staff',
    status: 'placed',
    paymentStatus: 'unpaid',
    paymentMethod: null,
    priority: 'normal',
    kitchenRank: null,
    items: [],
    rates: { taxRate: settings.taxRate, serviceChargeRate: settings.serviceChargeRate },
    subtotal: 0,
    discount: 0,
    serviceCharge: 0,
    tax: 0,
    tip: 0,
    total: 0,
    pointsUsed: 0,
    pointsEarned: 0,
    notes: '',
    deliveryAddress: '',
    split: null,
    refund: null,
    createdAt: now,
    confirmedAt: null,
    readyAt: null,
    servedAt: null,
    servedBy: null,
    paidAt: null,
    closedAt: null,
    cancelledAt: null,
    updatedAt: now,
    stockDeducted: false,
    ...fields,
  };
  computeTotals(order);
  return order;
}

/* ---------------------------------------------------------- reservations */

export const reservationStatuses = ['requested', 'confirmed', 'seated', 'cancelled', 'no_show'];

export const reservations = [];

/* ------------------------------------------------------------- staff ops */

/** Staff applications awaiting approval (US9.1). */
export const applications = [];

/** Shift schedule (US9.3). status: scheduled | completed | missed */
export const shifts = [];

/**
 * Attendance sessions: { id, userId, date, clockIn, clockOut|null,
 * breaks: [{ start, end|null }], shiftId|null, late, lateMinutes }.
 * `date` is the local date the session started (lib/attendance.js).
 */
export const attendance = [];

/** Pay adjustments (bonuses, deductions): { id, userId, amount, reason, date, createdBy, createdAt }. */
export const payAdjustments = [];

/* ---------------------------------------------------------- notifications */

/**
 * In-app notifications. Targeted at one user (userId) or broadcast to a role.
 * channel 'email' entries are a log of (simulated) emails to guests.
 */
export const notifications = [];

/* ================================================================== seed */

const byName = (name) => menuItems.find((m) => m.name === name);
const tableNo = (n) => tables.find((t) => t.number === n);

seedHistory({
  orders, reservations, shifts, tables, menuItems, customers,
  TIME_SLOTS, buildOrderItem, createOrderRecord, nextId,
});

seedAttendance({ attendance, payAdjustments, shifts, settings, nextId });

seedLiveState();

function seedLiveState() {
  const now = Date.now();
  const at = (minutesAgo) => iso(new Date(now - minutesAgo * MINUTE));
  const [emma, liam, sofia, casey, olivia, noah] = customers;

  // 1 · Dine-in at table 4, half-cooked and running late (flags on the KDS).
  const o1 = createOrderRecord({
    tableId: tableNo(4).id, customerId: emma.id, waiterId: 'usr_waiter', createdBy: 'usr_waiter',
    status: 'preparing', createdAt: at(32), confirmedAt: at(28), kitchenRank: now - 28 * MINUTE,
    items: [
      buildOrderItem(byName('Margherita Pizza'), 2, [{ group: 'Size', label: 'Large' }, { group: 'Extras', label: 'Mushrooms' }], 'preparing', { preparedBy: 'usr_chef' }),
      buildOrderItem(byName('Garlic Bread'), 1, [], 'ready', { preparedBy: 'usr_chef', readyAt: at(6) }),
    ],
  });

  // 2 · Casey's prepaid online pickup order, waiting for a waiter to confirm.
  const o2 = createOrderRecord({
    type: 'online', fulfillment: 'pickup', customerId: casey.id, createdBy: 'usr_customer', source: 'customer',
    paymentMethod: 'card', paymentStatus: 'paid', paidAt: at(4), createdAt: at(4),
    items: [
      buildOrderItem(byName('Vegan Bowl'), 1),
      buildOrderItem(byName('Lemonade'), 2, [{ group: 'Size', label: 'Large' }]),
    ],
  });
  o2.pointsEarned = Math.floor(o2.total);

  // 3 · Table 6 has eaten and is waiting for the bill.
  const o3 = createOrderRecord({
    tableId: tableNo(6).id, waiterId: 'usr_waiter2', createdBy: 'usr_waiter2',
    status: 'served', createdAt: at(75), confirmedAt: at(72), readyAt: at(40), servedAt: at(35), servedBy: 'usr_waiter2',
    items: [
      buildOrderItem(byName('Beef Burger'), 2, [{ group: 'Cook', label: 'Medium' }, { group: 'Extras', label: 'Bacon' }], 'served', { preparedBy: 'usr_chef2' }),
      buildOrderItem(byName('Fries'), 2, [], 'served', { preparedBy: 'usr_chef2' }),
      buildOrderItem(byName('Soda'), 2, [], 'served', { preparedBy: 'usr_chef2' }),
    ],
  });

  // 4 · Liam's online pickup is ready at the pass (pay cash on collection).
  const o4 = createOrderRecord({
    type: 'online', fulfillment: 'pickup', customerId: liam.id, createdBy: 'usr_waiter', source: 'staff',
    waiterId: 'usr_waiter', paymentMethod: 'cash', status: 'ready',
    createdAt: at(22), confirmedAt: at(20), readyAt: at(2), kitchenRank: now - 20 * MINUTE,
    items: [
      buildOrderItem(byName('Caesar Salad'), 1, [{ group: 'Add-ons', label: 'Grilled Chicken' }], 'ready', { preparedBy: 'usr_chef', readyAt: at(2) }),
      buildOrderItem(byName('Iced Tea'), 1, [], 'ready', { preparedBy: 'usr_chef', readyAt: at(3) }),
    ],
  });

  // 5 · Rush order just sent to the kitchen for table 3.
  const o5 = createOrderRecord({
    tableId: tableNo(3).id, customerId: sofia.id, waiterId: 'usr_waiter', createdBy: 'usr_waiter',
    status: 'confirmed', priority: 'rush', createdAt: at(6), confirmedAt: at(5), kitchenRank: now - 5 * MINUTE,
    items: [
      buildOrderItem(byName('Hummus Plate'), 1, [], 'queued'),
      buildOrderItem(byName('Vegan Bowl'), 2, [], 'queued'),
    ],
  });

  orders.push(o1, o2, o3, o4, o5);
  for (const o of [o1, o2, o3, o4, o5]) o.updatedAt = o.createdAt;

  Object.assign(tableNo(4), { status: 'occupied', waiterId: 'usr_waiter' });
  Object.assign(tableNo(3), { status: 'occupied', waiterId: 'usr_waiter' });
  Object.assign(tableNo(6), { status: 'occupied', waiterId: 'usr_waiter2' });

  // Bookings: one arriving soon (table held), one late (no-show candidate),
  // and upcoming requests waiting for confirmation.
  const soon = roundToSlot(new Date(now + 20 * MINUTE), 'up'); // 20–49 min away → table already held
  const late = roundToSlot(new Date(now - 30 * MINUTE), 'down');
  const booking = (fields) => ({
    id: nextId('res'),
    phone: '',
    specialRequests: '',
    tableId: null,
    customerId: null,
    status: 'requested',
    createdAt: at(24 * 60),
    confirmedAt: null,
    seatedAt: null,
    cancelledAt: null,
    notifiedAt: null,
    ...fields,
  });
  reservations.push(
    booking({ customerName: olivia.name, email: olivia.email, phone: olivia.phone, customerId: olivia.id, partySize: 4, date: localDate(soon), time: localTime(soon), tableId: tableNo(7).id, status: 'confirmed', confirmedAt: at(600), notifiedAt: at(600), specialRequests: 'Anniversary dinner' }),
    booking({ customerName: 'Ava Johnson', email: 'ava@example.com', partySize: 2, date: localDate(late), time: localTime(late), tableId: tableNo(2).id, status: 'confirmed', confirmedAt: at(900), notifiedAt: at(900) }),
    booking({ customerName: casey.name, email: casey.email, phone: casey.phone, customerId: casey.id, partySize: 2, date: localDate(addDays(new Date(now), 2)), time: '20:00' }),
    booking({ customerName: noah.name, email: noah.email, phone: noah.phone, customerId: noah.id, partySize: 6, date: localDate(addDays(new Date(now), 1)), time: '13:00', specialRequests: 'Birthday — cake at 2pm' }),
    booking({ customerName: emma.name, email: emma.email, phone: emma.phone, customerId: emma.id, partySize: 4, date: localDate(addDays(new Date(now), 5)), time: '19:30', status: 'confirmed', confirmedAt: at(60), notifiedAt: at(60), specialRequests: 'Window table please' }),
  );

  applications.push(
    { id: nextId('app'), name: 'Priya Singh', email: 'priya@example.com', phone: '+1 555-0140', desiredRole: 'chef', experience: 'Five years as a line cook at Ember & Oak; wood-fire experience.', status: 'pending', createdAt: at(26 * 60), decidedAt: null, decidedBy: null, userId: null },
    { id: nextId('app'), name: 'Tom Baker', email: 'tom@example.com', phone: '+1 555-0141', desiredRole: 'waiter', experience: 'Weekend server for two years, good wine knowledge.', status: 'pending', createdAt: at(180), decidedAt: null, decidedBy: null, userId: null },
    { id: nextId('app'), name: 'Jake Miller', email: 'jake@example.com', phone: '', desiredRole: 'waiter', experience: 'No hospitality experience yet.', status: 'rejected', createdAt: at(6 * 24 * 60), decidedAt: at(5 * 24 * 60), decidedBy: 'usr_manager', userId: null },
  );

  const note = (fields, minutesAgo) =>
    notifications.push({ id: nextId('ntf'), userId: null, role: null, channel: 'in-app', to: null, link: null, orderId: null, reservationId: null, readBy: [], createdAt: at(minutesAgo), ...fields });
  note({ role: 'manager', type: 'low_stock', title: 'Low stock', message: 'Mozzarella is at or below its reorder level (9 kg left).', link: '/staff/inventory' }, 90);
  note({ userId: 'usr_waiter', type: 'item_ready', title: 'Ready for pickup', message: 'Table 4 · Garlic Bread is ready at the pass.', link: '/staff/orders', orderId: o1.id }, 6);
  note({ role: 'waiter', type: 'order_placed', title: 'New online order', message: `Order #${o2.number} from ${casey.name} is waiting for confirmation.`, link: '/staff/orders', orderId: o2.id }, 4);
  note({ userId: 'usr_waiter', type: 'order_ready', title: 'Order ready', message: `Order #${o4.number} (pickup) is ready to hand over.`, link: '/staff/orders', orderId: o4.id }, 2);
}

/** Round a Date to the nearest half-hour slot in the given direction. */
function roundToSlot(d, direction) {
  const out = new Date(d);
  const minutes = out.getMinutes();
  out.setSeconds(0, 0);
  if (direction === 'up') out.setMinutes(minutes === 0 || minutes === 30 ? minutes : minutes < 30 ? 30 : 60);
  else out.setMinutes(minutes < 30 ? 0 : 30);
  return out;
}
