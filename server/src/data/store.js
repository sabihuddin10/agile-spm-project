/**
 * In-memory data store.
 *
 * This is the "local storage" layer for the current phase: all data lives in
 * memory and is seeded on server start. No database is used. Data resets every
 * time the server restarts.
 */
import bcrypt from 'bcryptjs';

const ROLE_CAPS = { customer: 0, waiter: 1, chef: 2, manager: 3, admin: 4 };

function nextId(prefix) {
  const n = counters[prefix] = (counters[prefix] || 0) + 1;
  return `${prefix}_${n}`;
}

const counters = {};

export const ROLES = Object.keys(ROLE_CAPS);

export function roleRank(role) {
  return ROLE_CAPS[role] ?? -1;
}

/* ------------------------------------------------------------------ users */

const seedUsers = [
  { id: 'usr_admin', name: 'Alex Admin', email: 'admin@rest.test', role: 'admin', active: true },
  { id: 'usr_manager', name: 'Maya Manager', email: 'manager@rest.test', role: 'manager', active: true },
  { id: 'usr_chef', name: 'Carlos Chef', email: 'chef@rest.test', role: 'chef', active: true },
  { id: 'usr_waiter', name: 'Will Waiter', email: 'waiter@rest.test', role: 'waiter', active: true },
  { id: 'usr_customer', name: 'Casey Customer', email: 'customer@rest.test', role: 'customer', active: true },
];

export const users = seedUsers.map((u) => ({
  ...u,
  passwordHash: bcrypt.hashSync('password', 10),
}));

export function findUserByEmail(email) {
  return users.find((u) => u.email.toLowerCase() === String(email || '').toLowerCase());
}

export function findUserById(id) {
  return users.find((u) => u.id === id);
}

export function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

export function createUser({ name, email, password, role = 'customer' }) {
  const user = {
    id: nextId('usr'),
    name,
    email: email.toLowerCase().trim(),
    passwordHash: bcrypt.hashSync(password, 10),
    role,
    active: true,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  return user;
}

/* ------------------------------------------------------------- customers */

export const customers = [
  {
    id: nextId('cus'),
    userId: null,
    name: 'Emma Thompson',
    email: 'emma@example.com',
    phone: '+1 555-0101',
    type: 'walk-in',
    loyaltyPoints: 320,
    totalSpend: 1240.5,
    preferences: { dietary: ['vegetarian'], allergies: ['peanuts'] },
    notes: '',
    createdAt: new Date().toISOString(),
  },
  {
    id: nextId('cus'),
    userId: null,
    name: 'Liam Nguyen',
    email: 'liam@example.com',
    phone: '+1 555-0102',
    type: 'online',
    loyaltyPoints: 85,
    totalSpend: 420.0,
    preferences: { dietary: ['gluten-free'], allergies: [] },
    notes: 'Prefers window table',
    createdAt: new Date().toISOString(),
  },
  {
    id: nextId('cus'),
    userId: null,
    name: 'Sofia Ramirez',
    email: 'sofia@example.com',
    phone: '+1 555-0103',
    type: 'walk-in',
    loyaltyPoints: 540,
    totalSpend: 1890.75,
    preferences: { dietary: ['vegan'], allergies: ['shellfish', 'dairy'] },
    notes: 'Regular weekend dinner guest',
    createdAt: new Date().toISOString(),
  },
  {
    id: nextId('cus'),
    userId: 'usr_customer', // linked to the demo customer login customer@rest.test
    name: 'Casey Customer',
    email: 'customer@rest.test',
    phone: '+1 555-0199',
    type: 'online',
    loyaltyPoints: 210,
    totalSpend: 687.4,
    preferences: { dietary: ['vegetarian', 'gluten-free'], allergies: ['peanuts'] },
    notes: 'Online customer · prefers contactless',
    createdAt: new Date().toISOString(),
  },
];

export function findCustomerByUserId(userId) {
  return customers.find((c) => c.userId === userId);
}

export const customerOrderHistory = {
  [customers[0].id]: [
    { id: nextId('ord'), date: '2026-08-20', total: 45.5, items: ['Margherita Pizza', 'Garlic Bread'] },
    { id: nextId('ord'), date: '2026-08-12', total: 28.0, items: ['Caesar Salad', 'Lemonade'] },
  ],
  [customers[1].id]: [
    { id: nextId('ord'), date: '2026-08-18', total: 62.25, items: ['Beef Burger', 'Fries', 'Soda'] },
  ],
  [customers[2].id]: [{ id: nextId('ord'), date: '2026-08-15', total: 98.0, items: ['Vegan Bowl', 'Hummus Plate', 'Iced Tea'] }],
  [customers[3].id]: [
    { id: nextId('ord'), date: '2026-08-22', total: 52.75, items: ['Vegan Bowl', 'Lemonade'] },
    { id: nextId('ord'), date: '2026-08-09', total: 31.5, items: ['Caesar Salad', 'Garlic Bread', 'Soda'] },
  ],
};

/* ------------------------------------------------------------------ menu */

export const categories = [
  { id: nextId('cat'), name: 'Starters', sort: 1, active: true },
  { id: nextId('cat'), name: 'Mains', sort: 2, active: true },
  { id: nextId('cat'), name: 'Drinks', sort: 3, active: true },
  { id: nextId('cat'), name: 'Desserts', sort: 4, active: true },
];

export const menuItems = [
  {
    id: nextId('mi'),
    name: 'Margherita Pizza',
    categoryId: categories[1].id,
    price: 18.0,
    description: 'San Marzano tomatoes, fresh mozzarella, basil.',
    dietaryTags: ['vegetarian'],
    allergens: ['gluten', 'dairy'],
    modifiers: [
      { id: nextId('mod'), name: 'Size', options: ['Regular', 'Large'], type: 'single' },
      { id: nextId('mod'), name: 'Extras', options: ['Extra Cheese', 'Pepperoni', 'Mushrooms'], type: 'multi' },
    ],
    available: true,
    outOfStockReason: '',
  },
  {
    id: nextId('mi'),
    name: 'Caesar Salad',
    categoryId: categories[0].id,
    price: 12.5,
    description: 'Romaine, parmesan, croutons, house Caesar dressing.',
    dietaryTags: ['vegetarian'],
    allergens: ['gluten', 'dairy', 'eggs'],
    modifiers: [],
    available: true,
    outOfStockReason: '',
  },
  {
    id: nextId('mi'),
    name: 'Beef Burger',
    categoryId: categories[1].id,
    price: 16.0,
    description: 'Grass-fed beef, cheddar, lettuce, tomato, house bun.',
    dietaryTags: [],
    allergens: ['gluten', 'dairy'],
    modifiers: [
      { id: nextId('mod'), name: 'Cook', options: ['Medium Rare', 'Medium', 'Well Done'], type: 'single' },
      { id: nextId('mod'), name: 'Extras', options: ['Bacon', 'Avocado', 'Fried Egg'], type: 'multi' },
    ],
    available: true,
    outOfStockReason: '',
  },
  {
    id: nextId('mi'),
    name: 'Vegan Bowl',
    categoryId: categories[1].id,
    price: 15.0,
    description: 'Quinoa, roasted vegetables, tahini, pickled onions.',
    dietaryTags: ['vegan', 'gluten-free'],
    allergens: ['sesame'],
    modifiers: [],
    available: true,
    outOfStockReason: '',
  },
  {
    id: nextId('mi'),
    name: 'Garlic Bread',
    categoryId: categories[0].id,
    price: 6.0,
    description: 'Wood-fired baguette, roasted garlic butter.',
    dietaryTags: ['vegetarian'],
    allergens: ['gluten', 'dairy'],
    modifiers: [],
    available: true,
    outOfStockReason: '',
  },
  {
    id: nextId('mi'),
    name: 'Hummus Plate',
    categoryId: categories[0].id,
    price: 8.0,
    description: 'House hummus, warm pita, olive oil.',
    dietaryTags: ['vegan'],
    allergens: ['sesame', 'gluten'],
    modifiers: [],
    available: true,
    outOfStockReason: '',
  },
  {
    id: nextId('mi'),
    name: 'Lemonade',
    categoryId: categories[2].id,
    price: 3.5,
    description: 'Fresh-squeezed, lightly sweetened.',
    dietaryTags: ['vegan', 'gluten-free'],
    allergens: [],
    modifiers: [{ id: nextId('mod'), name: 'Size', options: ['Small', 'Large'], type: 'single' }],
    available: true,
    outOfStockReason: '',
  },
  {
    id: nextId('mi'),
    name: 'Iced Tea',
    categoryId: categories[2].id,
    price: 3.0,
    description: 'Seasonal iced tea, unsweetened.',
    dietaryTags: ['vegan', 'gluten-free'],
    allergens: [],
    modifiers: [],
    available: true,
    outOfStockReason: '',
  },
  {
    id: nextId('mi'),
    name: 'Soda',
    categoryId: categories[2].id,
    price: 2.5,
    description: 'Classic soda, served chilled.',
    dietaryTags: ['vegan', 'gluten-free'],
    allergens: [],
    modifiers: [],
    available: true,
    outOfStockReason: '',
  },
  {
    id: nextId('mi'),
    name: 'Chocolate Ganache Cake',
    categoryId: categories[3].id,
    price: 7.5,
    description: 'Dark chocolate, silk ganache, salted caramel.',
    dietaryTags: ['vegetarian'],
    allergens: ['gluten', 'dairy', 'eggs'],
    modifiers: [],
    available: false,
    outOfStockReason: 'Bakery delivery delayed',
  },
  {
    id: nextId('mi'),
    name: 'Fries',
    categoryId: categories[0].id,
    price: 5.0,
    description: 'Crispy golden fries, sea salt.',
    dietaryTags: ['vegan', 'gluten-free'],
    allergens: [],
    modifiers: [],
    available: true,
    outOfStockReason: '',
  },
];

export const cuisineTagList = ['vegetarian', 'vegan', 'gluten-free', 'halal', 'keto', 'nut-free'];

export const allergenList = ['gluten', 'dairy', 'eggs', 'peanuts', 'tree nuts', 'shellfish', 'fish', 'soy', 'sesame'];

/* ---------------------------------------------------------------- tables */

export const tables = [
  { id: nextId('tab'), number: 1, seats: 2, status: 'free', waiterId: null },
  { id: nextId('tab'), number: 2, seats: 2, status: 'free', waiterId: null },
  { id: nextId('tab'), number: 3, seats: 4, status: 'free', waiterId: null },
  { id: nextId('tab'), number: 4, seats: 4, status: 'occupied', waiterId: 'usr_waiter' },
  { id: nextId('tab'), number: 5, seats: 6, status: 'free', waiterId: null },
  { id: nextId('tab'), number: 6, seats: 6, status: 'occupied', waiterId: 'usr_waiter' },
];

export const tableStatuses = ['free', 'occupied', 'reserved', 'cleaning'];

/* ---------------------------------------------------------------- orders */

export const ORDER_STATUSES = ['placed', 'confirmed', 'in_kitchen', 'ready', 'served', 'paid', 'cancelled'];

export const orders = [
  {
    id: nextId('ord'),
    number: 1001,
    type: 'dine-in',
    tableId: tables[3].id,
    customerId: customers[0].id,
    status: 'served',
    source: 'waiter',
    items: [
      { id: nextId('oi'), menuItemId: menuItems[0].id, name: 'Margherita Pizza', qty: 2, price: 18.0, status: 'served', modifiers: [] },
      { id: nextId('oi'), menuItemId: menuItems[4].id, name: 'Garlic Bread', qty: 1, price: 6.0, status: 'served', modifiers: [] },
    ],
    subtotal: 42.0,
    tax: null,
    discount: 0,
    total: 42.0,
    paidAt: null,
    createdAt: new Date(Date.now() - 90 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 60000).toISOString(),
  },
  {
    id: nextId('ord'),
    number: 1002,
    type: 'online',
    tableId: null,
    customerId: customers[3].id,
    status: 'in_kitchen',
    source: 'customer',
    items: [
      { id: nextId('oi'), menuItemId: menuItems[3].id, name: 'Vegan Bowl', qty: 1, price: 15.0, status: 'in_kitchen', modifiers: [] },
      { id: nextId('oi'), menuItemId: menuItems[6].id, name: 'Lemonade', qty: 2, price: 3.5, status: 'confirmed', modifiers: [] },
    ],
    subtotal: 22.0,
    tax: null,
    discount: 0,
    total: 22.0,
    paidAt: null,
    createdAt: new Date(Date.now() - 45 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 20 * 60000).toISOString(),
  },
];

export function findOrderById(id) {
  return orders.find((o) => o.id === id);
}

export const orderSeq = { lastNumber: 1002 };

/* ------------------------------------------------------------- inventory */

export const inventory = [
  { id: nextId('inv'), name: 'Tomatoes', category: 'Produce', stock: 120, unit: 'kg', reorderLevel: 20, costPerUnit: 2.5 },
  { id: nextId('inv'), name: 'Mozzarella', category: 'Dairy', stock: 18, unit: 'kg', reorderLevel: 10, costPerUnit: 9.0 },
  { id: nextId('inv'), name: 'Flour', category: 'Dry Goods', stock: 60, unit: 'kg', reorderLevel: 25, costPerUnit: 1.2 },
  { id: nextId('inv'), name: 'Beef Patties', category: 'Meat', stock: 8, unit: 'dozen', reorderLevel: 15, costPerUnit: 24.0 },
  { id: nextId('inv'), name: 'Chicken Breast', category: 'Meat', stock: 12, unit: 'kg', reorderLevel: 8, costPerUnit: 7.8 },
  { id: nextId('inv'), name: 'Romaine Lettuce', category: 'Produce', stock: 9, unit: 'kg', reorderLevel: 6, costPerUnit: 3.1 },
  { id: nextId('inv'), name: 'Lemons', category: 'Produce', stock: 40, unit: 'units', reorderLevel: 30, costPerUnit: 0.5 },
  { id: nextId('inv'), name: 'Dark Chocolate', category: 'Dry Goods', stock: 3, unit: 'kg', reorderLevel: 5, costPerUnit: 18.0 },
  { id: nextId('inv'), name: 'Olive Oil', category: 'Pantry', stock: 14, unit: 'L', reorderLevel: 8, costPerUnit: 11.0 },
  { id: nextId('inv'), name: 'Coffee Beans', category: 'Dry Goods', stock: 7, unit: 'kg', reorderLevel: 10, costPerUnit: 16.0 },
];

export const inventoryUnits = ['g', 'kg', 'L', 'units', 'dozen', 'boxes'];

/* ---------------------------------------------------------- reservations */

export const reservations = [
  {
    id: nextId('res'),
    customerName: 'Emma Thompson',
    email: 'emma@example.com',
    phone: '+1 555-0101',
    partySize: 4,
    date: '2026-09-12',
    time: '19:30',
    tableId: tables[2].id,
    status: 'confirmed',
    specialRequests: 'Window table please',
    customerId: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: nextId('res'),
    customerName: 'Casey Customer',
    email: 'customer@rest.test',
    phone: '+1 555-0199',
    partySize: 2,
    date: '2026-09-15',
    time: '20:00',
    tableId: null,
    status: 'pending',
    specialRequests: '',
    customerId: customers[3].id,
    createdAt: new Date().toISOString(),
  },
];

export const reservationStatuses = ['pending', 'confirmed', 'seated', 'cancelled', 'no_show'];

/* ---------------------------------------------------------------- exports */

export { nextId };

export function reset() {
  // no-op: reseed logic lives in index.js if needed
}
