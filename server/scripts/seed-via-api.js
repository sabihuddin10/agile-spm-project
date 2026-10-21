/**
 * Seed database via API endpoints — exercises all mutating endpoints.
 * Run after fresh DB init: node scripts/seed-via-api.js
 */
import 'dotenv/config';

const BASE = 'http://localhost:4000/api';
const ADMIN_EMAIL = 'admin@rest.test';
const ADMIN_PASS = 'password';

// Helpers
async function login(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const data = await res.json();
  return data.token;
}

async function call(token, method, path, body = undefined, ignore409 = false) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    if (ignore409 && res.status === 409) {
      console.log(`  ${method} ${path} → 409 (already exists, skipping)`);
      return null;
    }
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function main() {
  console.log('[seed] Starting API-based seed...');
  
  // 1. Login as admin
  const token = await login(ADMIN_EMAIL, ADMIN_PASS);
  console.log('[seed] Logged in as admin');

  // 2. Create categories (POST /api/menu/categories)
  console.log('[seed] Creating categories...');
  const cats = [
    { name: 'Starters', sort: 1, active: true },
    { name: 'Mains', sort: 2, active: true },
    { name: 'Desserts', sort: 3, active: true },
    { name: 'Drinks', sort: 4, active: true },
  ];
  const catIds = [];
  for (const c of cats) {
    const cat = await call(token, 'POST', '/menu/categories', c, true);
    if (cat) catIds.push(cat.id);
    console.log(`  Created category: ${c.name}`);
  }

  // 3. Create inventory items (POST /api/inventory)
  console.log('[seed] Creating inventory items...');
  const invItems = [
    { name: 'All-purpose Flour', category: 'Dry Goods', stock: 25000, unit: 'g', reorderLevel: 5000, costPerUnit: 0.002, supplier: 'Farm Supply Co' },
    { name: 'Fresh Yeast', category: 'Dry Goods', stock: 500, unit: 'g', reorderLevel: 100, costPerUnit: 0.01, supplier: 'Farm Supply Co' },
    { name: 'Tomato Sauce', category: 'Dry Goods', stock: 8000, unit: 'ml', reorderLevel: 2000, costPerUnit: 0.005, supplier: 'Italian Imports' },
    { name: 'Mozzarella Cheese', category: 'Dairy', stock: 3000, unit: 'g', reorderLevel: 800, costPerUnit: 0.02, supplier: 'Dairy Fresh' },
    { name: 'Fresh Basil', category: 'Produce', stock: 200, unit: 'g', reorderLevel: 50, costPerUnit: 0.05, supplier: 'Green Gardens' },
    { name: 'Chicken Breast', category: 'Meat', stock: 5000, unit: 'g', reorderLevel: 1500, costPerUnit: 0.015, supplier: 'Prime Meats' },
    { name: 'Dried Pasta', category: 'Dry Goods', stock: 10000, unit: 'g', reorderLevel: 2000, costPerUnit: 0.003, supplier: 'Italian Imports' },
    { name: 'Beef Mince', category: 'Meat', stock: 4000, unit: 'g', reorderLevel: 1000, costPerUnit: 0.025, supplier: 'Prime Meats' },
    { name: 'Romaine Lettuce', category: 'Produce', stock: 1500, unit: 'g', reorderLevel: 300, costPerUnit: 0.008, supplier: 'Green Gardens' },
    { name: 'Parmesan', category: 'Dairy', stock: 1000, unit: 'g', reorderLevel: 200, costPerUnit: 0.04, supplier: 'Dairy Fresh' },
    { name: 'Salmon Fillet', category: 'Seafood', stock: 2000, unit: 'g', reorderLevel: 500, costPerUnit: 0.04, supplier: 'Ocean Catch' },
    { name: 'Potatoes', category: 'Produce', stock: 15000, unit: 'g', reorderLevel: 3000, costPerUnit: 0.001, supplier: 'Farm Supply Co' },
    { name: 'Butter', category: 'Dairy', stock: 2000, unit: 'g', reorderLevel: 400, costPerUnit: 0.015, supplier: 'Dairy Fresh' },
    { name: 'Heavy Cream', category: 'Dairy', stock: 3000, unit: 'ml', reorderLevel: 600, costPerUnit: 0.01, supplier: 'Dairy Fresh' },
    { name: 'Dark Chocolate', category: 'Dry Goods', stock: 1500, unit: 'g', reorderLevel: 300, costPerUnit: 0.03, supplier: 'Sweet Supplies' },
    { name: 'Sugar', category: 'Dry Goods', stock: 10000, unit: 'g', reorderLevel: 2000, costPerUnit: 0.001, supplier: 'Farm Supply Co' },
    { name: 'Coffee Beans', category: 'Beverages', stock: 5000, unit: 'g', reorderLevel: 1000, costPerUnit: 0.02, supplier: 'Roastery Direct' },
    { name: 'Orange Juice', category: 'Beverages', stock: 4000, unit: 'ml', reorderLevel: 800, costPerUnit: 0.006, supplier: 'Fresh Squeeze' },
  ];
  const invIds = [];
  for (const item of invItems) {
    const inv = await call(token, 'POST', '/inventory', item, true);
    if (inv) invIds.push(inv.id);
    console.log(`  Created inventory: ${item.name}`);
  }

  // 4. Create menu items with recipes (POST /api/menu/items, PUT /api/menu/items/:id/recipe)
  console.log('[seed] Creating menu items...');
  const menuItems = [
    { name: 'Margherita Pizza', categoryId: catIds[1], price: 12.5, description: 'Tomato, mozzarella, basil', dietaryTags: ['vegetarian'], allergens: ['gluten', 'dairy'], modifiers: [{ id: 'mod_crust', name: 'Crust', type: 'single', options: [{ label: 'Thin', priceDelta: 0 }, { label: 'Thick', priceDelta: 1.5 }] }], recipe: [{ inventoryId: invIds[0], qty: 300 }, { inventoryId: invIds[2], qty: 150 }, { inventoryId: invIds[3], qty: 200 }, { inventoryId: invIds[4], qty: 10 }] },
    { name: 'Caesar Salad', categoryId: catIds[0], price: 9.0, description: 'Romaine, parmesan, croutons', dietaryTags: [], allergens: ['gluten', 'dairy', 'egg'], modifiers: [{ id: 'mod_protein', name: 'Add Protein', type: 'single', options: [{ label: 'None', priceDelta: 0 }, { label: 'Grilled Chicken', priceDelta: 3.0 }] }], recipe: [{ inventoryId: invIds[8], qty: 200 }, { inventoryId: invIds[9], qty: 30 }, { inventoryId: invIds[5], qty: 150 }, { inventoryId: invIds[12], qty: 20 }] },
    { name: 'Beef Burger', categoryId: catIds[1], price: 14.0, description: 'Beef patty, bun', dietaryTags: [], allergens: ['gluten'], modifiers: [{ id: 'mod_extra', name: 'Extras', type: 'multi', options: [{ label: 'Extra Cheese', priceDelta: 1.5 }, { label: 'Bacon', priceDelta: 2.0 }, { label: 'Fried Egg', priceDelta: 1.0 }] }], recipe: [{ inventoryId: invIds[7], qty: 200 }, { inventoryId: invIds[0], qty: 100 }, { inventoryId: invIds[11], qty: 150 }] },
    { name: 'Grilled Salmon', categoryId: catIds[1], price: 18.5, description: 'Grilled salmon with potatoes', dietaryTags: ['gluten-free'], allergens: ['fish'], recipe: [{ inventoryId: invIds[10], qty: 250 }, { inventoryId: invIds[11], qty: 200 }, { inventoryId: invIds[12], qty: 30 }] },
    { name: 'Pasta Carbonara', categoryId: catIds[1], price: 13.5, description: 'Pasta with cream, parmesan', dietaryTags: [], allergens: ['gluten', 'egg', 'dairy'], recipe: [{ inventoryId: invIds[6], qty: 200 }, { inventoryId: invIds[12], qty: 40 }, { inventoryId: invIds[13], qty: 100 }, { inventoryId: invIds[9], qty: 40 }] },
    { name: 'Tiramisu', categoryId: catIds[2], price: 7.5, description: 'Classic tiramisu', dietaryTags: ['vegetarian'], allergens: ['gluten', 'dairy', 'egg'], recipe: [{ inventoryId: invIds[16], qty: 50 }, { inventoryId: invIds[13], qty: 100 }, { inventoryId: invIds[14], qty: 40 }, { inventoryId: invIds[15], qty: 30 }] },
    { name: 'Chocolate Lava Cake', categoryId: catIds[2], price: 8.0, description: 'Warm chocolate cake', dietaryTags: ['vegetarian'], allergens: ['gluten', 'dairy', 'egg'], recipe: [{ inventoryId: invIds[15], qty: 80 }, { inventoryId: invIds[12], qty: 60 }, { inventoryId: invIds[14], qty: 50 }, { inventoryId: invIds[0], qty: 40 }] },
    { name: 'Fresh Lemonade', categoryId: catIds[3], price: 4.5, description: 'Fresh squeezed', dietaryTags: ['vegan', 'gluten-free'], allergens: [], recipe: [{ inventoryId: invIds[14], qty: 30 }, { inventoryId: invIds[17], qty: 200 }] },
    { name: 'Espresso', categoryId: catIds[3], price: 3.5, description: 'Strong coffee', dietaryTags: ['vegan', 'gluten-free'], allergens: [], recipe: [{ inventoryId: invIds[16], qty: 18 }] },
    { name: 'Bruschetta', categoryId: catIds[0], price: 7.0, description: 'Tomato on toast', dietaryTags: ['vegan'], allergens: ['gluten'], recipe: [{ inventoryId: invIds[0], qty: 80 }, { inventoryId: invIds[2], qty: 100 }, { inventoryId: invIds[4], qty: 5 }] },
    { name: 'Fish and Chips', categoryId: catIds[1], price: 15.0, description: 'Battered fish', dietaryTags: [], allergens: ['fish', 'gluten'], recipe: [{ inventoryId: invIds[10], qty: 180 }, { inventoryId: invIds[11], qty: 300 }, { inventoryId: invIds[0], qty: 100 }] },
    { name: 'Garden Soup', categoryId: catIds[0], price: 6.5, description: 'Vegetable soup', dietaryTags: ['vegan', 'gluten-free'], allergens: [], recipe: [{ inventoryId: invIds[11], qty: 250 }, { inventoryId: invIds[12], qty: 20 }] },
  ];
  const miIds = [];
  for (const item of menuItems) {
    const { recipe, ...rest } = item;
    const mi = await call(token, 'POST', '/menu/items', rest);
    miIds.push(mi.id);
    console.log(`  Created menu item: ${item.name} (${mi.id})`);
    if (recipe?.length) {
      await call(token, 'PUT', `/menu/items/${mi.id}/recipe`, recipe);
      console.log(`    Added recipe for ${item.name}`);
    }
  }

  // 5. Create tables (POST /api/tables)
  console.log('[seed] Creating tables...');
  const tables = [
    { number: 1, seats: 2, zone: 'Window' },
    { number: 2, seats: 2, zone: 'Window' },
    { number: 3, seats: 4, zone: 'Main hall' },
    { number: 4, seats: 4, zone: 'Main hall' },
    { number: 5, seats: 6, zone: 'Main hall' },
    { number: 6, seats: 4, zone: 'Terrace' },
    { number: 7, seats: 2, zone: 'Terrace' },
    { number: 8, seats: 8, zone: 'Terrace' },
  ];
  for (const t of tables) {
    await call(token, 'POST', '/tables', t);
    console.log(`  Created table: ${t.number}`);
  }

  // 6. Create a customer (POST /api/customers)
  console.log('[seed] Creating customer...');
  const customer = await call(token, 'POST', '/customers', {
    name: 'Chris Customer',
    email: 'customer@rest.test',
    phone: '+92 300 7777777',
    type: 'online',
    loyaltyPoints: 45,
    notes: 'Test customer',
  });
  console.log(`  Created customer: ${customer.id}`);

  // 6b. Update customer preferences (PATCH /api/customers/me as customer)
  // First login as customer
  const custToken = await login('customer@rest.test', 'password');
  await call(custToken, 'PATCH', '/customers/me', {
    dietary: ['vegetarian'],
    allergies: ['peanuts'],
  });
  console.log('  Updated customer preferences');

  // 7. Create reservations (POST /api/reservations)
  console.log('[seed] Creating reservations...');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];
  const res1 = await call(token, 'POST', '/reservations', {
    customerName: 'Chris Customer',
    email: 'customer@rest.test',
    phone: '+92 300 7777777',
    partySize: 4,
    date: dateStr,
    time: '19:00',
    tableId: 'tab_3',
  });
  console.log(`  Created reservation: ${res1.id}`);
  
  const res2 = await call(token, 'POST', '/reservations', {
    customerName: 'Sarah Khan',
    email: 'sarah@example.com',
    phone: '+92 300 1234567',
    partySize: 2,
    date: dateStr,
    time: '20:00',
    tableId: 'tab_1',
  });
  console.log(`  Created reservation: ${res2.id}`);

  // 8. Create orders (POST /api/orders)
  console.log('[seed] Creating orders...');
  // Order 1: dine-in
  const order1 = await call(token, 'POST', '/orders', {
    type: 'dine-in',
    fulfillment: 'dine-in',
    tableId: 'tab_3',
    customerId: 'cus_chris',
    waiterId: 'usr_waiter',
    source: 'staff',
    items: [
      { menuItemId: miIds[0], qty: 1, modifiers: [] },
      { menuItemId: miIds[7], qty: 1, modifiers: [] },
    ],
  });
  console.log(`  Created order: ${order1.id} (${order1.number})`);

  // Order 2: online pickup
  const order2 = await call(token, 'POST', '/orders', {
    type: 'online',
    fulfillment: 'pickup',
    customerId: 'cus_chris',
    source: 'customer',
    items: [
      { menuItemId: miIds[2], qty: 1, modifiers: [] },
      { menuItemId: miIds[7], qty: 1, modifiers: [] },
    ],
  });
  console.log(`  Created order: ${order2.id} (${order2.number})`);

  // Order 3: dine-in
  const order3 = await call(token, 'POST', '/orders', {
    type: 'dine-in',
    fulfillment: 'dine-in',
    tableId: 'tab_5',
    waiterId: 'usr_waiter2',
    source: 'staff',
    items: [
      { menuItemId: miIds[4], qty: 2, modifiers: [] },
      { menuItemId: miIds[5], qty: 1, modifiers: [] },
    ],
  });
  console.log(`  Created order: ${order3.id} (${order3.number})`);

  // 8b. Update order items (PATCH /api/orders/:id/items/:itemId)
  // Get order items for order1
  const o1 = await call(token, 'GET', `/orders/${order1.id}`);
  if (o1.items?.length) {
    await call(token, 'PATCH', `/orders/${order1.id}/items/${o1.items[0].id}`, { status: 'ready' });
    console.log('  Updated order item status');
  }

  // 8c. Update order status (POST /api/orders/:id/status)
  await call(token, 'POST', `/orders/${order1.id}/status`, { status: 'confirmed' });
  await call(token, 'POST', `/orders/${order1.id}/status`, { status: 'preparing' });
  await call(token, 'POST', `/orders/${order1.id}/status`, { status: 'ready' });
  await call(token, 'POST', `/orders/${order1.id}/status`, { status: 'served' });
  console.log('  Updated order statuses');

  // 9. Bill split (POST /api/billing/:id/split)
  const split = await call(token, 'POST', `/billing/${order1.id}/split`, { mode: 'even' });
  console.log(`  Created split: ${split.id}`);

  // 9b. Pay split part (POST /api/billing/:id/split/:index/pay)
  await call(token, 'POST', `/billing/${order1.id}/split/0/pay`, { method: 'card' });
  console.log('  Paid split part');

  // 9c. Pay bill (POST /api/billing/:id/pay)
  await call(token, 'POST', `/billing/${order1.id}/pay`, { method: 'card', tip: 5.0 });
  console.log('  Paid bill');

  // 10. Stock movement - restock (PATCH /api/inventory/:id)
  await call(token, 'PATCH', `/inventory/${invIds[0]}`, { delta: 1000 });
  console.log('  Restocked inventory');

  // 11. Purchase order (POST /api/inventory/purchase-orders)
  const po = await call(token, 'POST', '/inventory/purchase-orders', {
    lines: [
      { inventoryId: invIds[3], name: 'Mozzarella Cheese', unit: 'g', supplier: 'Dairy Fresh', qty: 1000, costPerUnit: 0.02 },
    ],
    notes: 'Restock mozzarella',
  });
  console.log(`  Created PO: ${po.id}`);

  // 11b. Receive PO (POST /api/inventory/purchase-orders/:id/receive)
  await call(token, 'POST', `/inventory/purchase-orders/${po.id}/receive`);
  console.log('  Received PO');

  // 12. Staff shifts (POST /api/staff/shifts)
  const tomorrowStr = dateStr;
  const shift = await call(token, 'POST', '/staff/shifts', {
    userId: 'usr_waiter',
    date: tomorrowStr,
    start: '17:00',
    end: '23:00',
    notes: 'Evening shift',
  });
  console.log(`  Created shift: ${shift.id}`);

  // 13. Attendance clock in/out (POST /api/attendance/clock-in)
  await call(token, 'POST', '/attendance/clock-in', {});
  console.log('  Clocked in');
  await call(token, 'POST', '/attendance/break/start', {});
  console.log('  Started break');
  await call(token, 'POST', '/attendance/break/end', {});
  console.log('  Ended break');
  await call(token, 'POST', '/attendance/clock-out', {});
  console.log('  Clocked out');

  // 14. Pay adjustment (POST /api/workforce/users/:id/adjustments)
  await call(token, 'POST', '/workforce/users/usr_waiter/adjustments', {
    amount: 25.0,
    reason: 'Bonus',
    date: tomorrowStr,
  });
  console.log('  Added pay adjustment');

  // 15. Notifications read (POST /api/notifications/read-all)
  await call(token, 'POST', '/notifications/read-all', {});
  console.log('  Marked notifications read');

  // 16. Settings update (PATCH /api/settings)
  await call(token, 'PATCH', '/settings', { restaurantName: 'Plate & Flame Test' });
  console.log('  Updated settings');

  console.log('\n[seed] All API endpoints exercised successfully!');
  console.log('Run health check to verify all endpoints are up.');
}

main().catch(err => {
  console.error('[seed] ERROR:', err.message);
  process.exit(1);
});