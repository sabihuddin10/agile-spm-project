-- Plate & Flame — relational schema
-- Generated: 2026-10-21
--
-- Purpose
--   Relational replacement for the in-memory store that used to be persisted as
--   a single gzip-compressed JSON blob (`app_state.data`). This file creates the
--   full schema: enums, tables, constraints and indexes, in dependency order.
--
-- Conventions
--   * Primary keys are `bigint GENERATED ALWAYS AS IDENTITY`. The application
--     layer maps its public string identifiers onto the `ext_id` column, which
--     carries a UNIQUE index so legacy ids (`usr_admin`, `ord_1233`, …) keep
--     working. `ext_id` is NULL for rows the application creates itself.
--   * Money is `numeric(12,2)` (never float). Rates and point values are
--     `numeric(6,4)`. Stock quantities are `numeric(12,3)`.
--   * Event timestamps (`created_at`, `paid_at`, `clock_in`, …) are `timestamptz`
--     and always stored in UTC.
--   * Wall-clock entities (a reservation at 19:30, a shift from 17:00 to 23:00)
--     use plain `date` + `time` columns: they describe the restaurant's local
--     clock, not an instant in time, and must never be shifted by a timezone.
--   * Every statement is idempotent: `CREATE TABLE IF NOT EXISTS`,
--     `CREATE INDEX IF NOT EXISTS`, and enum types are created inside a
--     `DO $$ … EXCEPTION WHEN duplicate_object … $$` block, so the file can be
--     re-applied to an existing database without error.
--   * `start` and `end` are quoted because they are reserved SQL keywords.
--
-- Apply with:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f server/schema/001_schema.sql

BEGIN;

-- =============================================================================
-- Enum types
-- =============================================================================

-- Who a user is. `customer` is the only role that never receives a wage.
DO $$
BEGIN
  CREATE TYPE role AS ENUM ('customer', 'waiter', 'chef', 'manager', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Where an order originates: at a table, or through the online channel.
DO $$
BEGIN
  CREATE TYPE order_type AS ENUM ('dine-in', 'online');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- How the customer receives the order.
DO $$
BEGIN
  CREATE TYPE fulfillment_method AS ENUM ('dine-in', 'pickup', 'delivery');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- How an order was paid for. `split` covers a bill split between payers.
DO $$
BEGIN
  CREATE TYPE payment_method AS ENUM ('card', 'cash', 'split');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Payment state of an order, tracked separately from the order lifecycle.
DO $$
BEGIN
  CREATE TYPE payment_status AS ENUM ('unpaid', 'paid', 'refunded');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Order lifecycle: placed → confirmed → preparing → ready → served → closed
-- (or cancelled at any point).
DO $$
BEGIN
  CREATE TYPE order_status AS ENUM (
    'placed', 'confirmed', 'preparing', 'ready', 'served', 'closed', 'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Line-level lifecycle, mirroring the order lifecycle.
DO $$
BEGIN
  CREATE TYPE item_status AS ENUM ('pending', 'queued', 'preparing', 'ready', 'served');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Floor-plan state of a dining table.
DO $$
BEGIN
  CREATE TYPE table_status AS ENUM ('free', 'occupied', 'reserved', 'cleaning');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Booking lifecycle.
DO $$
BEGIN
  CREATE TYPE reservation_status AS ENUM (
    'requested', 'confirmed', 'seated', 'cancelled', 'no_show'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Scheduled shift lifecycle.
DO $$
BEGIN
  CREATE TYPE shift_status AS ENUM ('scheduled', 'completed', 'missed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Why a stock movement happened.
DO $$
BEGIN
  CREATE TYPE movement_reason AS ENUM ('sale', 'restock', 'wastage', 'count');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Purchase order lifecycle.
DO $$
BEGIN
  CREATE TYPE po_status AS ENUM ('sent', 'received');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Delivery channel of a notification.
DO $$
BEGIN
  CREATE TYPE notification_channel AS ENUM ('in-app', 'email');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Staff job application lifecycle.
DO $$
BEGIN
  CREATE TYPE application_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Roles a job applicant may apply for.
DO $$
BEGIN
  CREATE TYPE application_desired_role AS ENUM ('waiter', 'chef');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- How a customer record was created.
DO $$
BEGIN
  CREATE TYPE customer_type AS ENUM ('walk-in', 'online');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Kitchen priority of an order.
DO $$
BEGIN
  CREATE TYPE order_priority AS ENUM ('normal', 'rush');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Who placed the order: a guest through the online channel, or staff.
DO $$
BEGIN
  CREATE TYPE order_source AS ENUM ('customer', 'staff');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Whether a modifier group allows one or many selections.
DO $$
BEGIN
  CREATE TYPE modifier_type AS ENUM ('single', 'multi');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- How a bill was split between payers.
DO $$
BEGIN
  CREATE TYPE split_mode AS ENUM ('even', 'items');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- How an individual share of a split bill was settled.
DO $$
BEGIN
  CREATE TYPE split_payment_method AS ENUM ('card', 'cash');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- NOTE: notification `type` is intentionally free-form `text` — new event types
-- (low_stock, item_ready, order_placed, order_ready, reservation_confirmed,
-- reservation_requested, application, shift, …) are added without a migration.

-- =============================================================================
-- Identity & accounts
-- =============================================================================

-- Platform users: staff (waiter/chef/manager/admin) and guests (customer).
-- `password_hash` holds a bcrypt digest; `token_version` invalidates every
-- issued token when incremented (password change, deactivation).
CREATE TABLE IF NOT EXISTS users (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ext_id               text,
  name                 text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  email                text NOT NULL,                        -- stored lowercased
  phone                text NOT NULL DEFAULT '',
  role                 role NOT NULL,
  active               boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT false,
  password_hash        text NOT NULL,
  token_version        integer NOT NULL DEFAULT 0,
  hourly_wage          numeric(8,2),                         -- staff only, NULL for customers
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_ext_id ON users (ext_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower ON users (lower(email));

-- Customers are the people who dine. A customer may (optionally) be linked to a
-- login account. `preferences` live in their own table; `loyalty_points` is the
-- denormalised running balance, `loyalty_ledger` is its audit trail.
CREATE TABLE IF NOT EXISTS customers (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ext_id         text,
  user_id        bigint UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  name           text NOT NULL,
  email          text NOT NULL DEFAULT '',
  phone          text NOT NULL DEFAULT '',
  type           customer_type NOT NULL DEFAULT 'walk-in',
  loyalty_points integer NOT NULL DEFAULT 0 CHECK (loyalty_points >= 0),
  notes          text NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_ext_id ON customers (ext_id);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (name);
CREATE INDEX IF NOT EXISTS idx_customers_type ON customers (type);

-- Dietary requirements and allergies. One row per (customer, kind, value).
CREATE TABLE IF NOT EXISTS customer_preferences (
  customer_id bigint NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('dietary', 'allergy')),
  value       text NOT NULL,
  PRIMARY KEY (customer_id, kind, value)
);

-- =============================================================================
-- Menu
-- =============================================================================

CREATE TABLE IF NOT EXISTS menu_categories (
  id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ext_id  text,
  name    text NOT NULL,
  sort    integer NOT NULL DEFAULT 0,
  active  boolean NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_menu_categories_ext_id ON menu_categories (ext_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_menu_categories_name_lower ON menu_categories (lower(name));
CREATE INDEX IF NOT EXISTS idx_menu_categories_active_sort ON menu_categories (active, sort);

-- `modifiers` holds the modifier groups of an item:
--   [{ id, name, type: modifier_type, options: [{ label, priceDelta }] }]
CREATE TABLE IF NOT EXISTS menu_items (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ext_id              text,
  category_id         bigint NOT NULL REFERENCES menu_categories(id),
  name                text NOT NULL,
  price               numeric(12,2) NOT NULL CHECK (price >= 0),
  description         text NOT NULL DEFAULT '',
  dietary_tags        text[] NOT NULL DEFAULT '{}',
  allergens           text[] NOT NULL DEFAULT '{}',
  modifiers           jsonb NOT NULL DEFAULT '[]',
  available           boolean NOT NULL DEFAULT true,
  out_of_stock_reason text NOT NULL DEFAULT '',
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_menu_items_ext_id ON menu_items (ext_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items (category_id);

-- =============================================================================
-- Inventory
-- =============================================================================

CREATE TABLE IF NOT EXISTS inventory_items (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ext_id        text,
  name          text NOT NULL,
  category      text NOT NULL DEFAULT 'Dry Goods',
  stock         numeric(12,3) NOT NULL DEFAULT 0 CHECK (stock >= 0),
  unit          text NOT NULL CHECK (unit IN ('g', 'kg', 'L', 'ml', 'units', 'dozen', 'boxes')),
  reorder_level numeric(12,3) NOT NULL DEFAULT 0,
  cost_per_unit numeric(12,2) NOT NULL DEFAULT 0,
  supplier      text NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_items_ext_id ON inventory_items (ext_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_items_name_lower ON inventory_items (lower(name));
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items (category);

-- Recipe: how much of each ingredient one portion of a menu item consumes.
CREATE TABLE IF NOT EXISTS recipe_lines (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  menu_item_id bigint NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  inventory_id bigint NOT NULL REFERENCES inventory_items(id),
  qty          numeric(12,3) NOT NULL CHECK (qty > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_recipe_lines_item_inventory
  ON recipe_lines (menu_item_id, inventory_id);
CREATE INDEX IF NOT EXISTS idx_recipe_lines_inventory ON recipe_lines (inventory_id);

-- =============================================================================
-- Floor plan
-- =============================================================================

-- `reserved_for` points at the reservation holding the table; the foreign key
-- is added at the end of the file because reservations reference tables back.
CREATE TABLE IF NOT EXISTS tables (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ext_id       text,
  number       integer NOT NULL UNIQUE CHECK (number BETWEEN 1 AND 9999),
  seats        integer NOT NULL CHECK (seats BETWEEN 1 AND 20),
  zone         text NOT NULL DEFAULT 'Main hall',
  status       table_status NOT NULL DEFAULT 'free',
  waiter_id    bigint REFERENCES users(id) ON DELETE SET NULL,
  held         boolean NOT NULL DEFAULT false,
  reserved_for bigint
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tables_ext_id ON tables (ext_id);
CREATE INDEX IF NOT EXISTS idx_tables_zone ON tables (zone);
CREATE INDEX IF NOT EXISTS idx_tables_status ON tables (status);
CREATE INDEX IF NOT EXISTS idx_tables_waiter ON tables (waiter_id);

-- =============================================================================
-- Orders
-- =============================================================================

-- An order. `number` is the human-facing number shown on the receipt and on
-- the kitchen display (starts at 1001); `kitchen_rank` is the millisecond epoch
-- used to order the KDS queue (rush orders are sorted first by `priority`).
-- `tax_rate` and `service_charge_rate` are snapshots of the settings at the
-- time the order was created, so later settings changes never rewrite history.
CREATE TABLE IF NOT EXISTS orders (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ext_id              text,
  number              integer NOT NULL UNIQUE,
  type                order_type NOT NULL,
  fulfillment         fulfillment_method NOT NULL,
  table_id            bigint REFERENCES tables(id) ON DELETE SET NULL,
  customer_id         bigint REFERENCES customers(id) ON DELETE SET NULL,
  waiter_id           bigint REFERENCES users(id) ON DELETE SET NULL,
  created_by          bigint REFERENCES users(id) ON DELETE SET NULL,
  source              order_source NOT NULL DEFAULT 'staff',
  status              order_status NOT NULL DEFAULT 'placed',
  payment_status      payment_status NOT NULL DEFAULT 'unpaid',
  payment_method      payment_method,
  priority            order_priority NOT NULL DEFAULT 'normal',
  kitchen_rank        double precision,
  tax_rate            numeric(6,4) NOT NULL DEFAULT 0.1,
  service_charge_rate numeric(6,4) NOT NULL DEFAULT 0.05,
  discount            numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tip                 numeric(12,2) NOT NULL DEFAULT 0 CHECK (tip >= 0),
  points_used         integer NOT NULL DEFAULT 0 CHECK (points_used >= 0),
  points_earned       integer NOT NULL DEFAULT 0 CHECK (points_earned >= 0),
  notes               text NOT NULL DEFAULT '',
  delivery_address    text NOT NULL DEFAULT '',
  stock_deducted      boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  confirmed_at        timestamptz,
  ready_at            timestamptz,
  served_at           timestamptz,
  served_by           bigint REFERENCES users(id) ON DELETE SET NULL,
  paid_at             timestamptz,
  closed_at           timestamptz,
  cancelled_at        timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_ext_id ON orders (ext_id);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_created ON orders (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_table_status ON orders (table_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_type ON orders (type);
CREATE INDEX IF NOT EXISTS idx_orders_payment ON orders (payment_status, paid_at);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_waiter ON orders (waiter_id);
CREATE INDEX IF NOT EXISTS idx_orders_served_by ON orders (served_by);
-- Kitchen queue: only open orders are in the KDS index.
CREATE INDEX IF NOT EXISTS idx_orders_kitchen
  ON orders (priority, kitchen_rank)
  WHERE status IN ('confirmed', 'preparing', 'ready');

-- Order lines. `name`, `base_price` and `modifiers` are snapshots taken when
-- the line was added; `unit_price` = base_price + sum(modifier price deltas).
CREATE TABLE IF NOT EXISTS order_items (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ext_id       text,
  order_id     bigint NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id bigint NOT NULL REFERENCES menu_items(id),
  name         text NOT NULL,
  qty          integer NOT NULL CHECK (qty BETWEEN 1 AND 99),
  base_price   numeric(12,2) NOT NULL CHECK (base_price >= 0),
  modifiers    jsonb NOT NULL DEFAULT '[]',                -- [{ group, label, priceDelta }]
  unit_price   numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  status       item_status NOT NULL DEFAULT 'pending',
  prepared_by  bigint REFERENCES users(id) ON DELETE SET NULL,
  ready_at     timestamptz,
  served_at    timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_order_items_ext_id ON order_items (ext_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_prepared_by ON order_items (prepared_by);
CREATE INDEX IF NOT EXISTS idx_order_items_status ON order_items (status);

-- A refund is recorded once per order (the UNIQUE constraint enforces it).
CREATE TABLE IF NOT EXISTS order_refunds (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id   bigint NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  amount     numeric(12,2) NOT NULL CHECK (amount > 0),
  reason     text NOT NULL DEFAULT '',
  by_user_id bigint REFERENCES users(id) ON DELETE SET NULL,
  at         timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- Stock movements & purchasing
-- =============================================================================

-- Stock movements are an immutable log. `name`, `unit` and `order_number` are
-- denormalised snapshots so the log stays readable after the source row
-- changed or was deleted.
CREATE TABLE IF NOT EXISTS stock_movements (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ext_id       text,
  inventory_id bigint NOT NULL REFERENCES inventory_items(id),
  name         text NOT NULL,
  unit         text NOT NULL,
  delta        numeric(12,3) NOT NULL,
  stock_after  numeric(12,3) NOT NULL,
  reason       movement_reason NOT NULL,
  order_id     bigint REFERENCES orders(id) ON DELETE SET NULL,
  order_number integer,
  user_id      bigint REFERENCES users(id) ON DELETE SET NULL,
  at           timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_movements_ext_id ON stock_movements (ext_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_inventory_at
  ON stock_movements (inventory_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_at ON stock_movements (at DESC);

-- Purchase orders (supplier reorder forms) and their lines.
CREATE TABLE IF NOT EXISTS purchase_orders (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ext_id      text,
  number      integer NOT NULL UNIQUE,
  status      po_status NOT NULL DEFAULT 'sent',
  total       numeric(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  notes       text NOT NULL DEFAULT '',
  created_by  bigint REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_purchase_orders_ext_id ON purchase_orders (ext_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders (status);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  purchase_order_id bigint NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  inventory_id      bigint NOT NULL REFERENCES inventory_items(id),
  name              text NOT NULL,                           -- denormalised snapshot
  unit              text NOT NULL,                           -- denormalised snapshot
  qty               numeric(12,3) NOT NULL CHECK (qty > 0),
  cost_per_unit     numeric(12,2) NOT NULL DEFAULT 0,
  cost              numeric(12,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_purchase_order_lines_order
  ON purchase_order_lines (purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_lines_inventory
  ON purchase_order_lines (inventory_id);

-- =============================================================================
-- Loyalty
-- =============================================================================

-- Append-only audit trail of loyalty point movements.
-- `reason` is one of: earned, redeemed, reversed, refunded.
CREATE TABLE IF NOT EXISTS loyalty_ledger (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id bigint NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  delta       integer NOT NULL,
  reason      text NOT NULL,
  order_id    bigint REFERENCES orders(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_customer_created
  ON loyalty_ledger (customer_id, created_at);

-- =============================================================================
-- Bill splitting
-- =============================================================================

-- One split per order: `even` shares the total equally, `items` shares it in
-- proportion to the items assigned to each part.
CREATE TABLE IF NOT EXISTS bill_splits (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id   bigint NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  mode       split_mode NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS split_parts (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  split_id bigint NOT NULL REFERENCES bill_splits(id) ON DELETE CASCADE,
  part_no  integer NOT NULL,                                -- stable index for the API
  label    text NOT NULL,
  amount   numeric(12,2) NOT NULL CHECK (amount >= 0),
  paid     boolean NOT NULL DEFAULT false,
  method   split_payment_method,
  paid_at  timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_split_parts_split_no ON split_parts (split_id, part_no);

-- Which items belong to which part of the split.
CREATE TABLE IF NOT EXISTS split_part_items (
  split_part_id bigint NOT NULL REFERENCES split_parts(id) ON DELETE CASCADE,
  order_item_id bigint NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  PRIMARY KEY (split_part_id, order_item_id)
);

-- =============================================================================
-- Reservations
-- =============================================================================

-- `date` + `time` are the restaurant's local wall clock (never timestamptz):
-- a booking at 19:30 stays at 19:30 whatever the server timezone is.
CREATE TABLE IF NOT EXISTS reservations (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ext_id           text,
  customer_name    text NOT NULL,                           -- denormalised snapshot
  email            text NOT NULL,
  phone            text NOT NULL DEFAULT '',
  party_size       integer NOT NULL CHECK (party_size BETWEEN 1 AND 12),
  date             date NOT NULL,
  time             time NOT NULL,
  table_id         bigint REFERENCES tables(id) ON DELETE SET NULL,
  status           reservation_status NOT NULL DEFAULT 'requested',
  special_requests text NOT NULL DEFAULT '',
  customer_id      bigint REFERENCES customers(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  confirmed_at     timestamptz,
  seated_at        timestamptz,
  cancelled_at     timestamptz,
  notified_at      timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_reservations_ext_id ON reservations (ext_id);
CREATE INDEX IF NOT EXISTS idx_reservations_date_time ON reservations (date, time);
CREATE INDEX IF NOT EXISTS idx_reservations_table_date ON reservations (table_id, date);
CREATE INDEX IF NOT EXISTS idx_reservations_customer ON reservations (customer_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations (status);

-- =============================================================================
-- Notifications
-- =============================================================================

-- A notification targets either one user (`user_id`) or every holder of a role
-- (`role`). `channel = 'email'` rows are a log of mails sent to guests.
CREATE TABLE IF NOT EXISTS notifications (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ext_id         text,
  user_id        bigint REFERENCES users(id) ON DELETE CASCADE,
  role           role,
  channel        notification_channel NOT NULL DEFAULT 'in-app',
  to_email       text,
  type           text NOT NULL,                             -- free-form: low_stock, item_ready, …
  title          text NOT NULL,
  message        text NOT NULL,
  link           text,
  order_id       bigint REFERENCES orders(id) ON DELETE SET NULL,
  reservation_id bigint REFERENCES reservations(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_ext_id ON notifications (ext_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_role ON notifications (role);

-- Read receipts.
CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id bigint NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id         bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);

-- =============================================================================
-- Workforce
-- =============================================================================

-- Job applications. On approval `user_id` points at the created account.
CREATE TABLE IF NOT EXISTS staff_applications (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ext_id       text,
  name         text NOT NULL,
  email        text NOT NULL,
  phone        text NOT NULL DEFAULT '',
  desired_role application_desired_role NOT NULL,
  experience   text NOT NULL DEFAULT '',
  status       application_status NOT NULL DEFAULT 'pending',
  created_at   timestamptz NOT NULL DEFAULT now(),
  decided_at   timestamptz,
  decided_by   bigint REFERENCES users(id) ON DELETE SET NULL,
  user_id      bigint REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_applications_ext_id ON staff_applications (ext_id);
CREATE INDEX IF NOT EXISTS idx_staff_applications_status_created
  ON staff_applications (status, created_at DESC);

-- Scheduled shifts. `date` + `start`/`end` are local wall-clock values.
CREATE TABLE IF NOT EXISTS shifts (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ext_id     text,
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       date NOT NULL,
  "start"    time NOT NULL,                                -- quoted: START/END are SQL keywords
  "end"      time NOT NULL,
  notes      text NOT NULL DEFAULT '',
  status     shift_status NOT NULL DEFAULT 'scheduled',
  created_by bigint REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ("end" > "start")
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_shifts_ext_id ON shifts (ext_id);
CREATE INDEX IF NOT EXISTS idx_shifts_user_date ON shifts (user_id, date);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts (date);

-- Attendance sessions: one per clock-in. `date` is the local date the session
-- started on; `clock_in`/`clock_out` are real instants.
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ext_id       text,
  user_id      bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date         date NOT NULL,
  clock_in     timestamptz NOT NULL,
  clock_out    timestamptz,
  shift_id     bigint REFERENCES shifts(id) ON DELETE SET NULL,
  late         boolean NOT NULL DEFAULT false,
  late_minutes integer NOT NULL DEFAULT 0 CHECK (late_minutes >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_sessions_ext_id ON attendance_sessions (ext_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_user_date
  ON attendance_sessions (user_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_user_clock_in
  ON attendance_sessions (user_id, clock_in DESC);
-- Open sessions (clocked in, not clocked out) — used by the "who is on shift" view.
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_open
  ON attendance_sessions (user_id)
  WHERE clock_out IS NULL;

-- Breaks taken inside an attendance session. An open break has no `end`.
CREATE TABLE IF NOT EXISTS attendance_breaks (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  "start"    timestamptz NOT NULL,                          -- quoted: START/END are SQL keywords
  "end"      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_attendance_breaks_session ON attendance_breaks (session_id);

-- Bonuses and deductions applied to a pay period.
CREATE TABLE IF NOT EXISTS pay_adjustments (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ext_id     text,
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount     numeric(12,2) NOT NULL CHECK (amount != 0),
  reason     text NOT NULL,
  date       date NOT NULL,
  created_by bigint REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pay_adjustments_ext_id ON pay_adjustments (ext_id);
CREATE INDEX IF NOT EXISTS idx_pay_adjustments_user_date ON pay_adjustments (user_id, date);

-- =============================================================================
-- Settings
-- =============================================================================

-- Singleton row (id = 1) holding the restaurant policy.
CREATE TABLE IF NOT EXISTS settings (
  id                          smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  restaurant_name             text NOT NULL DEFAULT 'Plate & Flame',
  address                     text NOT NULL DEFAULT '12 Ember Lane, Old Town',
  tax_rate                    numeric(6,4) NOT NULL DEFAULT 0.1,
  service_charge_rate         numeric(6,4) NOT NULL DEFAULT 0.05,
  point_value                 numeric(6,4) NOT NULL DEFAULT 0.1,
  kitchen_delay_minutes       integer NOT NULL DEFAULT 15,
  reservation_duration_minutes integer NOT NULL DEFAULT 90,
  reservation_grace_minutes   integer NOT NULL DEFAULT 15,
  opening_hour                integer NOT NULL DEFAULT 12,
  closing_hour                integer NOT NULL DEFAULT 22,
  late_grace_minutes          integer NOT NULL DEFAULT 5,
  late_penalty                numeric(8,2) NOT NULL DEFAULT 5,
  auto_break_minutes          integer NOT NULL DEFAULT 60,
  auto_break_after_hours      integer NOT NULL DEFAULT 6
);

INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- Sequences (counter table)
-- =============================================================================

-- Named counters used to allocate human-facing numbers.
-- `order_seq` last_value 1000 means the next order number is 1001.
CREATE TABLE IF NOT EXISTS sequences (
  name       text PRIMARY KEY,
  last_value bigint NOT NULL DEFAULT 0
);

INSERT INTO sequences (name, last_value)
VALUES ('order_seq', 1000), ('po_seq', 0)
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- Deferred constraints (circular references)
-- =============================================================================

-- tables.reserved_for → reservations.id. Added last because reservations
-- already reference tables(table_id).
DO $$
BEGIN
  ALTER TABLE tables
    ADD CONSTRAINT fk_tables_reserved_for
    FOREIGN KEY (reserved_for) REFERENCES reservations(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
