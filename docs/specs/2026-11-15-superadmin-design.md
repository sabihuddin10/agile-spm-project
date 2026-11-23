# Super admin role, bound to one email

**Date:** 2026-11-15
**Status:** proposed
**Answers:** WORKPLAN Phase 8, "Should a single super-admin manage the other admins?" Yes.
**Bound email:** `sabihuddin106@gmail.com`

## Problem

Accounts follow a strict rank, `admin > manager > chef = waiter`, and nobody can manage an account of equal or higher rank. That leaves admins unmanaged. Neon now holds two admins (`sabih@admin.test`, `admin@rest.test`), and the code seed adds two more. Nobody can suspend an admin, reset an admin's password or demote one. The work plan has carried this as an open question since Phase 8.

## Decision

Add a sixth role, **`superadmin`**, ranked above admin. Exactly one account holds it, bound to `sabihuddin106@gmail.com`:

- It holds **every admin permission**.
- It can also manage admins: edit their details, reset or set their password, change their role, suspend or remove them.
- **Nobody can manage it.** No role outranks it, and the API never grants or removes it.
- It is **bound to its email**. The super admin cannot change that email through the app. Only `scripts/superadmin.js`, run with database access, can move the binding.

## Approaches considered

| | Approach | For | Against |
|---|---|---|---|
| **A (chosen)** | First-class `superadmin` value in the `role` enum. One `hasRole()` helper makes it pass every admin check. | One honest model: the DB, API and UI all say `superadmin`. The database itself can enforce "at most one". The access-matrix test can prove superadmin ⊇ admin on every endpoint. | Touches every inline role check (about 20 on the server, 10 in the web app). Mitigated by routing them all through `hasRole()`. |
| B | Keep the account `admin` and add a separate `superadmin(email)` binding table. | Few code changes. Old deployed code ignores it. | Two sources of truth: `users.role` says admin. The binding table survives `db:reset` while the account does not, so anyone who registers that email afterwards would match the binding (there is no email verification). |
| C | `SUPERADMIN_EMAIL` env var on Vercel. | No schema change. | The binding lives outside the database (the user asked for Neon). Every change needs a redeploy. Same email-takeover issue as B. |

## Design

### Data model (Postgres, local and Neon)

- `server/schema/004_superadmin_role.sql`: `ALTER TYPE role ADD VALUE IF NOT EXISTS 'superadmin';`
- `server/schema/005_one_superadmin.sql`: `CREATE UNIQUE INDEX IF NOT EXISTS uq_users_one_superadmin ON users (role) WHERE role = 'superadmin';`
  Every superadmin row has the same indexed value, so the unique partial index allows at most one. A second superadmin is refused by the database, not just by the API.
- Two files, because Postgres refuses to use a new enum value inside the transaction that added it. `ensureSchema` runs each file as its own query, so `004` commits before `005` runs.
- `relational/schema.js` exports the file list (`001`, `003`, `004`, `005`). `scripts/initdb_localpg.js` applies the same list before `002_seed.sql`, so a fresh `db:init` gets the enum value before the seed row that uses it. Today `db:init` skips `003`; this fixes that too.
- `002_seed.sql`: Sabih's row gets `role = 'superadmin'`.
- `people.js` needs no change: `role` is already mapped as the enum type.

### Domain (server)

- `data/store.js`:
  - `ROLES` and `STAFF_ROLES` gain `'superadmin'`.
  - New `SUPERADMIN_EMAIL` constant.
  - The seed's `usr_super_sabih` gets `role: 'superadmin'`. Its dev password stays as the team set it.
- `lib/payroll.js`: `DEFAULT_WAGES.superadmin = 25`, the same as admin.
- `lib/hierarchy.js` (roles and ranks live here):
  - `RANK.superadmin = 4`.
  - `canManage` lets any rank ≥ manager act on a strictly lower rank, so a superadmin can manage admins.
  - New `hasRole(user, ...roles)`: true when the user's role is listed, or the user is the superadmin and `'admin'` is listed.
  - New `ASSIGNABLE_ROLES`: every role except `superadmin`.
- `middleware/auth.js`: `requireRole` checks with `hasRole`. `guard.allowedRoles`, which the API catalogue reads, keeps the declared list.
- Every inline `[...].includes(req.user.role)` or `role === 'admin'` permission check uses `hasRole`. That covers:
  - `lib/orders.js`, `lib/notify.js`
  - routes: `orders`, `tables`, `staff`, `billing`, `reservations`, `inventory`, `menu`, `settings`
- Workforce (`lib/workforce.js`): the superadmin sees everything an admin sees. Admins keep full access to admins and below, but not to the superadmin, so an admin can neither see nor edit the superadmin's pay. Presence and overview follow the same rule.
- `routes/auth.js`:
  - `PATCH /users/:id`: `role: 'superadmin'` → `403 "The super admin role is bound to one account and cannot be assigned."` The superadmin's own role and status already cannot change: self-changes are refused, and nobody outranks them.
  - `PATCH /me`: an email change by the superadmin → `403 "The super admin's email is bound to the role and cannot be changed."` Name and phone stay editable.
  - `GET /roles` lists all six roles.

### Web app

- `types`: `Role` gains `'superadmin'`.
- `lib/permissions.ts`:
  - `STAFF_ROLES` gains `superadmin`.
  - `canAccess` and `anyOf` treat the superadmin as admin.
  - `ROLE_RANK.superadmin = 4`.
  - `canManageAccount` lets rank ≥ manager act on strictly lower ranks.
  - New `can.approveManagers`.
  - New `ASSIGNABLE_ROLES`.
- `components/staff/role-meta.ts`:
  - `ROLE_META.superadmin = { label: 'Super admin', plural: 'Super admins', tone: 'red' }`, distinct from admin's `brand`.
  - The superadmin goes first in `ROLE_ORDER` and `STAFF_ROLE_ORDER`.
  - New capabilities entry. Admin's "cannot" list now says the super admin manages admins.
- `account-table.tsx`: the role picker offers `ASSIGNABLE_ROLES` only. A super admin row, including the super admin's own, always shows its badge, never a picker.
- `account-profile-form.tsx` (My account): the super admin's email field is read-only and explains that the email is bound to the role. The server refuses the change anyway.
- `staff-shell.tsx`: the sidebar role badge takes its label and colour from `ROLE_META` instead of a hard-coded chain.
- Hard-coded role checks go through `permissions.ts`:
  - `staff-shell` (badge tone)
  - `applications-panel` (`can.approveManagers`)
  - `dev-shell` (`isStaff`)
- `workforce-mock` (test and demo data only) gets super admin entries in its per-role tables: wage, shift templates, presence scope. Its admin checks stay as they are, because its demo data has no super admin and production never enables the mock.

### Binding on an existing database: `scripts/superadmin.js`

`pnpm --dir server superadmin -- [--email=…] [--name=…] [--yes-really]`. The email defaults to `SUPERADMIN_EMAIL`.

1. **Before any lock:**
   - Look up the account for the email, and report its current role, name and creation date if it exists.
   - Ask for a password twice, with the input hidden. Piped input (two lines on stdin) is accepted for automation.
   - Check the password against the policy.
   - Waiting for a person while holding the global lock would stall every request on the live site, so the prompt comes first.
   - **Every bind sets this password, even on an existing account.** Registration has no email verification and the bound email is public. If a bind only promoted an existing account, then anyone who registered that email before the bind, or the seed's public dev password (`Admin@123456`, e.g. after `db:reset`), would become the production super admin's credential. *(Changed after code review.)*
2. **Bind, under the same protocol as `persist.js`:**
   1. `BEGIN` and `pg_advisory_xact_lock(727274)`.
   2. Load the store if a `state_version` row exists; otherwise start from the seed.
   3. Run `bindSuperadmin({ email, name, password })` on the in-memory store (the same module state the routes use):
      - Promote the account, or create it.
      - Set the new password, make it active, and bump its `tokenVersion`, which signs out every existing session.
      - Demote any other super admin to admin and bump their `tokenVersion` too, so moving the binding away from an account ends its sessions.
   4. `saveStore`, bump `state_version`, `COMMIT`. Running instances reload on their next request.
3. Neon targets need `--yes-really`, the same guard as `db:init`.
4. The literal `--` that `pnpm run` forwards is ignored, so `pnpm --dir server superadmin -- --yes-really` works. `db:init` gets the same fix, because the README's documented `db:init -- --yes-really` failed the same way.

`bindSuperadmin` is a pure function in `src/lib/superadmin.js`, unit-tested in memory. The DB path is covered by a `test-db` test.

### Rollout order

The deployed web app reads `ROLE_META[u.role].tone`. A superadmin row reaching Neon before the new web app is live would crash the admin Users page. So the order is:

1. PR `feat/superadmin` → `development` (CI green), then `development` → `main`.
2. `vercel deploy --prod` for the API first. Its first request applies `004` and `005` to Neon. Old web plus new API is safe because no superadmin exists yet.
3. `vercel deploy --prod` for the web app.
4. Run `pnpm --dir server superadmin -- --name="Sabih Uddin" --yes-really` in the user's terminal. The account does not exist in Neon, so the user types its password there, and it is never typed or chosen by the agent. The seed's public dev password is not used in production.

### Errors

| Case | Result |
|---|---|
| Assign `superadmin` through the API | `403` (above) |
| Superadmin changes own email | `403` (above) |
| An admin acts on the superadmin | `403 "You can only manage accounts below your own rank."` (existing) |
| A second superadmin row | Postgres `unique_violation` on `uq_users_one_superadmin` |
| Bind script run without a password, or with a weak or mismatched one | Exits non-zero, nothing written |
| Bind script on Neon without `--yes-really` | Refuses |

### Testing (TDD, red first)

- `test/lib/hierarchy.test.js`:
  - rank 4
  - the superadmin manages admins, admins do not manage the superadmin
  - `hasRole` inheritance
  - `ASSIGNABLE_ROLES`
- `test/routes/access-matrix.test.js`: `superadmin` added as a caller. Wherever `admin` is allowed, `superadmin` must be allowed too. The rule is derived automatically, so a new route cannot forget it.
- `test/routes/auth.test.js`:
  - the superadmin resets, sets the password of, demotes, suspends and removes an admin
  - an admin gets 403 on each of those against the superadmin
  - assigning `superadmin` → 403
  - superadmin email change → 403, name change → 200
  - `/auth/roles` lists six roles
  - the teammates' superuser test is updated: Sabih now signs in as `superadmin`
- `test/lib/workforce.test.js` (new) or `test/routes/workforce.test.js`: an admin cannot see or edit the superadmin's pay; the superadmin sees all.
- `test/lib/superadmin.test.js`: promote, create, demote the previous holder, reactivate, refuse without or with a weak password.
- `test-db/schema.test.js`: the enum has `superadmin`; a second superadmin row is refused.
- `test-db/superadmin.test.js`: the script's DB path binds, bumps `state_version` and round-trips through `loadStore`.
- Web:
  - `permissions.test.ts`: inheritance, rank, assignable roles
  - `role-meta.test.ts`: the Super admin label
  - `staff.test.tsx` / account table: no Super admin option in the role picker; a superadmin gets the picker on admin rows
- Full six-check CI gate, plus `test:db` against a local throwaway database.

## CI repair (added during implementation)

CI has been red on `development` and `main` since commit `99a1237` (the superuser accounts). Two DB tests fail on a pristine checkout:

1. The first-request seed test hard-codes 7 users; the seed has 9. It now compares against the store seed.
2. The store does not survive a save and load, because `altPasswordHashes` (every seeded account also accepted `password`) exists only in memory and is never written to Postgres. As a result the fallback vanished after any reload, and an old `password` kept working after a password change on a warm instance. **Removed, with the user's approval:**
   - `store.js` no longer seeds alternate hashes, and `lib/passwords.js` checks only `passwordHash`.
   - The superuser test now checks that `password` does not open a superuser account.

## Code-review follow-ups (2026-11-15)

- The API catalogue (`server/src/lib/api-catalog.js`) gets the six-role example, the two new `403`s, and the rank-limited workforce text. Then `export:health` is rerun.
- Every `test-db` file refuses a Neon `DATABASE_URL`, so `test:db` can never drop the production database. `server/.env` points at Neon.
- The super admin's handler-rule tests live in each module's own test file, per the module-wise test convention.
- DB_PLAN §7.4 (applying the schema by hand) lists `001`, `003`, `004` and `005` before `002`.

## Out of scope

- Email verification for registration.
