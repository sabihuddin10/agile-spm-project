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
| Pay | Monthly: hours worked × hourly wage − late deductions (setting, default 5.00 each) + bonuses. |
| Bonuses | Admin only, with amount, reason and date (for example Eid, birthday). |
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

## Sprint 13 — Attendance & Time Tracking (Should)

| Module | Change | Tests |
|---|---|---|
| `server/src/data/store.js`, `seed-history.js` | `attendance` collection `{ id, userId, shiftId, clockIn, clockOut, lateMinutes }`, seeded from past shifts so charts have history; included in the persisted snapshot | `server/test/data/snapshot.test.js` |
| `server/src/lib/attendance.js` | Session matching to shifts, lateness with grace, per-day and per-month hours (worked vs scheduled) | `server/test/lib/attendance.test.js` |
| `server/src/routes/attendance.js` | `POST /attendance/clock-in`, `POST /attendance/clock-out`, `GET /attendance/me?from&to`, `GET /attendance/users/:id` (self, managers for waiters and chefs, admin for all) | `server/test/routes/attendance.test.js`, access matrix |
| `server/src/routes/settings.js` | `lateGraceMinutes` (0–60) | `server/test/routes/settings.test.js` |
| `frontend/src/components/attendance` | Clock in/out control, hours-per-day and hours-per-month charts (Chart.js, as analytics), late markers | `components/attendance/__tests__` |
| `frontend/src/app/staff/account` | Hours section on My account; team attendance from Staff management | page tests |

Branches: `feat/attendance-api`, `feat/attendance-ui`.

## Sprint 14 — Payroll (Should)

| Module | Change | Tests |
|---|---|---|
| `server/src/data/store.js` | `wages` (per user, effective-from date) and `payAdjustments` (bonuses, with reason and date) | `server/test/data/snapshot.test.js` |
| `server/src/lib/payroll.js` | Monthly payslip: hours × wage (per effective rate), late deductions, bonuses, net | `server/test/lib/payroll.test.js` |
| `server/src/routes/payroll.js` | `GET /payroll/me?month`, `GET /payroll/users/:id?month` (admin), `GET /payroll?month` (admin overview), `PUT /payroll/users/:id/wage` (admin), `POST`/`DELETE /payroll/users/:id/adjustments` (admin) | `server/test/routes/payroll.test.js`, access matrix |
| `server/src/routes/settings.js` | `latePenalty` (0–1000) | `server/test/routes/settings.test.js` |
| `frontend/src/components/payroll` | Payslip, pay history chart, wage editor, bonus form, admin overview table | `components/payroll/__tests__` |
| `frontend/src/app/staff/account`, `app/staff/payroll` | Pay section on My account; admin-only Payroll page | page tests |

Branches: `feat/payroll-api`, `feat/payroll-ui`.

## Order

Sprint 12 first (in progress). Sprint 13 builds on it. Sprint 14 needs Sprint 13's recorded hours. When a sprint merges, its status in `backlog.ts` changes to `done`.
