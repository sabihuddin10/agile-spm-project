/**
 * API catalogue for the /api/health status page.
 *
 * The list of endpoints is read from the live Express router stacks, so it
 * cannot drift from the code: every registered route appears, documented or
 * not. Mount-level auth (authenticate / optionalAuth) and route-level role
 * guards (requireRole, which tags its guard with `allowedRoles`) are also read
 * from the stacks. The hand-written ROUTE_DOCS map below only adds prose:
 * description, inputs, an illustrative response shape, and role rules that a
 * handler enforces itself.
 *
 * Example responses are made-up shapes, never live records.
 */

export const MODULES = [
  'health', 'auth', 'customers', 'menu', 'orders', 'billing', 'tables',
  'reservations', 'inventory', 'staff', 'analytics', 'notifications', 'settings',
];

export const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/* ----------------------------------------------------------- doc helpers */

/** Required / optional input field: [type, note]. */
const req = (type, note = '') => ({ type, required: true, note });
const opt = (type, note = '') => ({ type, required: false, note });

const ok = (example, status = 200) => ({ status, example });

const USER = { id: 'usr_12', name: 'Jamie Rivera', email: 'jamie@example.com', role: 'waiter', active: true, createdAt: '2026-01-04T10:00:00.000Z' };
const CUSTOMER = {
  id: 'cus_8', userId: 'usr_20', name: 'Alex Kim', email: 'alex@example.com', phone: '555-0100', type: 'online',
  loyaltyPoints: 120, preferences: { dietary: ['vegetarian'], allergies: ['nuts'] }, notes: '', createdAt: '2026-02-01T09:00:00.000Z',
  orderHistory: [{ id: 'ord_41', number: 1041, date: '2026-10-01', total: 42.5, items: ['2× Margherita'], status: 'closed', paymentStatus: 'paid' }],
  orderCount: 1, totalSpend: 42.5,
};
const MENU_ITEM = {
  id: 'mi_3', name: 'Margherita', categoryId: 'cat_2', category: 'Pizza', price: 14, description: 'Tomato, mozzarella, basil',
  dietaryTags: ['vegetarian'], allergens: ['gluten', 'dairy'],
  modifiers: [{ id: 'mod_1', name: 'Size', type: 'single', options: [{ label: 'Large', priceDelta: 4 }] }],
  available: true, outOfStockReason: '',
};
const ORDER = {
  id: 'ord_41', number: 1041, type: 'dine-in', fulfillment: 'dine-in', tableId: 'tab_3', tableNumber: 3, status: 'confirmed',
  paymentStatus: 'unpaid', priority: 'normal', waiterName: 'Jamie Rivera', customer: null,
  items: [{ id: 'oi_90', menuItemId: 'mi_3', name: 'Margherita', qty: 2, unitPrice: 14, modifiers: [], status: 'queued' }],
  subtotal: 28, discount: 0, serviceCharge: 1.4, tax: 2.8, tip: 0, total: 32.2, createdAt: '2026-10-08T18:02:00.000Z',
};
const INVOICE = {
  id: 'ord_41', number: 1041, receiptNumber: 'R-1041', tableNumber: 3, status: 'served', paymentStatus: 'unpaid', paid: false,
  lines: [{ id: 'oi_90', name: 'Margherita', qty: 2, unitPrice: 14, lineTotal: 28 }],
  subtotal: 28, discount: 0, serviceCharge: 1.4, tax: 2.8, tip: 0, total: 32.2, refundedAmount: 0, netTotal: 32.2, split: null,
  restaurant: { name: 'Restaurant name', address: 'Street address' },
};
const TABLE = {
  id: 'tab_3', number: 3, seats: 4, zone: 'Main', status: 'occupied', waiterId: 'usr_12', waiterName: 'Jamie Rivera', held: false,
  activeOrders: [{ id: 'ord_41', number: 1041, status: 'confirmed', total: 32.2, paymentStatus: 'unpaid' }], nextReservation: null,
};
const RESERVATION = {
  id: 'res_7', customerName: 'Alex Kim', email: 'alex@example.com', phone: '', partySize: 4, date: '2026-10-10', time: '19:00',
  tableId: null, tableNumber: null, status: 'requested', specialRequests: '', late: false, hasAccount: true,
};
const INV_ITEM = {
  id: 'inv_5', name: 'Mozzarella', category: 'Dairy', stock: 8, unit: 'kg', reorderLevel: 5, costPerUnit: 9.5, supplier: 'Dairy Co',
  lowStock: false, health: 'ok', usedBy: ['Margherita'],
};
const PURCHASE_ORDER = {
  id: 'po_2', number: 'PO-0002', status: 'sent', total: 47.5, notes: '', createdAt: '2026-10-08T09:00:00.000Z', receivedAt: null,
  lines: [{ inventoryId: 'inv_5', name: 'Mozzarella', unit: 'kg', supplier: 'Dairy Co', qty: 5, costPerUnit: 9.5, cost: 47.5 }],
};
const APPLICATION = {
  id: 'app_4', name: 'Sam Lee', email: 'sam@example.com', phone: '', desiredRole: 'chef', experience: '3 years line cook',
  status: 'pending', createdAt: '2026-10-07T12:00:00.000Z', decidedAt: null, decidedBy: null, userId: null,
};
const SHIFT = {
  id: 'shf_9', userId: 'usr_12', userName: 'Jamie Rivera', role: 'waiter', date: '2026-10-09', start: '17:00', end: '23:00',
  hours: 6, status: 'scheduled', notes: '',
};
const SETTINGS = {
  restaurantName: 'Restaurant name', address: 'Street address', taxRate: 0.1, serviceChargeRate: 0.05, pointValue: 0.1,
  kitchenDelayMinutes: 15, reservationDurationMinutes: 90, reservationGraceMinutes: 15, openingHour: 12, closingHour: 22,
};
const DELETED = (id) => ok({ deleted: true, id });
const MODIFIER_GROUPS = opt('array', 'Modifier groups: [{ name, type: single|multi, options: [{ label, priceDelta }] }]');
const PREFERENCES = opt('object', '{ dietary: string[], allergies: string[] }');

/* ------------------------------------------------------- endpoint notes */

/**
 * Keyed by "METHOD /api/path" exactly as Express registers it. `roles` is only
 * for checks a handler makes itself; requireRole guards are read from code.
 * `auth: 'required'` marks a handler that rejects guests on an optional-auth mount.
 * `probe` supplies the query a safe GET probe needs, or `false` to skip it.
 */
export const ROUTE_DOCS = {
  /* ---- health */
  'GET /api/health': {
    summary: 'Service status. Browsers get this page; other clients get JSON.',
    query: { format: opt('json|html', 'Force a representation instead of using the Accept header') },
    response: ok({ status: 'ok', service: 'restaurant-ops-api', time: '2026-10-08T18:00:00.000Z', uptimeSeconds: 5321, persistence: { enabled: true, store: 'postgres' }, endpoints: 84 }),
  },
  'GET /api/health/endpoints': {
    summary: 'Machine-readable catalogue of every endpoint (this page as JSON).',
    response: ok({ service: 'restaurant-ops-api', count: 84, modules: ['auth', '...'], endpoints: [{ method: 'GET', path: '/api/menu', module: 'menu', auth: 'optional', roles: [], probe: { enabled: true } }] }),
  },
  'GET /api/health/check': {
    summary: 'Runs the live probes: every safe GET is called without credentials; results are cached for a few seconds.',
    probe: false,
    probeReason: 'Runs the probes itself',
    response: ok({
      checkedAt: '2026-10-08T18:00:00.000Z', durationMs: 412, summary: { up: 30, auth: 25, warn: 0, down: 0, skipped: 50, total: 84 },
      database: { enabled: true, status: 'up', latencyMs: 38 },
      results: [{ id: 'GET /api/menu', status: 'up', httpStatus: 200, latencyMs: 12 }, { id: 'GET /api/orders', status: 'auth', httpStatus: 401, latencyMs: 4 }],
    }),
  },

  /* ---- auth */
  'POST /api/auth/register': {
    summary: 'Create a customer account and its linked customer profile.',
    body: { name: req('string'), email: req('string', 'Valid email, unique'), password: req('string', 'At least 6 characters') },
    response: ok({ user: { ...USER, role: 'customer' }, token: '<jwt>' }, 201),
    errors: ['400 missing/invalid fields', '409 email already registered'],
  },
  'POST /api/auth/login': {
    summary: 'Sign in with email and password (any role) and receive a JWT.',
    body: { email: req('string'), password: req('string') },
    response: ok({ user: USER, token: '<jwt>' }),
    errors: ['401 wrong email or password', '403 account suspended'],
  },
  'GET /api/auth/me': {
    summary: 'The signed-in user.',
    response: ok({ user: USER }),
  },
  'GET /api/auth/roles': {
    summary: 'The five stakeholder roles.',
    response: ok({ roles: ['customer', 'waiter', 'chef', 'manager', 'admin'] }),
  },
  'GET /api/auth/users': {
    summary: 'Every user account, without password hashes.',
    response: ok({ users: [USER] }),
  },
  'PATCH /api/auth/users/:id': {
    summary: 'Change a user\'s role or suspend/reactivate them. Admins cannot change their own role or suspend themselves.',
    body: { role: opt('string', 'customer|waiter|chef|manager|admin'), active: opt('boolean') },
    response: ok({ user: USER }),
    errors: ['400 invalid role / self-change', '404 user not found'],
  },
  'DELETE /api/auth/users/:id': {
    summary: 'Remove an account; its tokens stop working immediately. Linked customer records are kept.',
    response: DELETED('usr_12'),
    errors: ['400 cannot remove yourself', '404 user not found'],
  },

  /* ---- customers */
  'GET /api/customers/me': {
    summary: 'The caller\'s own customer profile with order history. A customer without a profile gets one created (201).',
    access: 'Staff without a linked customer profile get 404.',
    response: ok({ customer: CUSTOMER }),
  },
  'PATCH /api/customers/me': {
    summary: 'Edit the caller\'s own profile; name and email changes also update the login account.',
    roles: ['customer'],
    access: 'Other roles get 403.',
    body: { name: opt('string'), email: opt('string', 'Valid, not used by another account'), phone: opt('string'), preferences: PREFERENCES, notes: opt('string') },
    response: ok({ customer: CUSTOMER }),
    errors: ['400 invalid field', '403 not a customer', '409 email in use'],
  },
  'GET /api/customers': {
    summary: 'Customer ledger, sorted by name, each with order history and spend.',
    query: { q: opt('string', 'Matches name, email or phone'), type: opt('string', 'walk-in|online'), dietary: opt('string'), allergy: opt('string') },
    response: ok({ customers: [CUSTOMER] }),
  },
  'GET /api/customers/:id': {
    summary: 'One customer with order history.',
    response: ok({ customer: CUSTOMER }),
    errors: ['404 customer not found'],
  },
  'POST /api/customers': {
    summary: 'Create a customer record (not a login account).',
    body: { name: req('string'), email: opt('string'), phone: opt('string'), type: opt('string', 'walk-in (default) | online'), preferences: PREFERENCES, notes: opt('string') },
    response: ok({ customer: { ...CUSTOMER, userId: null, type: 'walk-in' } }, 201),
  },
  'PATCH /api/customers/:id': {
    summary: 'Update a customer record.',
    body: { name: opt('string'), email: opt('string'), phone: opt('string'), type: opt('string', 'walk-in|online'), preferences: PREFERENCES, notes: opt('string') },
    response: ok({ customer: CUSTOMER }),
    errors: ['400 empty name', '404 customer not found'],
  },
  'DELETE /api/customers/:id': {
    summary: 'Delete a customer record; past orders are kept.',
    response: DELETED('cus_8'),
  },

  /* ---- menu */
  'GET /api/menu': {
    summary: 'Menu grouped by category. Guests see active, non-empty categories; staff can ask for everything.',
    query: { scope: opt('string', '"manage" (staff only) includes hidden categories and recipes') },
    response: ok({ menu: [{ id: 'cat_2', name: 'Pizza', sort: 2, active: true, itemCount: 1, items: [MENU_ITEM] }], tags: ['vegetarian', 'vegan'], allergens: ['gluten', 'dairy'] }),
  },
  'GET /api/menu/items': {
    summary: 'Flat list of every menu item. Staff also get each recipe.',
    response: ok({ items: [MENU_ITEM] }),
  },
  'POST /api/menu/items': {
    summary: 'Create a menu item.',
    body: {
      name: req('string'), categoryId: req('string'), price: req('number', '>= 0'), description: opt('string'),
      dietaryTags: opt('string[]'), allergens: opt('string[]'), modifiers: MODIFIER_GROUPS, available: opt('boolean', 'Default true'), outOfStockReason: opt('string'),
    },
    response: ok({ item: { ...MENU_ITEM, recipe: [] } }, 201),
    errors: ['400 missing fields / unknown category / bad modifiers'],
  },
  'PATCH /api/menu/items/:id': {
    summary: 'Update a menu item. Chefs may only change availability.',
    access: 'Handler limits chefs to available / outOfStockReason.',
    body: {
      name: opt('string'), categoryId: opt('string'), price: opt('number'), description: opt('string'), dietaryTags: opt('string[]'),
      allergens: opt('string[]'), modifiers: MODIFIER_GROUPS, available: opt('boolean'), outOfStockReason: opt('string'),
    },
    response: ok({ item: MENU_ITEM }),
    errors: ['400 invalid field', '403 chef changing more than availability', '404 item not found'],
  },
  'PUT /api/menu/items/:id/recipe': {
    summary: 'Replace the dish\'s recipe (bill of materials) used for stock deduction.',
    body: { recipe: req('array', '[{ inventoryId, qty > 0 }], each ingredient once') },
    response: ok({ item: { ...MENU_ITEM, recipe: [{ inventoryId: 'inv_5', qty: 0.2, name: 'Mozzarella', unit: 'kg' }] } }),
  },
  'DELETE /api/menu/items/:id': {
    summary: 'Delete a menu item.',
    response: DELETED('mi_3'),
  },
  'GET /api/menu/categories': {
    summary: 'All categories in display order with item counts.',
    response: ok({ categories: [{ id: 'cat_2', name: 'Pizza', sort: 2, active: true, itemCount: 6 }] }),
  },
  'POST /api/menu/categories': {
    summary: 'Create a category.',
    body: { name: req('string', 'Unique'), sort: opt('number') },
    response: ok({ category: { id: 'cat_9', name: 'Desserts', sort: 9, active: true, itemCount: 0 } }, 201),
  },
  'PATCH /api/menu/categories/:id': {
    summary: 'Rename, reorder or hide a category.',
    body: { name: opt('string'), sort: opt('number'), active: opt('boolean') },
    response: ok({ category: { id: 'cat_9', name: 'Desserts', sort: 9, active: false, itemCount: 0 } }),
  },
  'DELETE /api/menu/categories/:id': {
    summary: 'Delete an empty category.',
    response: DELETED('cat_9'),
    errors: ['409 category still has items'],
  },

  /* ---- orders */
  'POST /api/orders': {
    summary: 'Place an order. Customers order online or at their table; floor staff orders go straight to the kitchen.',
    roles: ['customer', 'waiter', 'manager', 'admin'],
    access: 'Chefs get 403.',
    body: {
      type: req('string', 'dine-in|online'), items: req('array', '[{ menuItemId, qty, modifiers }]'), tableId: opt('string', 'Required for a customer dine-in order'),
      fulfillment: opt('string', 'pickup|delivery (online)'), deliveryAddress: opt('string', 'Required for delivery'), customerId: opt('string', 'Staff only'),
      notes: opt('string'), paymentMethod: opt('string', 'card|cash (customers)'), pointsUsed: opt('number', 'Loyalty points to redeem (customers)'),
      sendToKitchen: opt('boolean', 'Staff; default true'),
    },
    response: ok({ order: ORDER }, 201),
    errors: ['400 invalid order', '403 role cannot order', '409 item unavailable'],
  },
  'GET /api/orders': {
    summary: 'Staff order list, newest first.',
    query: { scope: opt('string', 'active (default) | today | all'), status: opt('string'), tableId: opt('string'), type: opt('string'), customerId: opt('string') },
    response: ok({ orders: [ORDER] }),
  },
  'GET /api/orders/mine': {
    summary: 'The signed-in customer\'s last 50 orders. Other roles get an empty list.',
    response: ok({ orders: [ORDER] }),
  },
  'GET /api/orders/kitchen': {
    summary: 'Kitchen display queue (rush first, then oldest) and the ready-for-pickup list.',
    response: ok({ queue: [ORDER], ready: [], delayMinutes: 15 }),
  },
  'GET /api/orders/:id': {
    summary: 'One order.',
    access: 'Any staff role, or the customer who owns the order (others get 403).',
    response: ok({ order: ORDER }),
    errors: ['403 not your order', '404 order not found'],
  },
  'PUT /api/orders/:id/items': {
    summary: 'Replace the line items of an unpaid order that has not been confirmed yet.',
    body: { items: req('array', '[{ menuItemId, qty, modifiers }]') },
    response: ok({ order: ORDER }),
    errors: ['409 already confirmed or prepaid'],
  },
  'POST /api/orders/:id/status': {
    summary: 'Move the order through placed > confirmed > preparing > ready > served, or cancel it.',
    roles: ['customer', 'waiter', 'chef', 'manager', 'admin'],
    access: 'Per target status: confirmed/served/cancelled need floor staff, preparing/ready need kitchen staff; a customer may cancel their own order while it is still placed.',
    body: { status: req('string', 'confirmed|preparing|ready|served|cancelled'), reason: opt('string', 'Cancellation reason') },
    response: ok({ order: { ...ORDER, status: 'preparing' } }),
    errors: ['400 invalid status', '403 role not allowed', '409 illegal transition'],
  },
  'PATCH /api/orders/:id/items/:itemId': {
    summary: 'Set one item\'s status (kitchen: preparing/ready, floor: served).',
    access: 'Handler checks the role against the target status.',
    body: { status: req('string', 'preparing|ready|served') },
    response: ok({ order: ORDER }),
  },
  'PATCH /api/orders/:id/table': {
    summary: 'Attach an active dine-in order to a table.',
    body: { tableId: req('string') },
    response: ok({ order: ORDER }),
  },
  'POST /api/orders/:id/kitchen': {
    summary: 'Reprioritise an order in the kitchen queue.',
    body: { action: req('string', 'up|down|rush|normal') },
    response: ok({ order: { ...ORDER, priority: 'rush' } }),
    errors: ['409 not in the queue / already at the edge'],
  },

  /* ---- billing */
  'GET /api/billing': {
    summary: 'Bills with an outstanding / paid-today summary.',
    query: { scope: opt('string', 'open (default) | today | all') },
    response: ok({ bills: [INVOICE], summary: { outstanding: 32.2, openCount: 1, paidToday: 410.75, paidTodayCount: 12 } }),
  },
  'GET /api/billing/:id': {
    summary: 'Itemised invoice for an order.',
    access: 'Waiter, manager, admin, or the customer who owns the order (others get 403).',
    response: ok({ invoice: INVOICE }),
  },
  'GET /api/billing/:id/receipt': {
    summary: 'Receipt for a settled bill.',
    access: 'Waiter, manager, admin, or the customer who owns the order (others get 403).',
    response: ok({ receipt: { ...INVOICE, paid: true, paymentStatus: 'paid', issuedAt: '2026-10-08T19:30:00.000Z' } }),
    errors: ['409 bill not paid yet'],
  },
  'POST /api/billing/:id/tip': {
    summary: 'Set the tip as an amount or a percentage of the subtotal. Clears any split.',
    body: { amount: opt('number', '>= 0'), percent: opt('number', '0-100; wins over amount') },
    response: ok({ invoice: { ...INVOICE, tip: 4.2, total: 36.4 } }),
  },
  'POST /api/billing/:id/split': {
    summary: 'Split the bill evenly or by items; parts always sum to the total.',
    body: { mode: req('string', 'even|items'), ways: opt('number', '2-20 (even)'), groups: opt('string[][]', 'Item ids per payer (items)') },
    response: ok({ invoice: { ...INVOICE, split: { mode: 'even', parts: [{ label: 'Guest 1', amount: 16.1, paid: false }, { label: 'Guest 2', amount: 16.1, paid: false }] } } }),
  },
  'DELETE /api/billing/:id/split': {
    summary: 'Undo a split before anyone has paid a share.',
    response: ok({ invoice: INVOICE }),
  },
  'POST /api/billing/:id/split/:index/pay': {
    summary: 'One payer settles their share; the bill is paid once every share is.',
    body: { method: opt('string', 'card (default) | cash') },
    response: ok({ invoice: INVOICE }),
  },
  'POST /api/billing/:id/pay': {
    summary: 'Record full payment.',
    body: { method: opt('string', 'card (default) | cash') },
    response: ok({ invoice: { ...INVOICE, paid: true, paymentStatus: 'paid' }, alreadyPaid: false }),
  },
  'POST /api/billing/:id/unpay': {
    summary: 'Reverse a payment recorded in error.',
    response: ok({ invoice: INVOICE }),
    errors: ['409 not paid or already refunded'],
  },
  'POST /api/billing/:id/refund': {
    summary: 'Refund a paid bill in full or in part, with a reason.',
    body: { reason: req('string', 'At least 3 characters'), amount: opt('number', 'Defaults to the remaining total') },
    response: ok({ invoice: { ...INVOICE, paymentStatus: 'refunded', refundedAmount: 32.2, netTotal: 0 } }),
  },

  /* ---- tables */
  'GET /api/tables/public': {
    summary: 'Table numbers, seats and zones for customers ordering at their table.',
    response: ok({ tables: [{ id: 'tab_3', number: 3, seats: 4, zone: 'Main' }] }),
  },
  'GET /api/tables': {
    summary: 'Live floor plan with active orders and the next booking per table. Also refreshes reservation holds.',
    response: ok({ tables: [TABLE], zones: ['Main', 'Patio'], statuses: ['free', 'occupied', 'reserved', 'cleaning'] }),
  },
  'POST /api/tables': {
    summary: 'Add a table.',
    body: { number: req('integer', 'Unique, >= 1'), seats: opt('integer', '1-20, default 4'), zone: opt('string') },
    response: ok({ table: { ...TABLE, status: 'free', activeOrders: [] } }, 201),
  },
  'PATCH /api/tables/:id': {
    summary: 'Change status, assigned waiter or hold; managers can also change number, seats and zone.',
    access: 'Handler limits layout fields (number, seats, zone) to manager/admin.',
    body: { status: opt('string'), waiterId: opt('string|null'), held: opt('boolean'), number: opt('integer'), seats: opt('integer'), zone: opt('string') },
    response: ok({ table: TABLE }),
  },
  'DELETE /api/tables/:id': {
    summary: 'Remove a table without active orders.',
    response: DELETED('tab_3'),
    errors: ['409 table has active orders'],
  },

  /* ---- reservations */
  'GET /api/reservations/availability': {
    summary: 'Open time slots for a date and party size.',
    query: { date: req('YYYY-MM-DD'), partySize: opt('number', 'Default 2') },
    response: ok({ date: '2026-10-10', partySize: 4, slots: [{ time: '19:00', available: true }] }),
    probe: { query: () => ({ date: todayLocal(), partySize: '2' }) },
  },
  'GET /api/reservations': {
    summary: 'Reservation book. Also refreshes table holds.',
    query: { scope: opt('string', 'upcoming (default) | past | all'), status: opt('string') },
    response: ok({ reservations: [RESERVATION], slots: ['12:00', '12:30'] }),
  },
  'GET /api/reservations/mine': {
    summary: 'The signed-in customer\'s bookings. Other roles get an empty list.',
    auth: 'required',
    access: 'Guests get 401; non-customers get an empty list.',
    roles: ['customer', 'waiter', 'chef', 'manager', 'admin'],
    response: ok({ reservations: [RESERVATION] }),
  },
  'POST /api/reservations': {
    summary: 'Request a booking (guests or customers). Fully booked slots return up to three alternatives.',
    body: {
      customerName: req('string', 'Defaults to the signed-in customer'), email: req('string', 'Defaults to the signed-in customer'), phone: opt('string'),
      partySize: req('integer', '1-12'), date: req('YYYY-MM-DD'), time: req('HH:MM', 'Not in the past'), specialRequests: opt('string'),
    },
    response: ok({ reservation: RESERVATION }, 201),
    errors: ['400 invalid fields', '409 fully booked: { error, alternatives: [{ date, time }] }'],
  },
  'PATCH /api/reservations/:id': {
    summary: 'Confirm, seat, cancel or mark no-show; move date/time, party size or table.',
    body: { status: opt('string', 'requested|confirmed|seated|cancelled|no_show'), tableId: opt('string|null'), partySize: opt('integer'), date: opt('YYYY-MM-DD'), time: opt('HH:MM'), specialRequests: opt('string') },
    response: ok({ reservation: { ...RESERVATION, status: 'confirmed', tableId: 'tab_3', tableNumber: 3 } }),
    errors: ['400 invalid field', '409 slot taken / illegal transition'],
  },
  'POST /api/reservations/:id/cancel': {
    summary: 'Cancel a requested or confirmed booking.',
    roles: ['customer', 'waiter', 'manager', 'admin'],
    auth: 'required',
    access: 'Floor staff, or the customer who made the booking.',
    response: ok({ reservation: { ...RESERVATION, status: 'cancelled' } }),
  },

  /* ---- inventory */
  'GET /api/inventory': {
    summary: 'Ingredient stock with low-stock flags and the dishes that use each one.',
    response: ok({ inventory: [INV_ITEM], units: ['kg', 'L', 'units'], categories: ['Dairy', 'Produce'] }),
  },
  'POST /api/inventory': {
    summary: 'Add an ingredient.',
    body: { name: req('string', 'Unique'), category: opt('string'), stock: opt('number'), unit: opt('string'), reorderLevel: opt('number'), costPerUnit: opt('number'), supplier: opt('string') },
    response: ok({ item: INV_ITEM }, 201),
  },
  'PATCH /api/inventory/:id': {
    summary: 'Adjust stock by a delta (restock / wastage); managers can also edit details or set a counted stock level.',
    access: 'Chefs may only send delta; other fields need manager/admin.',
    body: { delta: opt('number'), stock: opt('number', 'Counted level'), name: opt('string'), category: opt('string'), unit: opt('string'), reorderLevel: opt('number'), costPerUnit: opt('number'), supplier: opt('string') },
    response: ok({ item: INV_ITEM }),
  },
  'DELETE /api/inventory/:id': {
    summary: 'Remove an ingredient that no recipe uses.',
    response: DELETED('inv_5'),
    errors: ['409 used in recipes'],
  },
  'GET /api/inventory/movements': {
    summary: 'Recent stock movements, newest first.',
    query: { limit: opt('number', 'Default 50, max 500'), inventoryId: opt('string') },
    response: ok({ movements: [{ id: 'mov_30', inventoryId: 'inv_5', delta: -0.4, reason: 'sale', at: '2026-10-08T18:05:00.000Z' }] }),
  },
  'GET /api/inventory/reorder': {
    summary: 'Suggested reorder quantities for low-stock ingredients.',
    query: { all: opt('any', 'Present = include every ingredient') },
    response: ok({ lines: [{ inventoryId: 'inv_5', name: 'Mozzarella', unit: 'kg', supplier: 'Dairy Co', stock: 4, reorderLevel: 5, suggestedQty: 6, costPerUnit: 9.5, estimatedCost: 57 }], estimatedTotal: 57 }),
  },
  'GET /api/inventory/purchase-orders': {
    summary: 'Submitted purchase orders, newest first.',
    response: ok({ purchaseOrders: [PURCHASE_ORDER] }),
  },
  'POST /api/inventory/purchase-orders': {
    summary: 'Submit a reorder form.',
    body: { lines: req('array', '[{ inventoryId, qty > 0 }]'), notes: opt('string') },
    response: ok({ purchaseOrder: PURCHASE_ORDER }, 201),
  },
  'POST /api/inventory/purchase-orders/:id/receive': {
    summary: 'Mark goods received and restock every line.',
    response: ok({ purchaseOrder: { ...PURCHASE_ORDER, status: 'received', receivedAt: '2026-10-09T08:00:00.000Z' } }),
    errors: ['409 already received'],
  },

  /* ---- staff */
  'GET /api/staff/roster': {
    summary: 'Staff accounts, active and suspended.',
    response: ok({ staff: [USER] }),
  },
  'POST /api/staff/applications': {
    summary: 'Public "join our team" form.',
    body: { name: req('string'), email: req('string'), phone: opt('string'), desiredRole: req('string', 'waiter|chef'), experience: opt('string') },
    response: ok({ application: APPLICATION }, 201),
    errors: ['409 account exists / application pending'],
  },
  'GET /api/staff/applications': {
    summary: 'Application review queue, newest first.',
    query: { status: opt('string', 'pending|approved|rejected') },
    response: ok({ applications: [{ ...APPLICATION, decidedByName: null }] }),
  },
  'POST /api/staff/applications/:id/approve': {
    summary: 'Approve an application: creates the staff account and returns a one-time temporary password.',
    access: 'Managers approve waiters and chefs; admins may also approve managers.',
    body: { role: opt('string', 'Defaults to the desired role') },
    response: ok({ application: { ...APPLICATION, status: 'approved' }, user: { ...USER, role: 'chef' }, tempPassword: '<generated>' }),
  },
  'POST /api/staff/applications/:id/reject': {
    summary: 'Reject a pending application.',
    response: ok({ application: { ...APPLICATION, status: 'rejected' } }),
  },
  'GET /api/staff/shifts/mine': {
    summary: 'The signed-in staff member\'s shifts (default: last 7 to next 14 days).',
    query: { from: opt('YYYY-MM-DD'), to: opt('YYYY-MM-DD') },
    response: ok({ shifts: [SHIFT], from: '2026-10-01', to: '2026-10-22' }),
  },
  'GET /api/staff/shifts': {
    summary: 'Full rota (default: the next 7 days).',
    query: { from: opt('YYYY-MM-DD'), to: opt('YYYY-MM-DD'), userId: opt('string') },
    response: ok({ shifts: [SHIFT], from: '2026-10-08', to: '2026-10-14' }),
  },
  'POST /api/staff/shifts': {
    summary: 'Assign a shift; rejects overlaps and suspended staff. Notifies the staff member.',
    body: { userId: req('string'), date: req('YYYY-MM-DD'), start: req('HH:MM'), end: req('HH:MM', 'After start'), notes: opt('string') },
    response: ok({ shift: SHIFT }, 201),
  },
  'PATCH /api/staff/shifts/:id': {
    summary: 'Reschedule a shift or mark it completed / missed.',
    body: { userId: opt('string'), date: opt('YYYY-MM-DD'), start: opt('HH:MM'), end: opt('HH:MM'), status: opt('string', 'scheduled|completed|missed'), notes: opt('string') },
    response: ok({ shift: { ...SHIFT, status: 'completed' } }),
  },
  'DELETE /api/staff/shifts/:id': {
    summary: 'Delete a shift.',
    response: DELETED('shf_9'),
  },
  'GET /api/staff/performance': {
    summary: 'Per-staff metrics: orders, revenue, tips, prep time, shifts (default: last 30 days).',
    query: { from: opt('YYYY-MM-DD'), to: opt('YYYY-MM-DD') },
    response: ok({ from: '2026-09-09', to: '2026-10-08', staff: [{ userId: 'usr_12', name: 'Jamie Rivera', role: 'waiter', active: true, ordersTaken: 120, ordersServed: 110, revenueHandled: 5400.5, tips: 380, itemsPrepared: 0, avgPrepMinutes: null, shiftsCompleted: 18, shiftsMissed: 1, hoursWorked: 108 }] }),
  },

  /* ---- analytics */
  'GET /api/analytics/summary': {
    summary: 'Today\'s headline numbers for the staff overview.',
    response: ok({ summary: { revenueToday: 1240.5, ordersToday: 38, activeOrders: 6, openBills: 4, lowStock: 2, bookingsToday: 9 } }),
  },
  'GET /api/analytics/dashboard': {
    summary: 'KPI dashboard: trend, top dishes, table turnover, peak hours, inventory health, no-show rate.',
    query: { from: opt('YYYY-MM-DD', 'Default 29 days before "to"'), to: opt('YYYY-MM-DD', 'Default today'), granularity: opt('string', 'day (default) | week | month') },
    response: ok({
      range: { from: '2026-09-09', to: '2026-10-08', granularity: 'day', days: 30 },
      kpis: { revenue: 35210.4, orders: 1180, avgOrder: 29.84, tips: 2100, refunds: 64.5, cancelled: 12, customers: 410 },
      trend: [{ period: '2026-10-08', revenue: 1240.5, orders: 38 }], dishes: [{ name: 'Margherita', qty: 240, revenue: 3360 }],
      tables: [], zones: [], peakHours: [{ hour: 19, orders: 210, revenue: 6300, avgPerDay: 7 }], inventory: [],
      reservations: { total: 220, seated: 180, noShows: 9, cancelled: 31, noShowRate: 4.8, cancellationRate: 14.1 },
    }),
    errors: ['400 "from" after "to"'],
  },

  /* ---- notifications */
  'GET /api/notifications': {
    summary: 'The caller\'s 30 latest in-app notifications (personal and role-wide) with the unread count.',
    response: ok({ notifications: [{ id: 'ntf_55', type: 'order_ready', title: 'Order ready', message: 'Table 3 — order #1041 is ready.', link: '/staff/orders', read: false, createdAt: '2026-10-08T18:20:00.000Z' }], unreadCount: 1 }),
  },
  'POST /api/notifications/read-all': {
    summary: 'Mark all of the caller\'s notifications as read.',
    response: ok({ ok: true }),
  },
  'POST /api/notifications/:id/read': {
    summary: 'Mark one notification as read.',
    response: ok({ notification: { id: 'ntf_55', type: 'order_ready', title: 'Order ready', read: true } }),
    errors: ['404 not found or not addressed to you'],
  },

  /* ---- settings */
  'GET /api/settings': {
    summary: 'Restaurant policy (tax, service charge, points value, hours) and booking time slots.',
    response: ok({ settings: SETTINGS, timeSlots: ['12:00', '12:30'] }),
  },
  'PATCH /api/settings': {
    summary: 'Update restaurant policy. Numeric fields are range-checked; opening hour must be before closing.',
    body: {
      restaurantName: opt('string'), address: opt('string'), taxRate: opt('number', '0-0.5'), serviceChargeRate: opt('number', '0-0.5'),
      pointValue: opt('number', '0-1'), kitchenDelayMinutes: opt('number', '1-240'), reservationDurationMinutes: opt('number', '30-300'),
      reservationGraceMinutes: opt('number', '0-120'), openingHour: opt('number', '0-23'), closingHour: opt('number', '1-24'),
    },
    response: ok({ settings: SETTINGS }),
  },
};

function todayLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/* --------------------------------------------------------- router walk */

/** Mount path of an `app.use(path, ...)` layer, recovered from Express 4's regexp. */
export function mountPath(layer) {
  if (layer.regexp?.fast_slash) return '';
  const source = layer.regexp?.source ?? '';
  const match = source.match(/^\^(.*?)\\\/\?\(\?=\\\/\|\$\)$/);
  if (!match) return null;
  return match[1].replace(/\\\//g, '/').replace(/\\(.)/g, '$1');
}

const join = (a, b) => (`${a}${b === '/' ? '' : b}` || '/');

function guardRoles(stack) {
  const roles = stack.map((l) => l.handle?.allowedRoles).filter(Boolean);
  if (!roles.length) return null;
  // Several guards in a row: only roles allowed by every one get through.
  return roles.reduce((acc, list) => acc.filter((r) => list.includes(r)));
}

/**
 * Every route registered on the app: { method, path, mountAuth, routeAuth,
 * guardRoles }. Mount auth is the authenticate / optionalAuth middleware
 * mounted on the same prefix before the router.
 */
export function listRoutes(app) {
  const out = [];
  const stack = app._router?.stack ?? [];
  const mountAuth = new Map();

  const addRoute = (route, prefix, auth) => {
    const path = join(prefix, route.path);
    const routeAuth = route.stack.some((l) => l.name === 'authenticate') ? 'required' : null;
    for (const method of Object.keys(route.methods).filter((m) => route.methods[m] && m !== '_all')) {
      out.push({ method: method.toUpperCase(), path, mountAuth: auth, routeAuth, guardRoles: guardRoles(route.stack) });
    }
  };

  for (const layer of stack) {
    if (layer.route) {
      addRoute(layer.route, '', null);
      continue;
    }
    const prefix = mountPath(layer);
    if (layer.name === 'authenticate' || layer.name === 'optionalAuth') {
      if (prefix !== null) mountAuth.set(prefix, layer.name === 'authenticate' ? 'required' : 'optional');
      continue;
    }
    if (layer.name === 'router' && layer.handle?.stack) {
      const base = prefix ?? '/<unknown mount>';
      for (const inner of layer.handle.stack) {
        if (inner.route) addRoute(inner.route, base, mountAuth.get(prefix) ?? null);
      }
    }
  }
  return out;
}

/* --------------------------------------------------------------- build */

const keyOf = (method, path) => `${method} ${path}`;

function moduleOf(path) {
  const seg = path.split('/')[2] || 'root';
  return seg;
}

function paramsOf(path) {
  return (path.match(/:(\w+)/g) || []).map((p) => p.slice(1));
}

/**
 * Merge the live routes with ROUTE_DOCS. Returns entries in module order, then
 * registration order. Undocumented routes are listed with `documented: false`.
 */
export function buildCatalog(app) {
  const routes = listRoutes(app);
  const entries = routes.map((r) => {
    const id = keyOf(r.method, r.path);
    const doc = ROUTE_DOCS[id];
    const auth = r.routeAuth || r.guardRoles ? 'required' : doc?.auth ?? r.mountAuth ?? 'none';
    const roles = r.guardRoles ?? doc?.roles ?? null;
    const mutating = MUTATING_METHODS.includes(r.method);
    let probe;
    if (mutating) probe = { enabled: false, reason: 'Not probed (mutating)' };
    else if (doc?.probe === false) probe = { enabled: false, reason: doc.probeReason || 'Not probed' };
    else probe = { enabled: true };
    return {
      id,
      module: moduleOf(r.path),
      method: r.method,
      path: r.path,
      params: paramsOf(r.path),
      documented: Boolean(doc),
      summary: doc?.summary ?? 'Undocumented: this route has no entry in lib/api-catalog.js.',
      auth,
      roles: roles ? [...roles] : [],
      rolesSource: r.guardRoles ? 'guard' : doc?.roles ? 'handler' : null,
      access: doc?.access ?? null,
      query: doc?.query ?? null,
      body: doc?.body ?? null,
      response: doc?.response ?? null,
      errors: doc?.errors ?? [],
      probe,
    };
  });
  const rank = (m) => (MODULES.includes(m) ? MODULES.indexOf(m) : MODULES.length);
  return entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => rank(a.e.module) - rank(b.e.module) || a.i - b.i)
    .map(({ e }) => e);
}

/** Path to request when probing an entry: params filled with a placeholder, docs' query appended. */
export function probeUrl(entry) {
  const path = entry.path.replace(/:(\w+)/g, '__probe__');
  const queryFn = ROUTE_DOCS[entry.id]?.probe?.query;
  const query = typeof queryFn === 'function' ? queryFn() : null;
  return query ? `${path}?${new URLSearchParams(query)}` : path;
}
