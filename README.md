# Plate & Flame — Restaurant Operations & Ordering Platform

A full-stack restaurant operations platform built as a 10-sprint Agile/Scrum project. It covers the whole flow from **customer orders** through **waiter confirms**, **kitchen prepares** and **waiter serves**, to **bill settled**, and from there **inventory deducts** and **analytics update**. Five stakeholder roles each get their own permissions and screens.

All **10 modules / 49 user stories / 217 story points** of the Product Backlog are implemented. Each story's acceptance criteria are checked by an automated test (`server/test/`, one file per sprint). Each story also has a demo path, listed on the in-app **Scrum board** (`/dev`).

## Monorepo layout

```
.
├── server/                 Express 4 REST API (in-memory store, persisted to Neon Postgres)
│   ├── api/index.js        Vercel serverless entry (vercel.json routes every path here)
│   ├── src/app.js          app factory (routes + middleware)
│   ├── src/data/           store.js (data model + live seed), seed-history.js (60 days of history),
│   │                       snapshot.js + persist.js + db.js (Neon persistence)
│   ├── src/lib/            order-math (money/splits), orders (lifecycle), reservations (capacity/holds), notify
│   ├── src/routes/         auth, customers, menu, orders, tables, reservations, billing,
│   │                       inventory, staff, analytics, notifications, settings
│   ├── test/               acceptance tests per sprint (node:test, in memory)
│   └── test-db/            persistence tests against a real Neon database
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
| Storage    | In-memory store, persisted to Neon Postgres when `DATABASE_URL` is set |
| Hosting    | Vercel: API and web as two projects (see *Deployment*)                |
| Tests / CI | `node:test` acceptance tests, ESLint (next/core-web-vitals), GitHub Actions |

## Getting started

Requires Node 18+ (CI uses Node 22) and pnpm (`corepack enable`).

```bash
pnpm install          # installs server + frontend workspaces
pnpm dev              # API on :4000, web on :3000
```

Open http://localhost:3000. The API base is http://localhost:4000/api (Next proxies `/api/*` to it).

| Command                     | What it does                                   |
|-----------------------------|------------------------------------------------|
| `pnpm test`                 | API acceptance + unit tests, in memory (53 tests, US1.1–US10.6) |
| `pnpm --dir server test:db` | Persistence tests against Neon (needs `DATABASE_URL`) |
| `pnpm --dir server db:reset`| Reseed the persisted demo data in Neon          |
| `pnpm --dir server lint`    | Syntax-check every server file                 |
| `pnpm --dir frontend lint`  | ESLint for the web app                         |
| `pnpm build`                | Production build of the web app (includes type check) |

### Demo accounts (password: `password`)

| Role     | Email               | Try this                                                    |
|----------|---------------------|-------------------------------------------------------------|
| Admin    | admin@rest.test     | Staff management → roles, suspend/remove; everything else   |
| Manager  | manager@rest.test   | Analytics, inventory reorder form, shifts, refunds, settings |
| Chef     | chef@rest.test      | Kitchen display: start/ready items, rush & reorder queue     |
| Waiter   | waiter@rest.test    | Orders, floor plan, reservations, billing, notifications     |
| Customer | customer@rest.test  | Order with modifiers, dine-in/pickup/delivery, bookings, receipts |

Also seeded: `chef2@rest.test` (Cara Cook) and `waiter2@rest.test` (Wendy Server), so staff performance has more than one person to compare.

## Roles and permissions

Each role gets what its job needs. Reversing money, deleting history, and changing staffing, pricing or policy need a manager.

| Role | Can | Cannot |
|---|---|---|
| **Customer** | Browse the menu, order (online or at their table), cancel their own order before the kitchen accepts it (refunded if prepaid), book a table, see their own orders, bookings, bills and profile | See other guests' data or anything staff-only |
| **Waiter** | Take, confirm, edit (before confirmation) and serve orders; assign tables, set table status and holds; handle reservations; add and edit customers; take payment (tip, split, pay); edit their own details and password (My account) | Reverse a payment, cancel a paid order, refund, delete customers, see recipes, edit the menu, inventory, shifts, analytics or settings |
| **Chef** | Run the kitchen queue (start, ready, rush, reorder), toggle dish availability, see recipes, see inventory and record stock counts; edit their own details and password (My account) | Billing, customers, tables, reservations, menu prices or recipes, purchase orders, shifts |
| **Manager** | Everything operational: menu and recipes, inventory and purchase orders, refunds and payment reversals, cancelling paid orders, deleting customers (only those with no order history), shifts and roster, approving waiter/chef applications, analytics, settings, viewing accounts; edit details and reset passwords of waiters and chefs | Manage another manager's or an admin's account, change roles, suspend or delete accounts, approve managers |
| **Admin** | Everything, including the details, passwords, roles and status of managers, waiters and chefs | Manage another admin's account (admins look after their own) |

Accounts follow a rank, admin > manager > chef = waiter: you can manage only accounts strictly below yours, and your own account is self-service on **My account**. Email and password changes need your current password, except that an admin changes their own password without it and can type a new password for anyone below them. A manager's password reset issues a one-time temporary password, which the person must replace at next sign-in. Changing or resetting a password signs out that account's other sessions.

Every staff member clocks their own attendance and sees their own hours and pay estimate (`/api/attendance`, `/api/workforce`); managers see waiters' and chefs' attendance but never wages or pay, only the admin sees and edits wages, bonuses and everyone's pay, and the "who's working now" board shows waiters to waiters, chefs to chefs, managers plus waiters and chefs to managers, and all staff to the admin.

The server enforces this with `requireRole` guards, plus handler checks where a rule depends on the record (an order's owner, a paid order, a chef editing only availability). `server/test/routes/access-matrix.test.js` calls every guarded endpoint as a guest and as each role, and fails if a route is added without an entry. The UI hides the same actions through `frontend/src/lib/permissions.ts`. The public booking and job-application forms are rate limited per IP for guests: 5 bookings per 10 minutes and 3 applications per hour.

### Validation & security

- **Password policy.** Every new password (registration, changing your own, an admin setting one) must be 8–128 characters with a lowercase letter, an uppercase letter, a number and a special character, must not be your email or name, and must not be on a short list of very common passwords. The server rules live in `server/src/lib/password-policy.js` and answer `400 "Password needs: …"` listing what is missing; the web app mirrors them in `frontend/src/lib/validation/password.ts` and shows a live checklist, a strength meter, a show/hide toggle and a "Passwords match" check (`frontend/src/components/forms/`). Generated temporary passwords always meet the policy. Sign-in does not apply it, so the demo accounts keep using `password`.
- **Live form validation.** Register, sign-in, job application, booking and both account profile forms check each field when you leave it and then live as you type: email format, phone (digits, spaces, `+ ( ) - .`, 7–20 digits), names (1–80 characters), party size, booking dates not in the past, and length limits. Errors appear under the field and are linked with `aria-invalid` / `aria-describedby`. The helpers are pure functions in `frontend/src/lib/validation/`.
- **Server-side type checks.** The browser checks are a convenience; the API checks everything again (`server/src/lib/validate.js`). Each body field is type-checked (text, finite number, real boolean, list), trimmed and length-limited, and only known fields are read, so `role`, `id`, `passwordHash`, `tokenVersion` or `loyaltyPoints` in a body are ignored. JSON bodies over 100 KB get `413`; bodies must be JSON objects; any `__proto__`, `constructor` or `prototype` key is refused; query parameters must be single values.
- **SQL.** Data is kept in memory and saved as one compressed snapshot in Postgres. Every statement is a fixed, parameterised query (`$1`, `$2`); no user input or key is ever put into the SQL text. `server/test/data/sql-safety.test.js` records every statement and checks this, and that a name like `Robert'); DROP TABLE app_state;--` is stored and restored as plain data.
- **Output.** React escapes all rendered text, there is no `dangerouslySetInnerHTML`, and the server-rendered status page escapes every value.

## Deployment

Live: **https://plate-and-flame-web.vercel.app** (web) and **https://plate-and-flame-api.vercel.app/api/health** (API).

Two Vercel projects, deployed with the Vercel CLI from their own folders:

| Project               | Folder      | Environment variables                         |
|-----------------------|-------------|-----------------------------------------------|
| `plate-and-flame-api` | `server/`   | `DATABASE_URL` (Neon pooled URL), `JWT_SECRET` |
| `plate-and-flame-web` | `frontend/` | `API_URL` = the API's URL (used by the `/api/*` rewrite at build time) |

Optional for the web app: `NEXT_PUBLIC_WORKFORCE_MOCK=true` runs My work and the Workforce hub on in-browser demo data instead of the API (the unit tests do this).

```bash
cd server && vercel deploy --prod      # API
cd frontend && vercel deploy --prod    # web
```

For local persistence put `DATABASE_URL=...` in `server/.env` (gitignored; `.vercelignore` keeps it out of uploads). Optional `STATE_KEY` picks the `app_state` row (default `main`).

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

## Design decisions

- **In-memory store, persisted as one snapshot in Neon Postgres.** The proposal planned Firebase/Firestore. The team kept a seeded in-memory store so the app runs anywhere with no cloud credentials. Seed data is generated relative to the day it is first written: 60 days of history, live orders in progress, tonight's bookings and this week's rota. When `DATABASE_URL` is set, each API request locks the `app_state` row, reloads the store if another serverless instance saved a newer version, and saves the gzip-compressed snapshot (about 90 KB) before responding. Writes are therefore serialised and each one rewrites the whole snapshot: fine for a course demo, not for real traffic. Without `DATABASE_URL` the API stays purely in memory and resets on restart. Design: `docs/specs/2026-10-07-neon-persistence-design.md`.
- **The server is the source of truth for money.** Prices, modifier deltas, tax, service charge, points and splits are all computed server-side in integer cents. Clients only send menu item IDs and selected options.
- **One permissions map.** `frontend/src/lib/permissions.ts` mirrors the API's `requireRole` guards, so the UI never offers an action the API would refuse.
- **Live updates via polling** every 5–10 s for orders, the KDS, the floor plan, billing and notifications. This meets "within a few seconds" without a websocket server.
