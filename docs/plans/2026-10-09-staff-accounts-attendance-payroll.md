# Staff accounts, attendance and payroll — module plan

Sprints 12–14 in `frontend/src/data/backlog.ts` (shown on `/dev`). Sprint 11 records the quality, security and operations work already delivered.

Each sprint ships through the usual flow: one `feat/<name>` branch per part, cut from `development`, full CI gate, merged into `development`, then `development` into `main`. Tests are module-wise and follow Arrange-Act-Assert (see `TestsPLAN.md`).

## Rules this plan implements

| Rule | Value |
|---|---|
| Rank | admin > manager > chef = waiter. Customers are outside it. |
| Managing another account | Only one strictly below your own rank. Never yourself, never a peer. |
| Self-service | Every staff member edits their own name, email, phone and password. Email and password changes need the current password. |
| Temporary passwords | Issued on hire or reset, shown once, must be replaced at next sign-in. A reset or password change signs out other sessions. |
| Time worked | Clock-in/clock-out sessions. Scheduled shift hours not worked are shown as missed and unpaid. |
| Late arrival | Clock-in later than shift start + grace (setting, default 5 minutes). |
| Pay | Monthly estimate: paid hours × hourly wage + tips + bonuses − late deductions (setting, default 5.00 each). |
| Breaks | Unpaid. More than 6 worked hours with no recorded break → an automatic 1-hour unpaid break (both settings). |
| Tips | Waiters earn the tips on bills they served; included in their pay. |
| Bonuses | Admin only, with amount, reason and date (for example Eid, birthday). |
| Presence | Waiters see waiters, chefs see chefs; managers see managers, waiters and chefs; the admin sees everyone (working / on break / off). |
| Who sees what | Everyone sees their own attendance and pay. Managers see waiters' and chefs' attendance, never wages or pay. The admin sees everything about everyone. |

## Sprint 12 — Staff Accounts & Hierarchy (Must)

| Module | Change | Tests |
|---|---|---|
| `server/src/lib/hierarchy.js` | `RANK`, `canManage(actor, target)` | `server/test/lib/hierarchy.test.js` |
| `server/src/data/store.js` | Users gain `phone`, `mustChangePassword`, `tokenVersion` (not exposed) | via route tests |
| `server/src/lib/jwt.js`, `middleware/auth.js` | Tokens carry the version; older tokens are refused after a password change or reset | `server/test/routes/auth.test.js` |
| `server/src/routes/auth.js` | `PATCH /auth/me`, `POST /auth/me/password`, `PATCH /auth/users/:id/profile`, `POST /auth/users/:id/reset-password`; role/suspend/remove refuse another admin | `server/test/routes/auth.test.js`, `access-matrix.test.js` |
| `server/src/routes/staff.js` | Approved hires get `mustChangePassword` | `server/test/routes/auth.test.js` |
| `frontend/src/lib/permissions.ts`, `api.ts`, `types` | `ROLE_RANK`, `canManageAccount`, new `authApi` calls, `account` section | `lib/__tests__/permissions.test.ts` |
| `frontend/src/app/staff/account` | My account page: role and capabilities, profile form, change password, temporary-password notice | `app/staff/account/__tests__` |
| `frontend/src/components/staff` | Edit details and Reset password on accounts below your rank; shell banner for temporary passwords | `components/staff/__tests__`, `components/layout/__tests__` |

Branches: `feat/account-hierarchy-api` (server), `feat/staff-account-page` (frontend).

## Sprint 13 — Attendance & My Work (Should)

Built frontend first so the screens can be reviewed before the backend: the UI ships with an in-browser demo data layer (`frontend/src/lib/workforce-mock.ts`, on while `NEXT_PUBLIC_WORKFORCE_MOCK` is not `false`) that implements the same API contract the server will.

| Module | Change | Tests |
|---|---|---|
| `frontend/src/components/workforce` | Time clock (check in, start/end break, check out), progress rings, sessions table, breakdown charts (day / week / month / hour of day), colleagues-now presence | `components/workforce/__tests__` |
| `frontend/src/app/staff/my-work` | My work page for every staff role | page tests |
| `server/src/data/store.js`, `seed-history.js` | `attendance` sessions `{ userId, date, clockIn, clockOut, breaks[], shiftId, late, lateMinutes }`, seeded from past shifts; persisted in the snapshot | `server/test/data/snapshot.test.js` |
| `server/src/lib/attendance.js` | Paid minutes (recorded breaks, automatic 1-hour break after 6 h with none), lateness with grace, missed shifts, day/week/month/hour series | `server/test/lib/attendance.test.js` |
| `server/src/routes/attendance.js` | `GET /attendance/me`, `POST /attendance/clock-in`, `/clock-out`, `/break/start`, `/break/end`, `GET /attendance/presence` (same level; managers also waiters and chefs; admin everyone) | `server/test/routes/attendance.test.js`, access matrix |
| `server/src/routes/settings.js` | `lateGraceMinutes`, `autoBreakMinutes`, `autoBreakAfterHours` | `server/test/routes/settings.test.js` |

## Sprint 14 — Payroll & Workforce Hub (Should)

| Module | Change | Tests |
|---|---|---|
| `frontend/src/components/workforce` | Pay estimate breakdown, staff overview table with mini rings, wage editor, bonus form | `components/workforce/__tests__` |
| `frontend/src/app/staff/workforce` | Workforce hub (manager: no money; admin: everything) with drill-down per person | page tests |
| `server/src/lib/payroll.js` | Paid hours × wage + tips (bills a waiter served) + bonuses − late penalties; "estimated" until month end | `server/test/lib/payroll.test.js` |
| `server/src/routes/workforce.js` | `GET /workforce/me`, `GET /workforce/users/:id` (admin; managers for waiters/chefs without pay), `GET /workforce/overview?month`, `PUT /workforce/users/:id/wage`, `POST`/`DELETE /workforce/users/:id/adjustments` (admin) | `server/test/routes/workforce.test.js`, access matrix |
| `server/src/routes/settings.js` | `latePenalty` | `server/test/routes/settings.test.js` |

## Order

1. Sprint 13 + 14 UI on the demo data layer (`feat/workforce-ui`), reviewed on localhost.
2. Backend to the same contract (`feat/workforce-api`), then the demo layer is switched off.
3. When each sprint merges, its status in `backlog.ts` changes to `done`.
