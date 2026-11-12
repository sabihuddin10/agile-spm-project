# DB Wiring — Design

**Date:** 2026-11-12 · **Branch:** `feat/db-wiring` · **Status:** approved

## Goal

Store the app's data in the 29 relational tables of `server/schema/001_schema.sql`
(local PostgreSQL or Neon), replacing the single gzip JSON blob in `app_state`.

## Decision

Routes keep working on the in-memory store (`server/src/data/store.js`). The
persistence middleware syncs that store with the relational tables instead of
the blob. Rewriting all 15 route modules to async SQL was rejected as too
risky for the deadline.

## Architecture

- `server/src/data/persist.js` keeps one transaction per request, serialised
  across instances by `pg_advisory_xact_lock` instead of the `app_state` row lock.
- A row in `sequences` (`name = 'state_version'`) holds the store version.
- `server/src/data/relational/` holds one mapper module per area. Each exports
  `tables` (the tables it owns, parent first), `toRows(store)` → `{ table: rows[] }`
  and `fromRows(rowsByTable)` → store fragment.
- Every store record's string id is kept in the table's `ext_id` column; bigint
  ids are database-internal. Foreign keys are resolved through `ext_id`.

| Store | Tables |
|---|---|
| users | users |
| customers | customers, customer_preferences, loyalty_ledger |
| categories, menuItems | menu_categories, menu_items, recipe_lines |
| inventory, stockMovements, purchaseOrders | inventory_items, stock_movements, purchase_orders, purchase_order_lines |
| tables | tables |
| orders | orders, order_items, order_refunds, bill_splits, split_parts, split_part_items |
| reservations | reservations |
| notifications | notifications, notification_reads |
| applications, shifts, attendance, payAdjustments | staff_applications, shifts, attendance_sessions, attendance_breaks, pay_adjustments |
| settings, counters, orderSeq | settings, sequences |

## Data flow

1. **Request start:** `BEGIN`, take the advisory lock, read `state_version`.
   If it differs from the version this instance loaded, read every table and
   rebuild the store in place (same `restore()` contract as today).
2. **Request end:** if the snapshot changed, save it and bump `state_version`,
   then `COMMIT`. 5xx → `ROLLBACK`.
3. **Save:** the whole mapped row set is rewritten inside the transaction
   (`TRUNCATE … RESTART IDENTITY CASCADE`, then batched multi-row `INSERT`s).
   The store is ~1.3 MB of JSON, so a full rewrite stays well under the
   request budget; per-record diffing is deferred until measured to be needed (YAGNI).
4. **First boot:** empty tables (no `state_version` row) are filled from the
   in-memory seed in `store.js`; `002_seed.sql` is not loaded by the app,
   because tests and the demo depend on the store seed's ids.

## Error handling

Unchanged: any DB error or 5xx rolls back; a connection that errors is
discarded on release. Schema missing → the server applies `001_schema.sql`
at startup (idempotent `IF NOT EXISTS`).

## Testing

All against a real database: `TEST_DATABASE_URL` (local
`postgres://localhost:5432/restaurant_test`). Tests skip nothing — if the
variable is unset, the DB suites fail with a clear message.

1. **Round trip** (`test/data/relational.test.js`): seeded store → save →
   clear store → load → `deepEqual` with the original snapshot. Covers every mapper.
2. **Row counts:** each table holds the expected count after saving the seed.
3. **API → SQL** (`test/data/persist.test.js`): POST an order through the app,
   then `SELECT` its `order_items`.
4. Existing server suite stays green.

Fields that the round trip shows have no column get one, with `DB_PLAN.md` updated.

## Cleanup

Remove `app_state`, `pack`/gzip and their tests; update `DB_PLAN.md` §8 and the README.

## Out of scope

Authentication (teammate). Dish reviews (`feat/dish-ratings`, not on `development`).
