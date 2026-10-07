# Neon Persistence and Vercel Deployment Implementation Plan

**Goal:** Persist the API's in-memory store in Neon Postgres and deploy API + web to Vercel.
**Architecture:** One JSONB snapshot row, loaded/saved per request inside a row-locked transaction; store arrays are restored in place so routes are untouched. Two Vercel projects (API, web). See `docs/specs/2026-10-07-neon-persistence-design.md`.
**Tech Stack:** Express 4, `pg`, Neon Postgres, Next.js 14, Vercel CLI, `node:test`.

---

### Task 1: Snapshot/restore of the store

**Files:** Create `server/src/data/snapshot.js`; modify `server/src/data/store.js` (export `counters`); test `server/test/snapshot.test.js`.

- [ ] Write failing tests: `snapshot()` equals its JSON round-trip; after mutating the store, `restore(saved)` brings back the saved data while `users`/`orders`/`settings` keep identity.
- [ ] Run `pnpm --dir server test` → FAIL (module not found).
- [ ] Implement `snapshot()` / `restore()`.
- [ ] Run → PASS (53 tests). Commit.

### Task 2: Persistence middleware against real Neon

**Files:** Create `server/src/data/db.js`, `server/src/data/persist.js`; modify `server/src/app.js`; test `server/test-db/persistence.test.js`; script `test:db` in `server/package.json`.

- [ ] Write failing integration tests (unique `STATE_KEY` per run, row deleted in `after`): seeds missing row; write survives wiping memory + resetting cached version; 5 concurrent customer creations all persisted.
- [ ] Run `pnpm --dir server run test:db` → FAIL.
- [ ] Implement `db.js` (pool, `ensureTable`), `persist.js` (mutex, `FOR UPDATE`, version cache, `res.end` interception, rollback on save failure), mount in `createApp` when `DATABASE_URL` is set.
- [ ] Run `test:db` → PASS; `test` → PASS. Commit.

### Task 3: Reset script and Vercel entry

**Files:** Create `server/scripts/db-reset.js`, `server/api/index.js`, `server/vercel.json`; modify `server/package.json`, `README.md`.

- [ ] `db:reset` writes freshly seeded snapshot to `STATE_KEY`.
- [ ] `api/index.js` default-exports `createApp()`; `vercel.json` rewrites `/(.*)` → `/api`.
- [ ] README: storage, env vars, deploy steps. Commit.

### Task 4: Deploy

- [ ] `vercel link` + `vercel env add DATABASE_URL/JWT_SECRET` for API (root `server`), `vercel --prod`.
- [ ] `vercel link` + `vercel env add API_URL` for web (root `frontend`), `vercel --prod`.
- [ ] Verify: `/api/health`, login, create a customer, read it back on a new request, frontend loads menu through proxy.
