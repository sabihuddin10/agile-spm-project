# Plate & Flame — Restaurant Operations & Ordering Platform

A full-stack restaurant operations platform built as a 10-sprint Agile/Scrum project. It covers the whole flow from **customer orders** through **waiter confirms**, **kitchen prepares** and **waiter serves**, to **bill settled**, and from there **inventory deducts** and **analytics update**. Five stakeholder roles each get their own permissions and screens.

All **17 sprints / 82 user stories / 355 story points** of the Product Backlog are implemented: the original 10 modules plus accounts, attendance, payroll, UI polish, validation and the super admin. Stories are verified by module-wise tests (`server/test/` and `frontend/src/**/__tests__/`). Each story's demo path and test are listed on the in-app **Scrum board** (`/dev`).

## Monorepo layout

```
.
├── server/                 Express 4 REST API (in-memory store, persisted to Neon Postgres)
│   ├── api/index.js        Vercel serverless entry (vercel.json routes every path here)
│   ├── src/app.js          app factory (routes + middleware)
│   ├── src/data/           store.js (data model + live seed), seed-history.js (60 days of history),
│   │                       snapshot.js + persist.js + db.js (Neon persistence)
│   ├── schema/             001_schema.sql (relational DDL), 002_seed.sql (demo data)
│   ├── src/lib/            order-math (money/splits), orders (lifecycle), reservations (capacity/holds), notify
│   ├── src/routes/         auth, customers, menu, orders, tables, reservations, billing,
│   │                       inventory, staff, analytics, notifications, settings
│   ├── test/               tests mirroring src/: routes/, lib/, data/, middleware/ (node:test, in memory)
│   └── test-db/            persistence tests against a real Postgres database (local, CI or Neon)
├── frontend/               Next.js 14 (App Router) + React 18 + TypeScript + Tailwind
│   └── src/
│       ├── app/            storefront (/, /menu, /book, /account, /careers), staff console (/staff/*), Scrum board (/dev)
│       ├── components/     feature components (orders, billing, tables, inventory, staff, analytics, …)
│       ├── lib/            api client, permissions (RBAC map), formatting, menu pricing
│       └── data/backlog.ts Product Backlog with acceptance criteria + evidence
├── .github/workflows/ci.yml  Definition-of-Done gate: lint + tests + type check + build
└── *.docx                  Agile documentation (proposal, backlogs, WBS, Gantt, ceremonies, velocity)
```

## Tech stack

| Layer      | Technology                                                            |
|------------|-----------------------------------------------------------------------|
| Frontend   | Next.js 14 (App Router), React 18, TypeScript (strict), Tailwind CSS 3 |
| Charts     | Chart.js via react-chartjs-2 (analytics dashboard)                    |
| Backend    | Express 4 (REST, ES modules)                                           |
| Auth/RBAC  | JWT (bcrypt-hashed passwords), role guards on every API route, matching UI guards |
| Storage    | PostgreSQL (local dev / Neon in prod), relational schema              |
| Hosting    | Vercel: API and web as two projects (see *Deployment*)                |
| Tests / CI | `node:test` (server), Vitest + React Testing Library (web), ESLint, GitHub Actions |

## Getting started

Requires Node 18+ (CI uses Node 22) and pnpm (`corepack enable`).

```bash
pnpm install          # installs server + frontend workspaces
pnpm dev              # API on :4000, web on :3000
```

### Database setup

The app uses a relational PostgreSQL schema (local dev or Neon in production).

1. Install PostgreSQL locally (or use a Neon project)
2. Create a database: `psql -U postgres -c "CREATE DATABASE agspm"`
3. Copy `server/.env.example` to `server/.env` and set `DATABASE_URL`
4. Initialize the schema and seed data:
   ```bash
   pnpm --dir server db:init
   ```
5. To start fresh (drops all tables):
   ```bash
   pnpm --dir server db:init:fresh
   ```

Open http://localhost:3000. The API base is http://localhost:4000/api (Next proxies `/api/*` to it).

| Command                           | What it does                                     |
|---------------------------------|------------------------------------------------|
| `pnpm --dir server test`          | Server route, lib and data tests, in memory (400+ tests) |
| `pnpm --dir frontend test`        | Frontend unit and component tests, Vitest (950+ tests) |
| `pnpm --dir server test:db`       | Persistence tests against Postgres (needs `DATABASE_URL`; wipes that database) |
| `pnpm --dir server db:reset`      | Rewrite the tables with fresh demo data          |
| `pnpm --dir server db:init`       | Create schema + seed demo data (local or Neon)   |
| `pnpm --dir server db:init:fresh` | Drop all tables, recreate schema, reseed         |
| `pnpm --dir server superadmin`    | Bind the super admin to its email on the database (`--yes-really` for Neon) |
| `pnpm --dir server lint`          | Syntax-check every server file                   |
| `pnpm --dir frontend lint`        | ESLint for the web app                           |
| `pnpm build`                      | Production build of the web app (includes type check) |

### Demo accounts (password: `password`)

| Role     | Email               | Try this                                                    |
|----------|---------------------|-------------------------------------------------------------|
| Admin    | admin@rest.test     | Staff management → roles, suspend/remove; everything else   |
| Manager  | manager@rest.test   | Analytics, inventory reorder form, shifts, refunds, settings |
| Chef     | chef@rest.test      | Kitchen display: start/ready items, rush & reorder queue     |
| Waiter   | waiter@rest.test    | Orders, floor plan, reservations, billing, notifications     |
| Customer | customer@rest.test  | Order with modifiers, dine-in/pickup/delivery, bookings, receipts |

Also seeded: `chef2@rest.test` (Cara Cook) and `waiter2@rest.test` (Wendy Server), so staff performance has more than one person to compare.

Two team accounts use the dev password `Admin@123456` instead: `sabihuddin106@gmail.com`, **the super admin**, and `shahanarain33@gmail.com`, an admin. Every seed password is public, so the production super admin gets its own password from `pnpm --dir server superadmin` (see *Roles and permissions*).

## Roles and permissions

Each role gets what its job needs. Reversing money, deleting history, and changing staffing, pricing or policy need a manager.

| Role | Can | Cannot |
|---|---|---|
| **Customer** | Browse the menu, order (online or at their table), cancel their own order before the kitchen accepts it (refunded if prepaid), book a table, see their own orders, bookings, bills and profile | See other guests' data or anything staff-only |
| **Waiter** | Take, confirm, edit (before confirmation) and serve orders; assign tables, set table status and holds; handle reservations; add and edit customers; take payment (tip, split, pay); edit their own details and password (My account) | Reverse a payment, cancel a paid order, refund, delete customers, see recipes, edit the menu, inventory, shifts, analytics or settings |
| **Chef** | Run the kitchen queue (start, ready, rush, reorder), toggle dish availability, see recipes, see inventory and record stock counts; edit their own details and password (My account) | Billing, customers, tables, reservations, menu prices or recipes, purchase orders, shifts |
| **Manager** | Everything operational: menu and recipes, inventory and purchase orders, refunds and payment reversals, cancelling paid orders, deleting customers (only those with no order history), shifts and roster, approving waiter/chef applications, analytics, settings, viewing accounts; edit details and reset passwords of waiters and chefs | Manage another manager's or an admin's account, change roles, suspend or delete accounts, approve managers |
| **Admin** | Everything, including the details, passwords, roles and status of managers, waiters and chefs | Manage another admin's account (the super admin does) or the super admin's |
| **Super admin** | Everything an admin can, plus the details, passwords, roles and status of admins | Be assigned, suspended or removed through the app, or change its own email: the role is bound to one account |

Accounts follow a rank, superadmin > admin > manager > chef = waiter. You can manage staff accounts strictly below yours and manage your own details in **My account**. Self-service changes to the sign-in email or password require the current password. An admin can set a new password for a staff account below them. A manager's password reset issues a temporary password that opens the password-change flow before the rest of the API becomes available.

**The super admin** is one account, bound to `SUPERADMIN_EMAIL` (`sabihuddin106@gmail.com`, `server/src/data/store.js`). It holds every admin permission (`hasRole` in `server/src/lib/hierarchy.js` lets it pass every check that admits an admin) and is the only role that manages admins. Nobody can manage the super admin. The API never assigns the role (`403`), the super admin cannot change its email, and Postgres allows at most one (`uq_users_one_superadmin`). To bind it on a database, or move it to another email, run `pnpm --dir server superadmin -- [--email=… --name="…"] [--yes-really]`. Every bind sets a password typed at that moment (asked twice, input hidden) and signs out the account's sessions, whether it promotes an existing account or creates one. An account someone registered with the public email beforehand, or a seed password, therefore never becomes the super admin's credential. Any previous super admin becomes an admin and is signed out. It runs under the same lock as the API and bumps the store version, so running instances pick it up on their next request. `db:reset` reseeds the users, so run it again after a reset.

The web app uses a 12-hour HttpOnly session cookie through the same-origin `/api` proxy. Production uses a Secure cookie and requires a randomly generated `JWT_SECRET`. Browser writes send `X-Requested-With: RestaurantOps`, and login, registration and password changes return the user while setting the cookie. Users migrating from local storage sign in again. Signing out revokes all sessions for the account. Suspension, password changes and resets also revoke existing sessions.

Login allows 30 attempts per IP and five failed attempts per normalized email in 15 minutes. Registration allows 10 attempts per IP in the same window. The API returns `429` with `Retry-After` when throttled. When the API runs against a database (`DATABASE_URL`, as in production) the counters live in a shared `rate_limits` table, so every API instance counts against the same quota and a restart does not reset them; without a database (local development, tests) they are kept in process memory. If the shared counters cannot be reached, sign-in, registration and the public forms answer `503` with `Retry-After: 5` and the outage is logged, instead of going unlimited. The API refuses to start in production without a database, so production always shares its counters; only an explicit `RATE_LIMIT_STORE=memory` there keeps them per instance, and that logs a warning at startup. Details: `docs/rate-limiting.md`. Use dedicated credentials in any deployment with real data, since the demo seeds include known passwords.

Every staff member clocks their own attendance and sees their own hours and pay estimate (`/api/attendance`, `/api/workforce`); managers see waiters' and chefs' attendance but never wages or pay, admins see and edit the wages, bonuses and pay of everyone up to admin, the super admin everyone's, and the "who's working now" board shows waiters to waiters, chefs to chefs, managers plus waiters and chefs to managers, all staff up to admin to admins, and everyone to the super admin.

The server enforces this with `requireRole` guards, plus handler checks where a rule depends on the record (an order's owner, a paid order, a chef editing only availability). `server/test/routes/access-matrix.test.js` calls every guarded endpoint as a guest and as each role (the super admin's expected access is derived from admin's), and fails if a route is added without an entry. The UI hides the same actions through `frontend/src/lib/permissions.ts`. The public booking and job-application forms are rate limited per IP for guests: 5 bookings per 10 minutes and 3 applications per hour.

### Validation & security

- **Password policy.** Every new password (registration, changing your own, an admin setting one) must be 8 characters or more (at most 72 bytes: bcrypt ignores anything after that, so a longer password would be silently cut off) with a lowercase letter, an uppercase letter, a number and a special character, must not be your email or name, and must not be on a short list of very common passwords. The server rules live in `server/src/lib/password-policy.js` and answer `400 "Password needs: …"` listing what is missing; the web app mirrors them in `frontend/src/lib/validation/password.ts` and shows a live checklist, a strength meter, a show/hide toggle and a "Passwords match" check (`frontend/src/components/forms/`). Generated temporary passwords always meet the policy. Sign-in does not apply it, so the demo accounts keep using `password`.
- **Live form validation.** Register, sign-in, job application, booking and both account profile forms check each field when you leave it and then live as you type: email format, phone (digits, spaces, `+ ( ) - .`, 7–20 digits), names (1–80 characters), party size, booking dates not in the past, and length limits. Errors appear under the field and are linked with `aria-invalid` / `aria-describedby`. The helpers are pure functions in `frontend/src/lib/validation/`.
- **Server-side type checks.** The browser checks are a convenience; the API checks everything again (`server/src/lib/validate.js`). Each body field is type-checked (text, finite number, real boolean, list), trimmed and length-limited, and only known fields are read, so `role`, `id`, `passwordHash`, `tokenVersion` or `loyaltyPoints` in a body are ignored. JSON bodies over 100 KB get `413`; bodies must be JSON objects; any `__proto__`, `constructor` or `prototype` key is refused; query parameters must be single values.
- **SQL.** Data is kept in memory and saved to the relational tables on every change. All values travel as one bound JSON parameter (`$1`) per table; no user input is ever put into the SQL text, and table/column names must be plain identifiers. `server/test/data/sql-safety.test.js` records every statement and checks this, and `server/test-db/sql-safety.test.js` checks that a name like `Robert'); DROP TABLE users;--` is stored and restored as plain data.
- **Output.** React escapes all rendered text, there is no `dangerouslySetInnerHTML`, and the server-rendered status page escapes every value.

## Deployment

Live: **https://plate-and-flame-web.vercel.app** (web) and **https://plate-and-flame-api.vercel.app/api/health** (API).

Two Vercel projects, deployed with the Vercel CLI from their own folders:

| Project               | Folder      | Environment variables                         |
|-----------------------|-------------|-----------------------------------------------|
| `plate-and-flame-api` | `server/`   | `DATABASE_URL` (Neon pooled URL), `JWT_SECRET` |
| `plate-and-flame-web` | `frontend/` | `API_URL` = the API's public **https** URL (used by the `/api/*` rewrite at build time) |

Set the API project's `DATABASE_URL` to a remote PostgreSQL database and `JWT_SECRET` to a unique random value of at least 32 characters. Set the web project's `API_URL` to the API origin, including the scheme but no path (for example, `https://plate-and-flame-api.vercel.app`). A production web build rejects a missing or malformed `API_URL`, a localhost destination and a non-HTTPS origin; validation errors never print configured values. Local development can omit `API_URL` to use `http://localhost:4000`, and can leave `DATABASE_URL` empty to use the in-memory store.

**Production configuration is checked before it ships.** A production web build (`next build`) fails with a message naming `API_URL` when it is missing, not a valid URL, not `https://`, carries a path, query, fragment or credentials, or points at localhost, so a release can never quietly proxy to `localhost:4000`. When it starts in production the API always refuses to run without a real `JWT_SECRET` (the built-in development secret is rejected) or with a `DATABASE_URL` that is malformed, not PostgreSQL or points at localhost. A `JWT_SECRET` shorter than 32 characters, or no `DATABASE_URL` at all (data kept in memory and lost on restart), only logs a `[config]` warning and the API keeps running, so a live API is never taken down by a setting that could not be checked; set `STRICT_PRODUCTION_CONFIG=1` on the API project to make both of those refuse to start too, once the deployment's values are known to comply. Errors name the setting and never print its value. Local development is unaffected: `pnpm dev` needs no variables. To build for production on purpose without a real API (CI and the browser tests do), set `ALLOW_LOCAL_API=1`, for example `ALLOW_LOCAL_API=1 pnpm build`; it is ignored on Vercel Production. Preview deployments need their own `API_URL` (an https origin) in the Vercel project's Preview environment variables. The rules live in `frontend/src/lib/api-origin.mjs` and `server/src/lib/production-config.js` (with the secret rule in `server/src/lib/jwt.js`).

Optional for the web app: `NEXT_PUBLIC_WORKFORCE_MOCK=true` runs My work and the Workforce hub on in-browser demo data instead of the API (the unit tests do this). Only the exact value `true` enables it; anything else, or nothing, uses the real API. The demo layer (`frontend/src/lib/workforce-mock.ts`) is loaded lazily and is not part of a normal production build; `pnpm --dir frontend run check:bundle` (run after `next build`, and in CI) fails if its demo data ever appears in the build output. `workforce-api.ts` explains the one rule to keep that true: the flag comparison and the `import()` of the mock stay together inside `getWorkforceMock()`. In tests, `await getWorkforceMock()` gives the shared mock instance (for `.reset()`).

```bash
cd server && vercel deploy --prod      # API
cd frontend && vercel deploy --prod    # web
```

Before promoting a deployment, verify both projects with their production environment variables configured: `pnpm --dir server start` must start with the remote database and strong JWT secret, and `pnpm --dir frontend build` must complete with the HTTPS API origin. Then confirm `https://<web-host>/api/health` returns the API status page and `https://<api-host>/api/health?format=json` returns JSON.

### Databases: local PostgreSQL in dev, Neon in production

The app stores its data in a relational PostgreSQL schema (29 tables with foreign keys, constraints and indexes), defined in `server/schema/001_schema.sql` and seeded by `server/schema/002_seed.sql`. The same DDL runs in both environments, so the local database and the Neon production database have an identical shape. The full plan is in [DB_PLAN.md](DB_PLAN.md).

The server picks its Postgres driver from `DATABASE_URL` (`server/src/data/db.js`): a `*.neon.tech` host uses Neon's serverless driver (WebSockets), any other host uses the standard `pg` driver (TCP). So each environment only sets its own URL:

| Where | `DATABASE_URL` |
|---|---|
| Local dev (`pnpm dev`) | `server/.env`: a PostgreSQL on your PC, e.g. `postgres://postgres:PASSWORD@localhost:5432/agspm` |
| Production (`main`, Vercel) | Vercel API project env: the Neon pooled URL |
| CI and `pnpm test` | not set: in memory |

Local setup, once: install PostgreSQL for Windows (no Docker needed: `winget install PostgreSQL.PostgreSQL.17` or the EDB installer), create the database (`psql -U postgres -c "CREATE DATABASE agspm"` or in pgAdmin), copy `server/.env.example` to `server/.env` and set the URL, then run `pnpm --dir server db:init` to create the schema and load the demo data. On Neon run the same command with the extra `--yes-really` guard: `pnpm --dir server db:init -- --yes-really`. `pnpm --dir server test:db` runs the persistence tests against whichever database `DATABASE_URL` points at — they drop and recreate its `public` schema, so point it at a throwaway database (e.g. `createdb restaurant_test`), never at Neon production.

`server/.env` is gitignored and `.vercelignore` keeps it out of uploads. The server reads and writes the relational tables on every request (see DB_PLAN.md §8); the old `app_state` blob table is no longer used.

## API reference and status page (`/api/health`)

`GET /api/health` is content-negotiated:

- **In a browser** (`Accept: text/html`) it serves a live status page: every endpoint grouped by module, with its method, path, required roles, query/body fields, an example response shape and its live health. Probe results refresh every 15 s, with latency per endpoint, an up/down summary and a database indicator.
- **Anything else** (curl, `fetch`, uptime monitors) gets the JSON it always returned — `{ status: 'ok', service, time }` — plus `uptimeSeconds`, `persistence` and `endpoints`. Force either form with `?format=json` or `?format=html`.

| Endpoint                    | Returns |
|-----------------------------|---------|
| `GET /api/health`           | Status page (browser) or status JSON |
| `GET /api/health/endpoints` | The endpoint catalogue as JSON |
| `GET /api/health/check`     | Live probe results (cached for 5 s) |

The catalogue is read from the Express routers at runtime, so a new route shows up automatically. Its roles come from the `requireRole` guards, and its description from `server/src/lib/api-catalog.js`. A route with no entry there is listed as **undocumented**, and `test/lib/api-catalog.test.js` fails until you add one. Probes only send `GET` requests, with no token, over a loopback connection to the API itself. A 401/403 counts as "up, auth required". `POST`/`PUT`/`PATCH`/`DELETE` routes are never called. The health routes are mounted before the persistence middleware, so they never open a database transaction.

## What each module delivers

| Sprint | Module | Highlights |
|--------|--------|------------|
| 1 | Auth/RBAC + Customers | JWT login/registration, role guards (API + UI, 403 screen), customer ledger search/filter, order history newest-first, dietary/allergy preferences shown to waiter & chef |
| 2 | Menu | Item & category CRUD, modifiers with price deltas, dietary/allergen tags, personal allergy warnings, out-of-stock control (chef) |
| 3 | Orders | Customer orders (dine-in at table / pickup / delivery), staff orders, confirm, edit-before-confirm, per-item status, table assignment, live refresh |
| 4 | Kitchen (KDS) | Oldest-first queue, rush + manual reordering, elapsed timers with configurable delay flag, start/ready per item, ready-for-pickup list, waiter notifications |
| 5 | Billing | Itemized bills, tax + service charge + tip, split evenly or by items (cent-exact), paid/unpaid, printable receipts, manager refunds |
| 6 | Tables | Floor plan by zone with live status, add/edit tables, hold tables, auto-free when the bill closes |
| 7 | Reservations | Slot availability by party size, full-slot alternatives, confirm (customer notified), table holds at booking time, grace-period no-shows, cancellations |
| 8 | Inventory | Ingredient CRUD, recipes (bill of materials), auto-deduction on order close, stock movement log, low-stock alerts, supplier reorder form → purchase orders → receive |
| 9 | Staff | Public job applications → approval creates accounts, role assignment, suspend/remove (immediate), shift rota + personal schedule, performance metrics |
| 10 | Analytics | Revenue/order trends by day/week/month, top dishes by qty/revenue, table turnover & occupancy, peak hours, inventory health, no-show rate |
| 13–14 | Attendance & payroll — My work page and Workforce hub | Clock in/out and breaks, lateness with a grace period, automatic unpaid break on long days, missed shifts, presence board, day/week/month/hour-of-day analytics, monthly pay estimate (hours × wage + tips + bonuses − late penalties), admin wages and bonuses |
| 17 | Super admin & account governance | One super admin above every admin, bound to one email: manages admins, cannot be assigned or managed, at most one enforced by Postgres, bound on a database by a guarded script |

## Design decisions

- **Relational PostgreSQL schema.** The app uses a proper relational schema (29 tables, proper FKs, indexes) that runs identically on local PostgreSQL and Neon. The schema is defined in `server/schema/001_schema.sql` and seeded by `002_seed.sql`. The init script (`pnpm --dir server db:init`) handles both environments. Every API request reads and writes these tables; the old `app_state` blob is no longer used.
- **The server is the source of truth for money.** Prices, modifier deltas, tax, service charge, points and splits are all computed server-side in integer cents. Clients only send menu item IDs and selected options.
- **One permissions map.** `frontend/src/lib/permissions.ts` mirrors the API's `requireRole` guards, so the UI never offers an action the API would refuse.
- **Live updates via polling** every 5–10 s for orders, the KDS, the floor plan, billing and notifications. This meets "within a few seconds" without a websocket server.
