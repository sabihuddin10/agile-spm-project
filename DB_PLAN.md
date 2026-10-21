# Database plan — relational PostgreSQL schema

**Status:** draft for `feat/relational-schema`
**Schema files:** `server/schema/001_schema.sql` (DDL), `server/schema/002_seed.sql` (demo data)
**Applies to:** the Express API in `server/`, running on local PostgreSQL in dev and Neon Postgres in production.

---

## 1. Overview

### The problem with the current storage

The API keeps all of its state in module-level arrays in `server/src/data/store.js`. When
`DATABASE_URL` is set, every request takes a row lock on `app_state`, reloads the whole store
if another instance saved a newer version, and writes the entire store back as one
gzip-compressed JSON blob (~90 KB) before responding.

That design is fine for a course demo and bad for anything else:

| Problem | Consequence |
|---|---|
| One row holds everything | Every write rewrites every row of data, even a single-character change to one order |
| No foreign keys | A deleted customer can leave orphan orders; nothing enforces that a table exists before it is used |
| No indexes | Every "top dishes this month" query has to load the entire dataset into Node and count there |
| Whole-store lock | Writers are serialised on one row — one slow request blocks every other request |
| No constraints | `price` can be negative, `qty` can be 99.5, `end` can be before `start` — the application is the only validator |
| Opaque to SQL | The database cannot answer a question on its own; every report is a full snapshot load |

### What we are moving to

A proper relational schema: **28 tables**, explicit foreign keys with `ON DELETE` behaviour,
`CHECK` constraints, enums for closed value sets, and **64 indexes** aimed at the queries the
product actually runs. The database becomes the query engine for analytics and inventory
instead of a dumb blob store.

The move is deliberately **not** a rewrite of the domain model. The route handlers, the
permission map and the money maths stay exactly as they are; only the layer underneath them
changes.

---

## 2. Architecture

```
                    ┌──────────────────────────────────────────────┐
                    │  Express API (server/src)                     │
                    │  routes → lib (order-math, payroll, …)        │
                    │  → data layer (reads/writes relational tables) │
                    └───────────────┬──────────────────────────────┘
                                    │  DATABASE_URL
              ┌─────────────────────┴─────────────────────┐
              │                                           │
   ┌──────────▼───────────┐                  ┌────────────▼─────────────┐
   │  Local dev           │                  │  Production              │
   │  PostgreSQL 17       │                  │  Neon Postgres (serverless)│
   │  localhost:5432      │                  │  Vercel API project      │
   │  `pg` driver (TCP)   │                  │  WebSocket 443, pooled   │
   │  db: agspm           │                  │  Neon pooled URL         │
   └──────────────────────┘                  └──────────────────────────┘
```

### One schema, two environments

- **`server/schema/001_schema.sql` is the single source of truth for the DDL.** It creates the
  enums, tables, constraints and indexes in dependency order, and every statement is
  idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, enum types created
  inside a `DO $$ … EXCEPTION WHEN duplicate_object … $$` block). Re-applying it to an
  existing database is safe and never destroys data.
- **`server/schema/002_seed.sql` loads the demo dataset** — the same content the in-memory
  store generates today: staff and customers, the menu and its recipes, the floor plan, 60
  days of closed order history, 90 days of shifts and attendance, tonight's bookings and
  this week's rota. Seed rows are generated **relative to the day the seed runs**, so the
  demo always has a live "today".
- **The same files run in both places.** Nothing in the DDL is local-specific: no
  `CREATE EXTENSION`, no server-specific types, no platform-dependent defaults.

### Driver selection

The driver is chosen from the host in `DATABASE_URL` (`server/src/data/db.js`):

| `DATABASE_URL` host | Driver | Transport |
|---|---|---|
| `*.neon.tech` | `@neondatabase/serverless` | WebSockets, port 443 |
| anything else | `pg` | TCP, port 5432 |

Both expose a pg-compatible `Pool`, so the data layer does not care which one it is talking
to. Neon's driver cannot speak to a plain PostgreSQL server, and the `pg` driver cannot use
Neon's pooled endpoint — hence the split.

---

## 3. Schema design decisions

### 3.1 IDs — `bigint` identity PKs plus a `text ext_id`

Every table uses `bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY`. The public string
identifiers the API has always used (`usr_admin`, `ord_1233`, `cus_4`, `inv_7`) live in a
separate nullable `text ext_id` column with a unique index.

```sql
CREATE TABLE IF NOT EXISTS users (
  id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ext_id text,
  ...
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_ext_id ON users (ext_id);
```

- **Why not `text` primary keys everywhere?** A text PK means every foreign key, every
  index entry and every join is a variable-length string comparison. `bigint` is fixed
  width, sorts numerically, and keeps indexes and tables small.
- **Why keep `ext_id` at all?** The API contract, the frontend and the seeded demo data all
  use string ids. `ext_id` means the URL payload of every route stays unchanged while the
  database underneath becomes properly relational.
- `ext_id` is `NULL` for rows the application creates itself (it allocates an id from the
  `sequences` counter or from a `bigint` identity), and is filled for rows that carry a
  legacy id from the old store.
- `CREATE UNIQUE INDEX` on a nullable column allows many `NULL`s, so rows without an
  `ext_id` never collide.

### 3.2 Money — `numeric(12,2)`, never a float

```sql
price    numeric(12,2) NOT NULL CHECK (price >= 0)
tax_rate numeric(6,4)  NOT NULL DEFAULT 0.1
```

- `double precision` cannot represent `0.1` exactly; summing 100 prices of `19.99` gives a
  number that is off by a fraction of a cent, and the error compounds with every split.
  `numeric` is exact decimal arithmetic, and `SUM()` over `numeric` is exact.
- The application computes money in **integer cents** (`server/src/lib/order-math.js`).
  `numeric(12,2)` is the storage equivalent of that model: two decimal places, no rounding
  surprises, and it survives a round trip through PostgreSQL unchanged.
- `numeric(12,2)` allows up to 9,999,999,999.99 — far beyond any single order, and wide
  enough that totals can never overflow.
- Rates and point values use `numeric(6,4)` (0.1000, 0.0500) so a 10% tax reads as `0.1`
  with its precision visible; stock quantities use `numeric(12,3)` because recipes need
  grams and millilitres (`0.125 kg` of flour).

### 3.3 Timestamps — `timestamptz` for events, `date` + `time` for wall clock

Two different kinds of time, stored two different ways:

| Kind | Examples | Column type | Rule |
|---|---|---|---|
| **Event** — an instant in time | `orders.created_at`, `orders.paid_at`, `orders.confirmed_at`, `stock_movements.at`, `attendance_sessions.clock_in` | `timestamptz` | Stored in UTC, rendered in the reader's local zone |
| **Wall clock** — a place on the restaurant's calendar | `reservations.date` + `reservations.time`, `shifts.date` + `start` + `end` | `date` + `time` | Never converted, never shifted by a timezone |

A booking at **19:30** must stay at 19:30 whether the server runs in London, Berlin or a
Neon region in Ohio. Storing that as a `timestamptz` would silently move the booking when
the timezone changes or when daylight saving shifts. A reservation is a *slot*, not an
instant, so it gets `date` + `time`.

Attendance needs both and therefore carries both: `attendance_sessions.date` is the local
day the session started on, while `clock_in` / `clock_out` are real instants so the elapsed
time is exact. Same for `shifts` (local wall clock) versus `attendance_sessions` (instants).

`created_at` columns default to `now()`, so inserts never have to supply a timestamp.

### 3.4 Denormalized snapshots are kept on purpose

Some columns copy a value from another row instead of joining to it. This is deliberate:
**history must stay readable after the source row changes or is deleted.**

| Table | Snapshot columns | Why |
|---|---|---|
| `order_items` | `name`, `base_price`, `modifiers` | The receipt of a two-year-old order must still say *Margherita Pizza, £11.50, extra basil*. Renaming the dish on the menu must not rewrite history. |
| `stock_movements` | `name`, `unit`, `order_number` | The movement log is an immutable audit trail. It must still read "Beef Patties, units" after the ingredient is renamed or deleted. |
| `purchase_order_lines` | `name`, `unit` | A purchase order is a legal document sent to a supplier; the wording on it is frozen at the time of ordering. |
| `reservations` | `customer_name`, `email`, `phone` | A guest who books without an account is not a `customers` row, but the booking still has to say who made it. |
| `orders` | `tax_rate`, `service_charge_rate` | A settings change from 10% to 12% tax must not rewrite what yesterday's guests paid. |

The foreign key is **also** kept, so the snapshot is for reading and the FK is for
integrity. Where a snapshot must not survive (a deleted customer), the FK uses
`ON DELETE SET NULL`.

### 3.5 Derived fields are not stored

Anything that can be computed from other columns is computed in the query or in the
application, so it can never drift out of sync:

| Derived value | Computed where |
|---|---|
| Bill subtotal, tax amount, service charge, grand total | `server/src/lib/order-math.js` (SQL `SUM()` over `order_items` where useful) |
| Split share remainders | `server/src/lib/order-math.js` — the cent-exact split algorithm |
| Customer lifetime value, average order value | Analytics queries over `orders` |
| Table turnover, occupancy, peak hours | Analytics queries (`server/src/routes/analytics.js`) |
| No-show rate | `COUNT(*) FILTER (WHERE status = 'no_show') / COUNT(*)` over `reservations` |
| Pay estimate, hours worked, unpaid breaks | `server/src/lib/payroll.js` and `server/src/lib/attendance.js` |
| Stock needed by the kitchen | `recipe_lines` joined with `order_items` |

One deliberate exception: `order_items.unit_price` (`base_price` + modifier deltas) *is*
stored, because it is captured at the moment the item was added and must not be recomputed
from a modifier price that may change later. The same applies to `orders.discount` and
`orders.tip` — they are inputs to the calculation, not outputs of it.

### 3.6 Loyalty — balance on the customer, ledger for the audit trail

Two tables, one number, two jobs:

- **`customers.loyalty_points`** — the running balance (`integer`, `CHECK (loyalty_points >= 0)`).
  It is read on every customer row, in the customer list and on every receipt, so it is
  stored rather than aggregated on read.
- **`loyalty_ledger`** — an append-only log of every movement: `delta` (positive or
  negative), `reason` (`earned`, `redeemed`, `reversed`, `refunded`), `order_id` when the
  movement came from an order, and `created_at`.

The balance is the fast path; the ledger is the truth. Any discrepancy can be rebuilt from
the ledger, and "why did this guest lose 40 points?" is answered by reading two rows
instead of guessing. `orders.points_used` and `orders.points_earned` snapshot the points
involved in that order so a receipt is self-explanatory.

### 3.7 Other choices worth knowing

- **Enums for closed sets** (`role`, `order_status`, `payment_status`, `item_status`,
  `table_status`, `reservation_status`, `shift_status`, `movement_reason`, `po_status`,
  `notification_channel`, `application_status`, `application_desired_role`,
  `customer_type`, `order_priority`, `order_source`, `order_type`, `fulfillment_method`,
  `payment_method`, `modifier_type`, `split_mode`, `split_payment_method` — 21 in total).
  An invalid value is rejected by the database, not by a route handler.
  `notifications.type` stays free-form `text` on purpose: new event types
  (`low_stock`, `item_ready`, `order_placed`, …) must not need a migration.
- **`jsonb` for genuinely open shapes**: `menu_items.modifiers` (modifier groups and their
  options) and `order_items.modifiers` (the selection actually made, with its price delta).
  These are read as a whole, never queried into.
- **Text arrays** for `dietary_tags` and `allergens` — small, always read as a set, and
  `@>` (contains) is the only query needed.
- **`sequences`** — a tiny counter table (`order_seq`, `po_seq`) used to allocate the
  human-facing numbers shown on receipts and purchase orders. `orders.number` and
  `purchase_orders.number` are unique.
- **`settings`** — a singleton row (`id = 1`, `CHECK (id = 1)`) holding the restaurant
  policy: tax rate, service charge, point value, kitchen delay, reservation duration and
  grace, opening hours, late grace, late penalty, automatic break rules.
- **Soft references stay soft.** Where deleting a parent would destroy audit history, the FK
  is `ON DELETE SET NULL` (`orders.customer_id`, `stock_movements.user_id`,
  `notifications.order_id`). Where a child has no meaning without its parent, it is
  `ON DELETE CASCADE` (`order_items.order_id`, `recipe_lines.menu_item_id`,
  `attendance_breaks.session_id`).

---

## 4. ER diagram

```mermaid
erDiagram
    users {
        bigint id PK
        text ext_id
        text email UK
        role role
        boolean active
        numeric hourly_wage
    }
    customers {
        bigint id PK
        text ext_id
        bigint user_id FK
        customer_type type
        integer loyalty_points
    }
    customer_preferences {
        bigint customer_id PK,FK
        text kind PK
        text value PK
    }
    loyalty_ledger {
        bigint id PK
        bigint customer_id FK
        bigint order_id FK
        integer delta
        text reason
    }
    menu_categories {
        bigint id PK
        text ext_id
        text name UK
        integer sort
        boolean active
    }
    menu_items {
        bigint id PK
        text ext_id
        bigint category_id FK
        numeric price
        boolean available
    }
    inventory_items {
        bigint id PK
        text ext_id
        text name UK
        numeric stock
        text unit
    }
    recipe_lines {
        bigint id PK
        bigint menu_item_id FK
        bigint inventory_id FK
        numeric qty
    }
    stock_movements {
        bigint id PK
        bigint inventory_id FK
        bigint order_id FK
        bigint user_id FK
        numeric delta
        movement_reason reason
    }
    purchase_orders {
        bigint id PK
        integer number UK
        bigint created_by FK
        numeric total
        po_status status
    }
    purchase_order_lines {
        bigint id PK
        bigint purchase_order_id FK
        bigint inventory_id FK
        numeric qty
        numeric cost
    }
    tables {
        bigint id PK
        text ext_id
        integer number UK
        bigint waiter_id FK
        bigint reserved_for FK
        table_status status
        boolean held
    }
    orders {
        bigint id PK
        text ext_id
        integer number UK
        bigint table_id FK
        bigint customer_id FK
        bigint waiter_id FK
        bigint created_by FK
        bigint served_by FK
        order_status status
        payment_status payment_status
        numeric tax_rate
    }
    order_items {
        bigint id PK
        text ext_id
        bigint order_id FK
        bigint menu_item_id FK
        bigint prepared_by FK
        numeric base_price
        numeric unit_price
        item_status status
    }
    order_refunds {
        bigint id PK
        bigint order_id FK
        numeric amount
        text reason
    }
    bill_splits {
        bigint id PK
        bigint order_id FK
        split_mode mode
    }
    split_parts {
        bigint id PK
        bigint split_id FK
        integer part_no
        numeric amount
        boolean paid
    }
    split_part_items {
        bigint split_part_id PK,FK
        bigint order_item_id PK,FK
    }
    reservations {
        bigint id PK
        text ext_id
        bigint customer_id FK
        bigint table_id FK
        date date
        time time
        reservation_status status
    }
    notifications {
        bigint id PK
        text ext_id
        bigint user_id FK
        bigint order_id FK
        bigint reservation_id FK
        text type
    }
    notification_reads {
        bigint notification_id PK,FK
        bigint user_id PK,FK
        timestamptz read_at
    }
    staff_applications {
        bigint id PK
        text ext_id
        bigint user_id FK
        bigint decided_by FK
        application_status status
    }
    shifts {
        bigint id PK
        text ext_id
        bigint user_id FK
        bigint created_by FK
        date date
        time start_time
        time end_time
    }
    attendance_sessions {
        bigint id PK
        text ext_id
        bigint user_id FK
        bigint shift_id FK
        timestamptz clock_in
        timestamptz clock_out
    }
    attendance_breaks {
        bigint id PK
        bigint session_id FK
        timestamptz start_time
        timestamptz end_time
    }
    pay_adjustments {
        bigint id PK
        text ext_id
        bigint user_id FK
        bigint created_by FK
        numeric amount
        date date
    }
    settings {
        smallint id PK
        numeric tax_rate
        numeric service_charge_rate
    }
    sequences {
        text name PK
        bigint last_value
    }

    users ||--o{ customers : "may hold an account for"
    customers ||--o{ customer_preferences : "has"
    customers ||--o{ loyalty_ledger : "points balance changes"
    orders ||--o{ loyalty_ledger : "points earned on"
    menu_categories ||--o{ menu_items : "contains"
    menu_items ||--o{ recipe_lines : "is made from"
    inventory_items ||--o{ recipe_lines : "is used in"
    inventory_items ||--o{ stock_movements : "has movements"
    orders ||--o{ stock_movements : "consumed stock"
    users ||--o{ stock_movements : "records"
    users ||--o{ purchase_orders : "raises"
    purchase_orders ||--o{ purchase_order_lines : "contains"
    inventory_items ||--o{ purchase_order_lines : "ordered as"
    users ||--o{ tables : "waits at"
    tables ||--o{ orders : "seats"
    customers ||--o{ orders : "places"
    users ||--o{ orders : "takes"
    orders ||--o{ order_items : "has lines"
    menu_items ||--o{ order_items : "ordered as"
    users ||--o{ order_items : "prepares"
    orders ||--o| order_refunds : "is refunded by"
    orders ||--o| bill_splits : "is split by"
    bill_splits ||--|{ split_parts : "has parts"
    split_parts ||--o{ split_part_items : "covers"
    order_items ||--o{ split_part_items : "assigned to"
    customers ||--o{ reservations : "books"
    tables ||--o{ reservations : "is booked for"
    reservations ||--o| tables : "holds"
    users ||--o{ notifications : "receives"
    orders ||--o{ notifications : "triggers"
    reservations ||--o{ notifications : "triggers"
    notifications ||--o{ notification_reads : "is read by"
    users ||--o{ staff_applications : "applies"
    users ||--o{ shifts : "works"
    users ||--o{ attendance_sessions : "clocks"
    shifts ||--o{ attendance_sessions : "covers"
    attendance_sessions ||--o{ attendance_breaks : "has breaks"
    users ||--o{ pay_adjustments : "is paid"
```

*Notes on the diagram:* `start_time` / `end_time` are the `start` and `end` columns of
`shifts` and `attendance_breaks` (renamed here only — `end` is a Mermaid keyword).
`tables.reserved_for` and `reservations.table_id` are the two sides of the same
reservation↔table relationship.

---

## 5. Table reference

Row counts are the **seed** sizes produced by `002_seed.sql` (the demo dataset as the
current in-memory store generates it). The "grows with" column says what makes the table
grow in real use.

| # | Table | What it holds | Seed rows | Grows with |
|---|---|---|---|---|
| 1 | `users` | Staff and guest logins: name, email, bcrypt hash, role, active flag, `token_version`, hourly wage | 7 | new sign-ups, approved applicants |
| 2 | `customers` | People who dine: contact details, walk-in/online type, loyalty balance, linked account | 6 | every guest, online or at the door |
| 3 | `customer_preferences` | Dietary requirements and allergies, one row per (customer, kind, value) | 12 | edits to a guest's profile |
| 4 | `loyalty_ledger` | Append-only audit trail of loyalty point movements (delta, reason, order) | 0 | every order that earns or spends points |
| 5 | `menu_categories` | Menu sections (Starters, Mains, …) with a sort order and an active flag | 4 | menu edits |
| 6 | `menu_items` | Dishes: price, description, dietary tags, allergens, modifier groups (`jsonb`), availability | 12 | menu edits |
| 7 | `inventory_items` | Ingredients and supplies: stock on hand, unit, reorder level, cost per unit, supplier | 18 | every purchase, count and waste |
| 8 | `recipe_lines` | Bill of materials: how much of each ingredient one portion of a dish consumes | 33 | recipe edits |
| 9 | `stock_movements` | Immutable stock log: delta, stock after, reason, order reference | 0 | every deduction, restock, waste and count |
| 10 | `purchase_orders` | Supplier reorder forms: number, status, total, notes, who raised it | 0 | every reorder |
| 11 | `purchase_order_lines` | The ordered lines, with the name and unit frozen at ordering time | 0 | every reorder |
| 12 | `tables` | Floor plan: number, seats, zone, status, assigned waiter, hold flag, reservation it is held for | 8 | floor-plan edits |
| 13 | `orders` | The order header: number, type, fulfilment, table, customer, waiter, status, payment status and method, rates, tip, points, lifecycle timestamps | ~856 | every order |
| 14 | `order_items` | The lines of an order: dish, quantity, base price, selected modifiers, unit price, per-item status | ~1,800 | every line of every order |
| 15 | `order_refunds` | One refund per order: amount, reason, who approved it | 0 | every refund |
| 16 | `bill_splits` | How one order was split: `even` or `items` | 0 | every split bill |
| 17 | `split_parts` | The shares of a split: part number, label, amount, paid flag, method, paid-at | 0 | every share |
| 18 | `split_part_items` | Which order lines belong to which share | 0 | every item-based split |
| 19 | `reservations` | Bookings: guest details, party size, local date + time, table, status, lifecycle timestamps | ~211 | every booking |
| 20 | `notifications` | In-app and email notifications: target user or role, type, title, body, link | 4 | every event |
| 21 | `notification_reads` | Read receipts: who read which notification | 0 | every read |
| 22 | `staff_applications` | Public job applications: applicant details, desired role, status, decision, created account | 3 | every application |
| 23 | `shifts` | Scheduled shifts: staff member, local date, start and end, notes, status | ~347 | every roster day |
| 24 | `attendance_sessions` | Clock-in/clock-out sessions: local date, instants, linked shift, lateness | ~306 | every shift worked |
| 25 | `attendance_breaks` | Breaks taken inside a session (an open break has no end) | 0 | every break |
| 26 | `pay_adjustments` | Bonuses and deductions for a pay period | 5 | every bonus or deduction |
| 27 | `settings` | Singleton row with the restaurant policy (tax, service charge, point value, hours, grace, penalties) | 1 | settings edits |
| 28 | `sequences` | Named counters that allocate human-facing numbers (`order_seq`, `po_seq`) | 2 | every order and purchase order |

Legacy table (transition only): `app_state` — the old single-row snapshot. See
§8 *Migration from `app_state`*.

---

## 6. Indexes

64 indexes in total. Only the ones that serve a real query are listed.

### Identity and accounts

| Index | Serves |
|---|---|
| `uq_users_ext_id` | Look up a user by the legacy string id used in the API (`/api/users/usr_admin`) |
| `uq_users_email_lower` | Login and "email already registered" lookups (case-insensitive) |
| `uq_customers_ext_id` | Customer lookup by legacy id |
| `uq_customers_user_id` | "Find the customer record of the signed-in user" |
| `idx_customers_name` | Customer search and alphabetical list |
| `idx_customers_type` | Filter customers by walk-in / online |
| `idx_loyalty_ledger_customer_created` | Points history for one customer, newest first |

### Menu and inventory

| Index | Serves |
|---|---|
| `uq_menu_categories_name_lower` | Block duplicate category names |
| `idx_menu_categories_active_sort` | The public menu, active categories in display order |
| `idx_menu_items_category` | Menu items of one category |
| `uq_inventory_items_name_lower` | Block duplicate ingredient names |
| `idx_inventory_items_category` | Inventory list filtered by category |
| `uq_recipe_lines_item_inventory` | One ingredient twice in a recipe is rejected |
| `idx_recipe_lines_inventory` | "What uses this ingredient?" — the low-stock impact list |
| `idx_stock_movements_inventory_at` | The movement log of one ingredient, newest first |
| `idx_stock_movements_at` | Recent movements (inventory health, "what happened today") |
| `idx_purchase_orders_status` | Open purchase orders awaiting delivery |
| `idx_purchase_order_lines_order` | The lines of one purchase order |
| `idx_purchase_order_lines_inventory` | Which orders included a given ingredient |

### Floor plan

| Index | Serves |
|---|---|
| `idx_tables_zone` | Floor plan grouped by zone |
| `idx_tables_status` | "Which tables are free?" |
| `idx_tables_waiter` | The tables a waiter currently looks after |

### Orders, lines, billing

| Index | Serves |
|---|---|
| `uq_orders_number` | Receipt lookup by the printed order number |
| `idx_orders_status_created` | Order list filtered by status, newest first |
| `idx_orders_customer_created` | A customer's own order history, newest first |
| `idx_orders_table_status` | The open orders on a table |
| `idx_orders_type` | Split dine-in vs online order streams |
| `idx_orders_payment` | Payment and revenue reporting over a date range |
| `idx_orders_created` | The most recent orders, newest first |
| `idx_orders_waiter` | A waiter's served orders (performance) |
| `idx_orders_served_by` | Who served an order (performance) |
| `idx_orders_kitchen` (partial) | **The KDS queue.** Only open orders are in the index (`WHERE status IN ('confirmed','preparing','ready')`), ordered by priority then `kitchen_rank` |
| `idx_order_items_order` | The lines of one order — the common case for every order screen |
| `idx_order_items_status` | "Which items are still pending?" — kitchen views |
| `idx_order_items_prepared_by` | "What did this chef prepare?" |
| `uq_order_refunds_order_id` | One refund per order (and the refund lookup) |
| `uq_bill_splits_order_id` | One split per order |
| `uq_split_parts_split_no` | The parts of a split, in a stable order |
| `split_part_items` PK | Which lines belong to which share |

### Reservations and notifications

| Index | Serves |
|---|---|
| `idx_reservations_date_time` | **Availability by slot** — how many bookings exist for a date and time |
| `idx_reservations_table_date` | A table's bookings for a day |
| `idx_reservations_customer` | A guest's own bookings |
| `idx_reservations_status` | Filter by confirmed / no-show / cancelled |
| `idx_notifications_created` | The notification feed, newest first |
| `idx_notifications_user` | One user's notifications |
| `idx_notifications_role` | Notifications broadcast to a role (e.g. the whole kitchen) |

### Workforce

| Index | Serves |
|---|---|
| `idx_staff_applications_status_created` | The manager's application queue, newest first |
| `idx_shifts_user_date` | "My schedule" — one person's shifts in a date range |
| `idx_shifts_date` | The roster for a given day |
| `idx_attendance_sessions_user_date` | Attendance and hours for one person on one day |
| `idx_attendance_sessions_user_clock_in` | A person's sessions, newest first |
| `idx_attendance_sessions_open` (partial) | **"Who is working now"** — only sessions with no clock-out (`WHERE clock_out IS NULL`) |
| `idx_attendance_breaks_session` | The breaks inside one session |
| `idx_pay_adjustments_user_date` | Bonuses and deductions per person per period |

---

## 7. Getting started

### 7.1 Local PostgreSQL

```bash
# 1. Install PostgreSQL 17 (no Docker needed)
winget install PostgreSQL.PostgreSQL.17

# 2. Create the database
psql -U postgres -c "CREATE DATABASE agspm"

# 3. Point the server at it
cp server/.env.example server/.env
#    then edit server/.env:
#    DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/agspm

# 4. Create the schema and load the demo data
pnpm --dir server db:init
```

`db:init` applies `server/schema/001_schema.sql` and then `server/schema/002_seed.sql`. It is
**idempotent**: running it against a database that already has the schema re-applies the DDL
without touching the data, so it is safe to run again.

To start completely fresh (drops every table, then recreates the schema and reseeds):

```bash
pnpm --dir server db:init -- --fresh
```

`--fresh` is destructive: every row in every table is dropped. Never point it at a database
that holds data you want.

### 7.2 Neon (production)

1. Create a project at <https://console.neon.tech> and pick the region closest to your users.
2. Copy the **pooled** connection string from the connection details panel.
3. Put it in the environment the API runs in:
   - locally, in `server/.env`:
     `DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`
   - in production, in the Vercel API project's environment variables.
4. Create the schema and load the demo data:

   ```bash
   pnpm --dir server db:init -- --yes-really
   ```

   The extra `--yes-really` flag is required before the script will touch a database that
   is not on localhost — it is the guard against a mistyped `DATABASE_URL` wiping the
   production database.

5. To rebuild the Neon database from scratch:

   ```bash
   pnpm --dir server db:init -- --yes-really --fresh
   ```

### 7.3 Flags

| Flag | Effect |
|---|---|
| *(none)* | Apply the schema and seed. Idempotent, safe to re-run |
| `--fresh` | Drop all tables first, then recreate the schema and reseed. **Destructive** |
| `--yes-really` | Required for any database that is not on localhost. Must be given explicitly before a non-local database is touched |

### 7.4 Applying the schema by hand

The DDL is plain SQL, so `psql` works as well:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f server/schema/001_schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f server/schema/002_seed.sql
```

`ON_ERROR_STOP=1` makes `psql` stop at the first error instead of continuing with a
half-applied schema.

---

## 8. Migration from `app_state`

### The blob data is demo data — there is nothing to migrate

The current `app_state` payload is **not production data**. It is the seed the in-memory
store generates at first write: 7 staff accounts, 6 customers, 12 dishes, 8 tables, 60 days
of closed order history, 90 days of shifts and attendance, tonight's bookings and this
week's rota — all generated **relative to the day the seed first ran**. It is regenerated
from scratch on every fresh start, so there is no user data worth preserving.

The relational schema is therefore a **fresh start**, not a conversion:

- `002_seed.sql` produces the same dataset as today, with the same demo accounts
  (`admin@rest.test`, `manager@rest.test`, `chef@rest.test`, `waiter@rest.test`,
  `customer@rest.test`, password `password`), the same menu, the same floor plan and the
  same shape of history — so every screen still has something to show on day one.
- The legacy string ids are carried across in `ext_id`, so ids referenced in screenshots,
  seeded links and the frontend stay resolvable.

### `app_state` is kept, then removed

The `app_state` table stays in the database during the transition so that the old snapshot
code path keeps working while the new relational path is being switched on. It is
**deprecated**: once every route reads and writes the relational tables, the table and the
`STATE_KEY` mechanism are dropped.

| Stage | What happens | `app_state` |
|---|---|---|
| 1. Schema | `001_schema.sql` + `002_seed.sql` create the relational tables alongside the legacy table | present, unused |
| 2. Data layer | The store starts reading and writing the relational tables; the API contract (`ext_id`, routes, payloads) is unchanged | still written as a fallback |
| 3. Cutover | The relational path becomes the only path | kept for one release, read-only |
| 4. Cleanup | `DROP TABLE app_state`, remove `STATE_KEY` and the snapshot code | gone |

### What does *not* change

The API contract, the RBAC map, the money maths and the frontend stay as they are. The
migration is a change of storage, not a change of behaviour — that is what makes it safe to
ship in one piece behind the existing tests.

---

## 9. Environment matrix

| Environment | `DATABASE_URL` | Driver | Contents |
|---|---|---|---|
| **Local dev** (`pnpm dev`) | `server/.env`: `postgres://postgres:PASSWORD@localhost:5432/agspm` | `pg` (TCP 5432) | Relational schema + demo seed, created by `pnpm --dir server db:init` |
| **Neon production** (Vercel API project) | Vercel env: the Neon **pooled** URL | `@neondatabase/serverless` (WebSocket 443) | Relational schema + demo seed, created by `pnpm --dir server db:init -- --yes-really` |
| **Neon staging / a second Neon project** | A separate Neon URL (or a Neon branch URL) | `@neondatabase/serverless` | Same schema, own data — the branch URL makes a throwaway copy of production cheap |
| **CI** (`pnpm --dir server test`, `pnpm --dir frontend test`) | not set | none | Purely in memory; the tests use the seeded store and no database is contacted |
| **`pnpm --dir server test:db`** | whatever `DATABASE_URL` points at | per host | A real database; the persistence tests create and clean up their own rows |

Rules of thumb:

- **One database per environment.** Never point local development at the production Neon
  database; the `--yes-really` flag exists to make that mistake hard.
- **`server/.env` is gitignored** and `.vercelignore` keeps it out of Vercel uploads. The
  production URL only ever lives in the Vercel project's environment settings.
- **The schema is identical everywhere**, so a table or index that exists locally exists in
  production too. `server/schema/001_schema.sql` is applied to both; nothing is applied by
  hand.
- **Secrets:** `DATABASE_URL` (database) and `JWT_SECRET` (tokens) are the only environment
  variables the API needs.
