# Neon persistence and Vercel deployment — design

**Status:** approved 2026-10-07

## Problem

The API keeps all state in module-level arrays in `server/src/data/store.js` and
resets on restart. On Vercel each request may hit a fresh serverless instance,
so in-memory state would be lost between requests. The app needs durable
storage before it can be deployed.

## Decision

Persist the **whole store as one JSONB snapshot** in Neon Postgres (chosen over
a relational rewrite of ~2,500 lines of route code, and over per-collection
JSON tables). Deploy as **two Vercel projects**: the Express API and the
Next.js frontend.

## Storage

```sql
CREATE TABLE IF NOT EXISTS app_state (
  key        text PRIMARY KEY,
  data       jsonb NOT NULL,
  version    integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

- Row `main` (overridable with `STATE_KEY`) holds production state. Tests use
  unique keys and delete them afterwards.
- `src/data/snapshot.js`: `snapshot()` returns every mutable piece of the store
  (users, customers, inventory, stockMovements, purchaseOrders, categories,
  menuItems, tables, orders, reservations, applications, shifts,
  notifications, settings, orderSeq, id counters) as plain JSON.
  `restore(data)` writes it back **in place** (array contents / object keys),
  so the route modules' imported references stay valid and no route changes.

## Request flow (`src/data/persist.js`, active only when `DATABASE_URL` is set)

For every `/api/*` request except `/api/health`:

1. Serialise requests within the instance (a promise-chain mutex).
2. `BEGIN; SELECT version FROM app_state WHERE key=$1 FOR UPDATE` — the row
   lock serialises writers across instances.
3. Missing row → insert the current seeded state as version 1.
4. Stored version ≠ in-memory version → load `data` and `restore()` it.
5. Route handlers run unchanged.
6. `res.end` is intercepted: if the serialised snapshot differs from the one
   loaded, `UPDATE … SET data, version = version + 1`; `COMMIT`; then send the
   response. A failed save rolls back, restores the last committed state and
   returns 500, so a client never sees success for an unsaved write.

Driver: `pg` with Neon's pooled connection string (transaction-mode pooling
supports the per-request transaction).

`npm run db:reset` overwrites the row with freshly seeded data (the seed's
"today" is fixed when the row is first written).

## Deployment

- **API project** (`server/`): `api/index.js` exports `createApp()`;
  `vercel.json` rewrites every path to it. Env: `DATABASE_URL`, `JWT_SECRET`.
- **Web project** (`frontend/`): env `API_URL` = API production URL; the
  existing `/api/:path*` rewrite in `next.config.mjs` proxies to it.
- Secrets live only in Vercel env and in the gitignored `server/.env`.

## Testing

- Unit (`test/snapshot.test.js`, in default `npm test`): snapshot is
  JSON-safe; `restore()` round-trips and keeps array/object identity.
- Integration against real Neon (`test-db/persistence.test.js`, run with
  `npm run test:db`, needs `DATABASE_URL`):
  - a write survives wiping in-memory state (simulated cold start);
  - concurrent writes are both persisted;
  - first request seeds a missing row.
- The 51 existing acceptance tests keep running without a database, so CI is
  unchanged.
- After deploy: log in on the live site, create data, confirm it on a fresh
  request.

## Known limitations

Every write rewrites the whole snapshot and writes are serialised — fine for a
course demo, not for real traffic. Seed "today" freezes at first write until
`db:reset`.
