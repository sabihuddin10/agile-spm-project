# Work Plan

A living plan for the work after Sprints 13–14. Work is split into small phases.
Each phase follows the same flow:

1. Build on a `feat/<name>` branch.
2. Pass the six CI checks (see `CLAUDE.md`).
3. Merge into `development`.
4. Release `development` → `main`.

If a phase grows too big, it is split, never stretched. Update this file whenever a phase changes status.

## Legend

- `[x]` done: merged into `main`
- `[~]` in progress: built, being verified, or merged into `development` but not released yet
- `[ ]` planned: not started

## Status at a glance

| Phase | Theme | Sprint | Status |
|---|---|---|---|
| 1 | Workforce: attendance, payroll, My work, Workforce hub | 13–14 | [x] |
| 2 | Web `/api/health` page on the main site | 14 | [x] |
| 3 | Shared UI base + late-booking fix | 15 | [x] |
| 4 | Admin UI polish, batch 1 + input safety | 15 | [x] |
| 5 | Admin UI polish, batch 2: staff, workforce, settings | 15 | [~] |
| 6a | Live validation, submit disabled until valid, customer rules | 16 | [~] |
| 6b | Screen-side checks matching server limits | 16 | [~] |
| 6c | Placeholders on every input | 16 | [~] |
| 7a | Hardening and browser checks | 16 | [ ] |
| 7b | Branch and worktree clean-up (needs team OK) | 16 | [ ] |
| 8 | Open product questions | 16 | [ ] |

---

## Phase 1: Workforce [x]

**Goal:** staff can clock in and out, and managers can see hours and pay.

- [x] Attendance, presence and payroll API (`server/src/routes/workforce.js`, `server/src/lib/attendance.js`)
- [x] My work page for each staff member, and the Workforce hub for managers and admins
- [x] Sprint 13–14 docs marked delivered

## Phase 2: Health page on the main site [x]

**Goal:** `/api/health` opens on the web domain, not only on the API domain.

- [x] Route handler `frontend/src/app/api/health/route.ts`, which proxies JSON and renders HTML from the catalogue
- [x] `pnpm --dir server run export:health` keeps the frontend copy in sync, and a test fails if it is stale

## Phase 3: Shared UI base + late-booking fix [x]

**Goal:** give every admin screen the same building blocks, and fix a real bug that shows up after midnight.

- [x] Shared `ConfirmDialog`, icon set, `.btn-sm` / `.btn-success`, 44px tap targets on touch screens
- [x] Reservations: late, still-confirmed bookings from last night stay on the "upcoming" list after midnight, so staff can still seat them or mark a no-show

## Phase 4: Admin UI polish, batch 1 + input safety [x]

**Goal:** the admin screens follow the UI/UX review (accessible, phone-first, not AI-looking), and every API input is type-checked.

- [x] Shell: accessible modal, toast, spinner, staff drawer, phone-first overview and analytics
- [x] Inventory, menu, customers: phone card layouts, confirm dialogs instead of `window.confirm`, keyboard tabs, allergy pills
- [x] Floor, kitchen, orders, reservations, billing: accessible dialogs, keyboard tabs, phone-first cards
- [x] Password policy on the server and in the UI: 8+ characters, mixed case, a number, a special character, not common, not your name or email
- [x] Server input guards:
  - finite numbers within ranges
  - real booleans
  - length caps
  - 100 KB body limit
  - `__proto__` keys rejected
  - query arrays rejected
- [x] SQL-injection audit and the `test/data/sql-safety.test.js` regression test (no issues found)

**Done when:** all six checks pass on `development` and it is merged into `main`.

**Verified so far:** each branch passed lint, tsc, the full Vitest suite (854–855 tests) and the production build on its own. Server: 352/352 tests. Combined `development` (75fc09d) passed the full gate (352 server tests, 910 frontend tests, build) and GitHub CI. Released to `main` as 5c3e48c on 2026-10-10.

**Left out of this phase on purpose (moved, not dropped):**
- Screen-side checks that match the new server limits → Phase 6. Today the server returns a clear error message, so nothing breaks.
- Browser check of the phone layouts and print view → Phase 7. jsdom cannot test CSS breakpoints.
- Phone card list for the customer table → Phase 7.
- Category delete through the dialog has no page test, because CategoryManager is mocked → Phase 7.
- Inventory text fields sent as `null` are stored as the string "null" (old behaviour) → Phase 7.

## Phase 5: Admin UI polish, batch 2 [~]

**Goal:** the same polish for the staff, workforce and settings screens.

- [x] Row-actions menu, confirm dialogs, lazy-loaded charts, phone-first tables (branch verified: 854/854 tests, build OK)
- [x] Fix: warm the lazy chart modules before the workforce page tests (14b7ae5)
- [x] Merged into `development` after the Phase 4 release
- [ ] Gate passes and it is released to `main`

**Done when:** the branch is merged and released. Nothing else is in scope.

**Left out of this phase on purpose:** shift form placeholder and 500-character notes limit → Phase 6.

## Phase 6: Formik/Yup-style validation + placeholders [~]

**Goal:** forms behave the way users expect from modern sites.

- [ ] Errors update live while typing; an untouched form shows no red
- [ ] Submit button stays disabled until the whole form is valid, with a short note saying what is missing
- [ ] Live password checklist on every password field
- [ ] Customers need a real name (3+ letters or two words) plus an email or a phone, enforced on the server as well
- [ ] Staff forms check the same rules as the server before submitting:
  - staff booking
  - customer
  - account edit
  - menu
  - inventory
  - billing
  - tables
- [ ] A correct, realistic placeholder on every text input (labels stay)
- [ ] Shift form: placeholder and the 500-character notes limit (moved from Phase 5)
- [ ] Optional: block a 51st order line (server limit is 50)

**Released in three slices, in order.** Each slice is one commit on `feat/form-guards`, merged and released on its own:
- **6a:** live errors, submit disabled until valid, password checklist, customer name + contact rule (frontend and server)
- **6b:** staff form checks matching the server limits, plus the shift-form notes limit
- **6c:** placeholders everywhere

**Done when (each slice):** its tests are updated, all six checks pass, and it is merged into `main` before the next slice merges.

## Phase 7a: Hardening and browser checks [ ]

- [ ] Redeploy the API Vercel project, which is not git-connected and is stale
- [ ] Browser check of the phone layouts and print view, which jsdom cannot test
- [ ] Phone card list for the customer table, which has no fixed width today
- [ ] Page test for menu category delete through the confirm dialog
- [ ] Inventory text fields: treat `null` as empty instead of the string "null"

## Phase 7b: Clean-up [ ]

- [ ] Remove merged branches and old worktrees (after the team agrees)

## Phase 8: Open product questions [ ]

- [ ] Should a single super-admin manage the other admins?

---

## Order of work

Phases are finished and released one at a time: 4 → 5 → 6a → 6b → 6c → 7a → 7b. Any phase that grows too big is split the same way. Later phases can be built in parallel on their own branches, but they merge into `development` only after the phase before them reaches `main`. This keeps each gate small and quick.

## Rules of the road

- Flow is always `feat/<name>` → `development` → `main`. No direct commits to `main` or `development`.
- A phase is done only when all six CI checks pass. A test that times out under load is re-run once on its own before it counts as a real failure.
- Tests stay module-wise with `// Arrange // Act // Assert` comments (see `TestsPLAN.md`).
- Every delivered feature is also added to the sprint docs.
