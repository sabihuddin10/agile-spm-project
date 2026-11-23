# Super admin implementation plan

**Goal:** add a sixth role, `superadmin`. It is ranked above admin, holds every admin permission, can manage admins, and is bound to `sabihuddin106@gmail.com` in the database. Then deploy it and bind it on Neon.
**Architecture:**
- **Inheritance:** one helper, `hasRole(user, ...roles)` in `lib/hierarchy.js`, makes the super admin pass every check that admits `admin`. Every guard and inline role check uses it.
- **One holder, enforced by the database:** a partial unique index allows at most one super admin.
- **Bound to one account:** the API never grants the role or lets its holder change its email.
- **Existing databases:** a guarded script moves the binding.

**Tech stack:** Node 22, Express 4, node:test, Postgres 16 (local) and Neon (PG 18), Next.js 14, Vitest + RTL.
**Spec:** `docs/specs/2026-11-15-superadmin-design.md`

---

## Conventions

- Tests are module-wise with `// Arrange // Act // Assert` comments. Red tests are committed on their own, then the green change.
- DB tests run against a local throwaway database, **always with an explicit URL**. `server/.env` points at Neon production, and every test-db file drops `public`.
  ```bash
  createdb restaurant_test_superadmin
  DATABASE_URL=postgres://localhost:5432/restaurant_test_superadmin pnpm --dir server test:db
  ```
- Seeded dev super admin: `sabihuddin106@gmail.com`, with the team's existing dev password from `store.js`. Tests sign in with it.

---

### Task 1: Roles, rank and inheritance (`lib/hierarchy.js`, `data/store.js`, `lib/payroll.js`)

**Files:**
- Modify: `server/src/lib/hierarchy.js`, `server/src/data/store.js`, `server/src/lib/payroll.js`
- Test: `server/test/lib/hierarchy.test.js`

- [ ] **Step 1: failing tests**

```js
test('the super admin ranks above admin', () => {
  // Act / Assert
  assert.ok(rankOf('superadmin') > rankOf('admin'));
});

test('the super admin manages admins and everyone below; nobody manages the super admin', () => {
  // Arrange
  const roles = ['superadmin', 'admin', 'manager', 'chef', 'waiter'];

  // Act
  const manages = (a, t) => canManage(user('a', a), user('t', t));

  // Assert
  for (const target of ['admin', 'manager', 'chef', 'waiter']) assert.equal(manages('superadmin', target), true);
  for (const actor of roles) assert.equal(manages(actor, 'superadmin'), false);
});

test('hasRole: a super admin holds every admin permission, nobody else inherits', () => {
  // Arrange
  const sa = user('s', 'superadmin');

  // Act / Assert
  assert.equal(hasRole(sa, 'admin'), true);
  assert.equal(hasRole(sa, 'manager', 'admin'), true);
  assert.equal(hasRole(sa, 'waiter', 'chef'), false);
  assert.equal(hasRole(user('a', 'admin'), 'superadmin'), false);
  assert.equal(hasRole(null, 'admin'), false);
});

test('the super admin role is never assignable', () => {
  // Act / Assert
  assert.deepEqual(ASSIGNABLE_ROLES, ['customer', 'waiter', 'chef', 'manager', 'admin']);
});
```

- [ ] **Step 2:** `pnpm --dir server test` → FAIL (`hasRole` and `ASSIGNABLE_ROLES` are not exported; rank 0).
- [ ] **Step 3: implement**

```js
// lib/hierarchy.js
export const RANK = { superadmin: 4, admin: 3, manager: 2, chef: 1, waiter: 1 };
export const ASSIGNABLE_ROLES = ['customer', 'waiter', 'chef', 'manager', 'admin'];
export function canManage(actor, target) {
  if (!actor || !target || actor.id === target.id) return false;
  if (rankOf(actor.role) < RANK.manager || !(target.role in RANK)) return false;
  return rankOf(actor.role) > rankOf(target.role);
}
/** Whether `user` holds one of `roles`. The super admin holds every admin permission. */
export function hasRole(user, ...roles) {
  if (!user) return false;
  return roles.includes(user.role) || (user.role === 'superadmin' && roles.includes('admin'));
}
```

`store.js` changes:
- `ROLES` and `STAFF_ROLES` gain `'superadmin'`.
- `export const SUPERADMIN_EMAIL = 'sabihuddin106@gmail.com'`.
- The seed's `usr_super_sabih` uses `email: SUPERADMIN_EMAIL, role: 'superadmin'`.

`payroll.js` changes:
- `DEFAULT_WAGES.superadmin = 25`.

- [ ] **Step 4:** tests PASS. **Step 5:** commit.

### Task 2: Guards and handler checks inherit admin

**Files:**
- Modify: `middleware/auth.js`
- Modify: `lib/orders.js`, `lib/notify.js`
- Modify routes: `orders`, `tables`, `staff`, `billing`, `reservations`, `inventory`, `menu`, `settings`
- Test: `test/routes/access-matrix.test.js`, plus one handler-rule test each in the tables, inventory, menu, settings, staff and notifications route tests.

- [ ] **Step 1: failing tests**
  - Access matrix: add `'superadmin'` to `ROLES`, logging in as `sabihuddin106@gmail.com`. Expected access for the super admin is `allowed === null || allowed.includes('admin')`, derived rather than listed by hand.
  - Handler rules, each signed in as the super admin:
    - edit a table's seats → 200
    - edit an ingredient's fields → 200
    - the menu includes recipes
    - settings returns the staff view
    - approve an application as a manager → 200
    - an admin-broadcast notification is visible
- [ ] **Step 2:** FAIL (403 or missing data for the super admin).
- [ ] **Step 3:**
  - `requireRole`: `if (!hasRole(req.user, ...allowedRoles))`.
  - Replace each inline `[...].includes(x.role)` and `role === 'admin'` permission check with `hasRole(x, ...)`.
  - `notificationsFor`: `hasRole(user, n.role)`.
- [ ] **Step 4:** PASS. **Step 5:** commit.

### Task 3: Account rules for the bound role (`routes/auth.js`)

**Test:** `test/routes/auth.test.js`

- [ ] **Step 1: failing tests**
  - The super admin edits an admin's profile, resets an admin's password, sets one, demotes an admin to manager, suspends and removes an admin → 200.
  - An admin trying the same on the super admin → 403.
  - `PATCH /auth/users/:id {role:'superadmin'}` by the super admin → 403, with the "bound to one account" message.
  - The super admin's `PATCH /auth/me` email change → 403; a name change → 200.
  - `GET /auth/roles` returns six roles, ending in `'superadmin'`.
  - The existing superuser test: Sabih signs in as `superadmin`, Shahan as `admin`.
- [ ] **Step 2:** FAIL. **Step 3:** implement the two 403 rules (spec §Domain). Update the `/auth/roles` catalogue summary, then run `pnpm --dir server run export:health`. **Step 4:** PASS. **Step 5:** commit.

### Task 4: Workforce scoping (`lib/workforce.js`)

**Test:** `test/routes/workforce.test.js`

- [ ] **Step 1: failing tests**
  - The super admin's overview lists everyone, including themselves, with pay.
  - An admin's overview excludes the super admin.
  - `GET /workforce/users/usr_super_sabih` as an admin → 403.
  - `PUT /workforce/users/usr_super_sabih/wage` as an admin → 403.
  - The admin presence board still lists every staff role except the super admin; the super admin's own board lists all.
- [ ] **Step 2:** FAIL. **Step 3:**
  - `WORKFORCE_ROLES` gains `superadmin`.
  - An effective admin gets `'full'` access only when `rankOf(target) <= rankOf(actor)`.
  - `overviewRoles` and `presenceRoles` filter by the same rank rule.
  - `seesPay` uses `hasRole(actor, 'admin')`.
  - The wage and adjustment writes check `workforceAccess(...) === 'full'`.
- [ ] **Step 4:** PASS. **Step 5:** commit.

### Task 5: Schema (`004`, `005`, `schema.js`, `db:init`, `002_seed.sql`)

**Test:** `test-db/schema.test.js`

- [ ] **Step 1: failing tests**
  - After `ensureSchema` (run twice), the `role` enum includes `superadmin` and there are still 28 tables.
  - Inserting two super admin rows raises `unique_violation` (`23505`) on `uq_users_one_superadmin`.
  - `SCHEMA_FILES` lists `001`, `003`, `004` and `005` in order.
- [ ] **Step 2:** FAIL. **Step 3:**
  - Add the two SQL files.
  - Export `SCHEMA_FILES` from `schema.js`.
  - `initdb_localpg.js` applies `SCHEMA_FILES` (one transaction each) before `002_seed.sql`.
  - Sabih's row in `002_seed.sql` gets role `'superadmin'`.
- [ ] **Step 4:** PASS on the local throwaway database. **Step 5:** commit.

### Task 6: Binding on a database (`lib/superadmin.js`, `data/superadmin.js`, `scripts/superadmin.js`)

**Tests:** `test/lib/superadmin.test.js` (in memory), `test-db/superadmin.test.js`

- [ ] **Step 1: failing tests**
  - `bindSuperadmin(store, { email })`:
    - promotes an existing admin
    - demotes the previous holder to admin
    - reactivates a suspended account
    - with no account and a valid password, creates an active super admin with a bcrypt hash
    - with no account and no password, or a weak one, throws and changes nothing
    - is idempotent
  - DB test: seed the store into the tables, then run `bindInDatabase(pool, { email, name, password })`. `users` then has exactly one `superadmin`, the email matches, `state_version` went up by 1, and `loadStore` → `restore` shows the new role.
- [ ] **Step 2:** FAIL. **Step 3:** implement as in the spec §Binding.
  - The CLI checks for the account before taking the lock and prompts with echo hidden only when it must create one.
  - Neon needs `--yes-really`.
  - Add the `"superadmin": "node scripts/superadmin.js"` npm script.
- [ ] **Step 4:** PASS. **Step 5:** commit.

### Task 7: Web app

**Files:**
- Modify: `types/index.ts`, `lib/permissions.ts`, `components/staff/role-meta.ts`, `account-table.tsx`, `staff-shell.tsx`, `applications-panel.tsx`, `dev-shell.tsx`, `lib/workforce-mock.ts`
- Tests: `permissions.test.ts`, `role-meta.test.ts`, `staff.test.tsx`

- [ ] **Step 1: failing tests**
  - `canAccess('superadmin', s)` equals `canAccess('admin', s)` for every section, and the same holds for every `can.*` action.
  - `ROLE_RANK.superadmin > ROLE_RANK.admin`.
  - The super admin can manage and administer an admin; an admin can do neither to the super admin.
  - `ASSIGNABLE_ROLES` excludes `superadmin`.
  - `ROLE_META.superadmin.label === 'Super admin'`, and `ROLE_CAPABILITIES` covers the super admin.
  - Account table, signed in as the super admin: the admin row has a role picker without a "Super admin" option. Signed in as an admin: the super admin row shows a badge and no actions.
- [ ] **Step 2:** FAIL. **Step 3:** implement as in the spec §Web app. **Step 4:** PASS. **Step 5:** commit.

### Task 8: Docs and Scrum board

- `README.md`: roles table (super admin row), demo accounts, the bind script in the commands table.
- `DB_PLAN.md`:
  - enum and index counts (64 → 65 indexes)
  - `users` seed rows
  - §7, binding the super admin
- `WORKPLAN.md`: Phase 8 answered, new Phase 12.
- `frontend/src/data/backlog.ts`: Sprint 17, *Super Admin & Account Governance*:
  - US17.1 (5 pts): the role and its rules
  - US17.2 (3 pts): binding it on a database

  Each story has acceptance criteria and points at its test.

### Task 9: Gate, ship, bind

1. Run the six CI checks locally, plus `test:db` on the throwaway database.
2. Push the branch. Open a PR into `development`; CI green → merge. Open a PR from `development` into `main`; CI green → merge.
3. `cd server && vercel deploy --prod`. Then a read-only check on Neon: the enum has `superadmin` and the index exists after the first request.
4. `cd frontend && vercel deploy --prod`. Check that `GET /api/auth/roles` on the live web proxy lists `superadmin`.
5. In the user's terminal, run:
   ```bash
   pnpm --dir server superadmin -- --name="Sabih Uddin" --yes-really
   ```
   The user types the password there.
6. Read-only check on Neon: exactly one super admin row, with email `sabihuddin106@gmail.com`.
