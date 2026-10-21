-- =============================================================================
-- 002_seed.sql — demo seed data for the Restaurant Operations Platform
-- =============================================================================
-- Loads a coherent demo dataset: staff and guest accounts, the menu with its
-- modifier groups and recipes, inventory stock, dining tables, three sample
-- orders, two reservations and the default restaurant settings.
--
-- Conventions
--   * Idempotent — every statement is "INSERT ... ON CONFLICT DO NOTHING", so
--     the file can be re-applied without duplicating a row.
--   * Rows are resolved by their natural key (ext_id) through CTEs or scalar
--     subqueries; no surrogate id is hard-coded.
--   * All money is a numeric literal in dollars. Recipe quantities use the
--     unit stored on the inventory item (g or ml).
--   * Every demo account shares the bcrypt hash of the literal password
--     "password" (cost 10).
-- =============================================================================


-- ---------------------------------------------------------------------- users
-- One account per role. must_change_password is false so the demo can sign in
-- straight away; token_version stays at 0.
INSERT INTO users (
  ext_id, name, email, phone, role, active, must_change_password,
  password_hash, token_version, hourly_wage, created_at
)
VALUES
  ('usr_admin',    'Ava Admin',     'admin@rest.test',    '+92 300 1111111', 'admin',    true, false,
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 0, 25.00, now() - INTERVAL '120 days'),
  ('usr_manager',  'Miles Manager', 'manager@rest.test',  '+92 300 2222222', 'manager',  true, false,
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 0, 20.00, now() - INTERVAL '120 days'),
  ('usr_chef',     'Chef Carlos',   'chef@rest.test',     '+92 300 3333333', 'chef',     true, false,
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 0, 15.00, now() - INTERVAL '120 days'),
  ('usr_chef2',    'Cara Cook',     'chef2@rest.test',    '+92 300 4444444', 'chef',     true, false,
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 0, 15.00, now() - INTERVAL '120 days'),
  ('usr_waiter',   'Waiter Will',   'waiter@rest.test',   '+92 300 5555555', 'waiter',   true, false,
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 0, 12.00, now() - INTERVAL '120 days'),
  ('usr_waiter2',  'Wendy Server',  'waiter2@rest.test',  '+92 300 6666666', 'waiter',   true, false,
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 0, 12.00, now() - INTERVAL '120 days'),
  ('usr_customer', 'Customer Chris','customer@rest.test', '+92 300 7777777', 'customer', true, false,
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 0, NULL,  now() - INTERVAL '120 days')
ON CONFLICT DO NOTHING;


-- ------------------------------------------------------------ menu_categories
INSERT INTO menu_categories (ext_id, name, "sort", active)
VALUES
  ('cat_starters', 'Starters', 1, true),
  ('cat_mains',    'Mains',    2, true),
  ('cat_desserts', 'Desserts', 3, true),
  ('cat_drinks',   'Drinks',   4, true)
ON CONFLICT DO NOTHING;


-- ----------------------------------------------------------- inventory_items
-- Stock and reorder levels are in the item's own unit (g or ml); cost_per_unit
-- is in dollars per that unit. Note: the column is numeric(12,2), so unit
-- costs below a cent (0.002, 0.005, …) are rounded to two decimals by the
-- database.
INSERT INTO inventory_items (
  ext_id, name, category, stock, unit, reorder_level, cost_per_unit, supplier
)
VALUES
  ('inv_flour',       'All-purpose Flour', 'Dry Goods',  25000, 'g',  5000, 0.002, 'Farm Supply Co'),
  ('inv_yeast',       'Fresh Yeast',       'Dry Goods',    500, 'g',   100, 0.010, 'Farm Supply Co'),
  ('inv_tomato',      'Tomato Sauce',      'Dry Goods',   8000, 'ml', 2000, 0.005, 'Italian Imports'),
  ('inv_mozzarella',  'Mozzarella Cheese', 'Dairy',       3000, 'g',   800, 0.020, 'Dairy Fresh'),
  ('inv_basil',       'Fresh Basil',       'Produce',      200, 'g',    50, 0.050, 'Green Gardens'),
  ('inv_chicken',     'Chicken Breast',    'Meat',        5000, 'g',  1500, 0.015, 'Prime Meats'),
  ('inv_pasta',       'Dried Pasta',       'Dry Goods',  10000, 'g',  2000, 0.003, 'Italian Imports'),
  ('inv_beef',        'Beef Mince',        'Meat',        4000, 'g',  1000, 0.025, 'Prime Meats'),
  ('inv_lettuce',     'Romaine Lettuce',   'Produce',     1500, 'g',   300, 0.008, 'Green Gardens'),
  ('inv_parmesan',    'Parmesan',          'Dairy',       1000, 'g',   200, 0.040, 'Dairy Fresh'),
  ('inv_salmon',      'Salmon Fillet',     'Seafood',     2000, 'g',   500, 0.040, 'Ocean Catch'),
  ('inv_potato',      'Potatoes',          'Produce',    15000, 'g',  3000, 0.001, 'Farm Supply Co'),
  ('inv_butter',      'Butter',            'Dairy',       2000, 'g',   400, 0.015, 'Dairy Fresh'),
  ('inv_cream',       'Heavy Cream',       'Dairy',       3000, 'ml',  600, 0.010, 'Dairy Fresh'),
  ('inv_chocolate',   'Dark Chocolate',    'Dry Goods',   1500, 'g',   300, 0.030, 'Sweet Supplies'),
  ('inv_sugar',       'Sugar',             'Dry Goods',  10000, 'g',  2000, 0.001, 'Farm Supply Co'),
  ('inv_coffee',      'Coffee Beans',      'Beverages',   5000, 'g',  1000, 0.020, 'Roastery Direct'),
  ('inv_orange_juice','Orange Juice',      'Beverages',   4000, 'ml',  800, 0.006, 'Fresh Squeeze')
ON CONFLICT DO NOTHING;


-- ---------------------------------------------------------------- menu_items
-- Prices are in dollars. Modifier groups are stored as jsonb in the shape the
-- menu screen expects: [{ id, name, type, options: [{ label, priceDelta }] }].
WITH cat AS (
  SELECT id, ext_id
  FROM menu_categories
  WHERE ext_id IN ('cat_starters', 'cat_mains', 'cat_desserts', 'cat_drinks')
)
INSERT INTO menu_items (
  ext_id, category_id, name, price, description,
  dietary_tags, allergens, modifiers, available, out_of_stock_reason
)
SELECT
  v.ext_id, cat.id, v.name, v.price, v.description,
  v.dietary_tags, v.allergens, v.modifiers, v.available, v.out_of_stock_reason
FROM (VALUES
  ('mi_1',  'cat_mains',    'Margherita Pizza',    12.50, 'Tomato, mozzarella and basil on hand-stretched dough.',
   '{vegetarian}'::text[], '{gluten,dairy}'::text[],
   '[{"id":"mod_crust","name":"Crust","type":"single","options":[{"label":"Thin","priceDelta":0},{"label":"Thick","priceDelta":1.5}]}]'::jsonb,
   true, ''),
  ('mi_2',  'cat_starters', 'Caesar Salad',         9.00, 'Romaine, parmesan, croutons and house dressing.',
   '{}'::text[], '{gluten,dairy,egg}'::text[],
   '[{"id":"mod_protein","name":"Add Protein","type":"single","options":[{"label":"None","priceDelta":0},{"label":"Grilled Chicken","priceDelta":3.0}]}]'::jsonb,
   true, ''),
  ('mi_3',  'cat_mains',    'Beef Burger',         14.00, 'Char-grilled beef mince burger on a toasted bun with fries.',
   '{}'::text[], '{gluten}'::text[],
   '[{"id":"mod_extra","name":"Extras","type":"multi","options":[{"label":"Extra Cheese","priceDelta":1.5},{"label":"Bacon","priceDelta":2.0},{"label":"Fried Egg","priceDelta":1.0}]}]'::jsonb,
   true, ''),
  ('mi_4',  'cat_mains',    'Grilled Salmon',      18.50, 'Salmon fillet grilled to order with roasted potatoes.',
   '{gluten-free}'::text[], '{fish}'::text[],
   '[]'::jsonb,
   true, ''),
  ('mi_5',  'cat_mains',    'Pasta Carbonara',     13.50, 'Pasta with egg, cream, parmesan and black pepper.',
   '{}'::text[], '{gluten,egg,dairy}'::text[],
   '[]'::jsonb,
   true, ''),
  ('mi_6',  'cat_desserts', 'Tiramisu',             7.50, 'Espresso-soaked sponge with mascarpone cream.',
   '{vegetarian}'::text[], '{gluten,dairy,egg}'::text[],
   '[]'::jsonb,
   true, ''),
  ('mi_7',  'cat_desserts', 'Chocolate Lava Cake',  8.00, 'Warm dark chocolate cake with a molten centre.',
   '{vegetarian}'::text[], '{gluten,dairy,egg}'::text[],
   '[]'::jsonb,
   true, ''),
  ('mi_8',  'cat_drinks',   'Fresh Lemonade',       4.50, 'Fresh-squeezed orange juice, lightly sweetened.',
   '{vegan,gluten-free}'::text[], '{}'::text[],
   '[]'::jsonb,
   true, ''),
  ('mi_9',  'cat_drinks',   'Espresso',             3.50, 'Single-shot espresso.',
   '{vegan,gluten-free}'::text[], '{}'::text[],
   '[]'::jsonb,
   true, ''),
  ('mi_10', 'cat_starters', 'Bruschetta',           7.00, 'Toasted bread with tomato, basil and olive oil.',
   '{vegan}'::text[], '{gluten}'::text[],
   '[]'::jsonb,
   true, ''),
  ('mi_11', 'cat_mains',    'Fish and Chips',      15.00, 'Beer-battered fish with a portion of chips.',
   '{}'::text[], '{fish,gluten}'::text[],
   '[]'::jsonb,
   true, ''),
  ('mi_12', 'cat_starters', 'Garden Soup',          6.50, 'Seasonal vegetable soup with potato and herbs.',
   '{vegan,gluten-free}'::text[], '{}'::text[],
   '[]'::jsonb,
   true, '')
) AS v(ext_id, cat_ext_id, name, price, description,
        dietary_tags, allergens, modifiers, available, out_of_stock_reason)
JOIN cat ON cat.ext_id = v.cat_ext_id
WHERE true
ON CONFLICT DO NOTHING;


-- -------------------------------------------------------------- recipe_lines
-- Ingredient quantities per menu item, in the unit of the inventory item.
-- Garden Soup has no carrot in stock, so its carrot line (100 g) is folded into
-- the potato line: 150 g + 100 g = 250 g of potato.
WITH recipe (menu_ext_id, inv_ext_id, qty) AS (
  VALUES
    ('mi_1',  'inv_flour',       300.00),
    ('mi_1',  'inv_tomato',      150.00),
    ('mi_1',  'inv_mozzarella',  200.00),
    ('mi_1',  'inv_basil',        10.00),
    ('mi_2',  'inv_lettuce',     200.00),
    ('mi_2',  'inv_parmesan',     30.00),
    ('mi_2',  'inv_chicken',     150.00),
    ('mi_2',  'inv_butter',       20.00),
    ('mi_3',  'inv_beef',        200.00),
    ('mi_3',  'inv_flour',       100.00),
    ('mi_3',  'inv_potato',      150.00),
    ('mi_4',  'inv_salmon',      250.00),
    ('mi_4',  'inv_potato',      200.00),
    ('mi_4',  'inv_butter',       30.00),
    ('mi_5',  'inv_pasta',       200.00),
    ('mi_5',  'inv_butter',       40.00),
    ('mi_5',  'inv_cream',       100.00),
    ('mi_5',  'inv_parmesan',     40.00),
    ('mi_6',  'inv_coffee',       50.00),
    ('mi_6',  'inv_cream',       100.00),
    ('mi_6',  'inv_sugar',        40.00),
    ('mi_6',  'inv_chocolate',    30.00),
    ('mi_7',  'inv_chocolate',    80.00),
    ('mi_7',  'inv_butter',       60.00),
    ('mi_7',  'inv_sugar',        50.00),
    ('mi_7',  'inv_flour',        40.00),
    ('mi_8',  'inv_sugar',        30.00),
    ('mi_8',  'inv_orange_juice', 200.00),
    ('mi_9',  'inv_coffee',       18.00),
    ('mi_10', 'inv_flour',        80.00),
    ('mi_10', 'inv_tomato',      100.00),
    ('mi_10', 'inv_basil',         5.00),
    ('mi_11', 'inv_salmon',      180.00),
    ('mi_11', 'inv_potato',      300.00),
    ('mi_11', 'inv_flour',       100.00),
    ('mi_12', 'inv_potato',      250.00),
    ('mi_12', 'inv_butter',       20.00)
),
mi AS (
  SELECT id, ext_id FROM menu_items
),
inv AS (
  SELECT id, ext_id FROM inventory_items
)
INSERT INTO recipe_lines (menu_item_id, inventory_id, qty)
SELECT mi.id, inv.id, r.qty
FROM recipe r
JOIN mi  ON mi.ext_id  = r.menu_ext_id
JOIN inv ON inv.ext_id = r.inv_ext_id
WHERE true
ON CONFLICT DO NOTHING;


-- -------------------------------------------------------------------- tables
INSERT INTO tables (ext_id, "number", seats, zone, status, waiter_id, held)
VALUES
  ('tab_1', 1, 2, 'Window',    'free', NULL, false),
  ('tab_2', 2, 2, 'Window',    'free', NULL, false),
  ('tab_3', 3, 4, 'Main hall', 'free', NULL, false),
  ('tab_4', 4, 4, 'Main hall', 'free', NULL, false),
  ('tab_5', 5, 6, 'Main hall', 'free', NULL, false),
  ('tab_6', 6, 4, 'Terrace',   'free', NULL, false),
  ('tab_7', 7, 2, 'Terrace',   'free', NULL, false),
  ('tab_8', 8, 8, 'Terrace',   'free', NULL, false)
ON CONFLICT DO NOTHING;


-- ----------------------------------------------------------------- customers
-- Chris is the registered guest used by the sample orders and reservations.
INSERT INTO customers (ext_id, user_id, name, email, phone, type, loyalty_points, notes, created_at)
VALUES (
  'cus_chris',
  (SELECT id FROM users WHERE ext_id = 'usr_customer'),
  'Customer Chris', 'customer@rest.test', '+92 300 7777777', 'online', 45, '', now() - INTERVAL '60 days'
)
ON CONFLICT DO NOTHING;

INSERT INTO customer_preferences (customer_id, kind, value)
VALUES
  ((SELECT id FROM customers WHERE ext_id = 'cus_chris'), 'dietary', 'vegetarian'),
  ((SELECT id FROM customers WHERE ext_id = 'cus_chris'), 'allergy', 'peanuts')
ON CONFLICT DO NOTHING;


-- ------------------------------------------------------------------ settings
-- Single-row table: id is always 1.
INSERT INTO settings (
  id, restaurant_name, address, tax_rate, service_charge_rate, point_value,
  kitchen_delay_minutes, reservation_duration_minutes, reservation_grace_minutes,
  opening_hour, closing_hour, late_grace_minutes, late_penalty,
  auto_break_minutes, auto_break_after_hours
)
VALUES (
  1, 'Plate & Flame', '12 Ember Lane, Old Town', 0.10, 0.05, 0.10,
  15, 90, 15,
  12, 22, 5, 5,
  60, 6
)
ON CONFLICT DO NOTHING;


-- ----------------------------------------------------------------- sequences
INSERT INTO sequences (name, last_value)
VALUES
  ('order_seq', 1000),
  ('po_seq',    0)
ON CONFLICT DO NOTHING;


-- -------------------------------------------------------------------- orders
-- Order 1001 — dine-in, table 3, served and paid by card.
-- Subtotal 17.00 + 5% service + 10% tax = 19.55, so 19 loyalty points.
WITH tbl AS (
  SELECT id FROM tables WHERE ext_id = 'tab_3'
),
cus AS (
  SELECT id FROM customers WHERE ext_id = 'cus_chris'
),
wtr AS (
  SELECT id FROM users WHERE ext_id = 'usr_waiter'
)
INSERT INTO orders (
  ext_id, "number", type, fulfillment, table_id, customer_id, waiter_id, created_by,
  source, status, payment_status, payment_method, priority,
  tax_rate, service_charge_rate, discount, tip, points_used, points_earned,
  notes, delivery_address, created_at
)
VALUES (
  'ord_1001', 1001, 'dine-in', 'dine-in',
  (SELECT id FROM tbl), (SELECT id FROM cus), (SELECT id FROM wtr), (SELECT id FROM wtr),
  'staff', 'served', 'paid', 'card', 'normal',
  0.10, 0.05, 0, 0, 0, 19,
  '', '', now() - INTERVAL '2 hours'
)
ON CONFLICT DO NOTHING;

-- Order 1002 — online pickup placed by Chris, not paid yet.
-- Pickup orders carry no service charge.
WITH cus AS (
  SELECT id FROM customers WHERE ext_id = 'cus_chris'
),
usr AS (
  SELECT id FROM users WHERE ext_id = 'usr_customer'
)
INSERT INTO orders (
  ext_id, "number", type, fulfillment, table_id, customer_id, waiter_id, created_by,
  source, status, payment_status, payment_method, priority,
  tax_rate, service_charge_rate, discount, tip, points_used, points_earned,
  notes, delivery_address, created_at
)
VALUES (
  'ord_1002', 1002, 'online', 'pickup',
  NULL, (SELECT id FROM cus), NULL, (SELECT id FROM usr),
  'customer', 'placed', 'unpaid', NULL, 'normal',
  0.10, 0.00, 0, 0, 0, 0,
  '', '', now() - INTERVAL '45 minutes'
)
ON CONFLICT DO NOTHING;

-- Order 1003 — dine-in at table 5, still in the kitchen.
WITH tbl AS (
  SELECT id FROM tables WHERE ext_id = 'tab_5'
),
wtr AS (
  SELECT id FROM users WHERE ext_id = 'usr_waiter2'
)
INSERT INTO orders (
  ext_id, "number", type, fulfillment, table_id, customer_id, waiter_id, created_by,
  source, status, payment_status, payment_method, priority,
  tax_rate, service_charge_rate, discount, tip, points_used, points_earned,
  notes, delivery_address, created_at
)
VALUES (
  'ord_1003', 1003, 'dine-in', 'dine-in',
  (SELECT id FROM tbl), NULL, (SELECT id FROM wtr), (SELECT id FROM wtr),
  'staff', 'preparing', 'unpaid', NULL, 'normal',
  0.10, 0.05, 0, 0, 0, 0,
  '', '', now() - INTERVAL '15 minutes'
)
ON CONFLICT DO NOTHING;


-- ---------------------------------------------------------------- order_items
WITH ord AS (
  SELECT id FROM orders WHERE ext_id = 'ord_1001'
),
mi AS (
  SELECT id, ext_id, name FROM menu_items WHERE ext_id IN ('mi_1', 'mi_8')
)
INSERT INTO order_items (
  ext_id, order_id, menu_item_id, name, qty, base_price, modifiers, unit_price, status
)
SELECT
  v.ext_id, (SELECT id FROM ord), mi.id, mi.name,
  v.qty, v.base_price, v.modifiers, v.unit_price, 'served'
FROM (VALUES
  ('oi_1001_1', 'mi_1', 1, 12.50, '[]'::jsonb, 12.50),
  ('oi_1001_2', 'mi_8', 1,  4.50, '[]'::jsonb,  4.50)
) AS v(ext_id, menu_ext_id, qty, base_price, modifiers, unit_price)
JOIN mi ON mi.ext_id = v.menu_ext_id
WHERE true
ON CONFLICT DO NOTHING;

WITH ord AS (
  SELECT id FROM orders WHERE ext_id = 'ord_1002'
),
mi AS (
  SELECT id, ext_id, name FROM menu_items WHERE ext_id IN ('mi_3', 'mi_9')
)
INSERT INTO order_items (
  ext_id, order_id, menu_item_id, name, qty, base_price, modifiers, unit_price, status
)
SELECT
  v.ext_id, (SELECT id FROM ord), mi.id, mi.name,
  v.qty, v.base_price, v.modifiers, v.unit_price, 'pending'
FROM (VALUES
  ('oi_1002_1', 'mi_3', 1, 14.00, '[]'::jsonb, 14.00),
  ('oi_1002_2', 'mi_9', 1,  3.50, '[]'::jsonb,  3.50)
) AS v(ext_id, menu_ext_id, qty, base_price, modifiers, unit_price)
JOIN mi ON mi.ext_id = v.menu_ext_id
WHERE true
ON CONFLICT DO NOTHING;

WITH ord AS (
  SELECT id FROM orders WHERE ext_id = 'ord_1003'
),
mi AS (
  SELECT id, ext_id, name FROM menu_items WHERE ext_id IN ('mi_5', 'mi_6')
)
INSERT INTO order_items (
  ext_id, order_id, menu_item_id, name, qty, base_price, modifiers, unit_price, status
)
SELECT
  v.ext_id, (SELECT id FROM ord), mi.id, mi.name,
  v.qty, v.base_price, v.modifiers, v.unit_price, 'preparing'
FROM (VALUES
  ('oi_1003_1', 'mi_5', 2, 13.50, '[]'::jsonb, 13.50),
  ('oi_1003_2', 'mi_6', 1,  7.50, '[]'::jsonb,  7.50)
) AS v(ext_id, menu_ext_id, qty, base_price, modifiers, unit_price)
JOIN mi ON mi.ext_id = v.menu_ext_id
WHERE true
ON CONFLICT DO NOTHING;


-- --------------------------------------------------------------- reservations
-- Chris, four people, tomorrow at 19:00, confirmed on table 3.
WITH tbl AS (
  SELECT id FROM tables WHERE ext_id = 'tab_3'
),
cus AS (
  SELECT id FROM customers WHERE ext_id = 'cus_chris'
)
INSERT INTO reservations (
  ext_id, customer_name, email, phone, party_size, "date", "time",
  table_id, status, special_requests, customer_id, created_at
)
VALUES (
  'res_1001', 'Customer Chris', 'customer@rest.test', '+92 300 7777777', 4,
  CURRENT_DATE + 1, '19:00',
  (SELECT id FROM tbl), 'confirmed', 'Window seat if possible', (SELECT id FROM cus), now()
)
ON CONFLICT DO NOTHING;

-- Walk-in guest, two people, tomorrow at 20:00, requested on table 1.
-- A walk-in gives no contact details, so email and phone are empty strings —
-- both columns are NOT NULL.
WITH tbl AS (
  SELECT id FROM tables WHERE ext_id = 'tab_1'
)
INSERT INTO reservations (
  ext_id, customer_name, email, phone, party_size, "date", "time",
  table_id, status, special_requests, customer_id, created_at
)
VALUES (
  'res_1002', 'Sarah Khan', '', '', 2,
  CURRENT_DATE + 1, '20:00',
  (SELECT id FROM tbl), 'requested', '', NULL, now()
)
ON CONFLICT DO NOTHING;


-- Seed complete
