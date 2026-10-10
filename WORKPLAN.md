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
| 5 | Admin UI polish, batch 2: staff, workforce, settings | 15 | [x] |
| 6a | Live validation, submit disabled until valid, customer rules | 16 | [x] |
| 6b | Screen-side checks matching server limits | 16 | [x] |
| 6c | Placeholders on every input | 16 | [x] |
| 7a | Hardening and browser checks | 16 | [~] |
| 7b | Branch and worktree clean-up (needs team OK) | 16 | [ ] |
| 8 | Open product questions | 16 | [ ] |
| 9 | Phone numbers: digits only, one +92 format | 16 | [~] paused |
| 10a | Harmic-style responsive sizes, site-wide | 16 | [~] paused |
| 10b | Responsive sweep: storefront, admin ops, admin people | 16 | [~] paused |

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

## Phase 5: Admin UI polish, batch 2 [x]

**Goal:** the same polish for the staff, workforce and settings screens.

- [x] Row-actions menu, confirm dialogs, lazy-loaded charts, phone-first tables (branch verified: 854/854 tests, build OK)
- [x] Fix: warm the lazy chart modules before the workforce page tests (14b7ae5)
- [x] Merged into `development` after the Phase 4 release
- [x] Gate passed (396 server tests, 920 frontend tests, build) and released to `main` as 64c50c3 on 2026-10-10

**Done when:** the branch is merged and released. Nothing else is in scope.

**Left out of this phase on purpose:** shift form placeholder and 500-character notes limit → Phase 6.

## Phase 6: Formik/Yup-style validation + placeholders [x]

**Goal:** forms behave the way users expect from modern sites.

- [x] **6a** (06866dc, released to `main` as 201f198: 397 server tests, 931 frontend tests): errors update live while typing; an untouched form shows no red
- [x] **6a**: submit button stays disabled until the whole form is valid, with a short note saying what is missing
- [x] **6a**: live password checklist on every password field
- [x] **6a**: names need 3+ letters or two words, so "SS" is refused; customers need an email or a phone, enforced on the server as well
- [x] **6b** (37ec310, released to `main` as 3a46c0b: 397 server tests, 944 frontend tests): staff forms check the same rules as the server before submitting, and their save buttons stay disabled until valid:
  - staff booking
  - customer
  - account edit
  - menu
  - inventory
  - billing
  - tables
- [x] **6c** (fc8745e, released to `main` as 52bd982: 397 server tests, 945 frontend tests): a correct, realistic placeholder on every text input (labels stay), with darker placeholder text so it stays readable
- [x] **6c** (a938073): shift form placeholder, 500-character notes limit and counter (moved from Phase 5)
- [x] **6b**: block a 51st order line in the cart and the staff order editor (server limit is 50)

**Released in three slices, in order.** Each slice is one commit on `feat/form-guards`, merged and released on its own:
- **6a:** live errors, submit disabled until valid, password checklist, customer name + contact rule (frontend and server)
- **6b:** staff form checks matching the server limits, plus the shift-form notes limit
- **6c:** placeholders everywhere

**Done when (each slice):** its tests are updated, all six checks pass, and it is merged into `main` before the next slice merges.

## Phase 7a: Hardening and browser checks [~]

- [ ] **Reconnect both Vercel projects to GitHub (needs the user or Burhan).** Found 2026-10-10: neither `plate-and-flame-web` nor `plate-and-flame-api` deploys from `main`, so the live site is about 3 days old and `/staff/workforce` returns 404. Set web root `frontend` and api root `server`, production branch `main`, then redeploy.
- [ ] Browser check of the phone layouts and print view, which jsdom cannot test (manual, needs a person)
- [x] Phone card list for the customer table (a193847)
- [x] Page test for menu category delete through the confirm dialog (a193847)
- [x] Inventory text fields: treat `null` as empty instead of the string "null" (0e17ef2)
- [x] "(optional)" field hint made readable, stone-500 (92ac7cf)
- [x] Slot grid tests pinned to a far-future date; they failed after 19:00 on 2026-10-10 because they hard-coded that date
- [x] Released to `main` as 7c9194d (398 server tests, 949 frontend tests)
- [x] Audit of the interrupted staff/workforce/settings helper: all 9 brief tasks are on `main`; the remaining story IDs are only in code comments

## Phase 7b: Clean-up [ ]

- [ ] Remove merged branches and old worktrees (after the team agrees)

## Phase 8: Open product questions [ ]

- [ ] Should a single super-admin manage the other admins?

---

## Order of work

Phases are finished and released one at a time: 4 → 5 → 6a → 6b → 6c → 7a → 7b. Any phase that grows too big is split the same way. Later phases can be built in parallel on their own branches, but they merge into `development` only after the phase before them reaches `main`. This keeps each gate small and quick.

## Phase 9: Phone number format [~] paused

**Goal:** like the university roll-number example (typed 22k4347, always stored as 22K-4347), phone fields accept digits only and always become one format.

- [x] Shared `formatPhoneInput` formats as you type: 0300…, 92300…, 0092… or 300… → "+92 300 1234567"; non-digits vanish (`frontend/src/lib/validation/fields.ts`)
- [x] Server `phone()` in `server/src/lib/validate.js` normalises the same way and rejects anything that is not a Pakistani mobile
- [x] All 7 phone fields wired (register flow forms, careers, booking, profile, staff profile, customer, staff booking, account edit); seed phones converted to +92
- [~] Server tests: mostly updated; auth.test.js (~line 186) and the customers search test still use old numbers
- [ ] Frontend tests that type old-style numbers (customers, account-profile-form, edit-account-modal, booking-form, reservations, orders fixtures)
- [ ] Unit tests for `formatPhoneInput`, then lint, tsc and the full gate

Branch `feat/phone-format`, WIP commit 90deb0b (pushed). **The user asked for this to go to `development` and `main` directly once green**, still through the gate.

## Phase 10a: Harmic-style responsive sizes [~] paused

**Goal:** buttons, headings and inputs are not oversized on phones. Sizes are copied from the user's Harmic storefront (`D:/SIRPProject-internship/front`, `src/index.css` type tokens; buttons h-9, lg:h-10, full-width CTA h-10, lg:h-12).

- [x] Fluid type scale (clamp) for every Tailwind text size (`tailwind.config.ts` fontSize → CSS vars in `globals.css`)
- [x] `.btn` min 36px (40px from lg), `.btn-sm` 32px, `.input` 40px; touch screens keep 16px input text (no iOS zoom); removed the 44px touch rule for text buttons
- [x] Lint + tsc pass. Commit 137bba7 on `feat/responsive-scale` (pushed)
- [ ] Merge into `development`, gate, release to `main`

## Phase 10b: Responsive sweep [~] paused

Three parallel branches built on 10a, each owning separate files:
- [~] `feat/responsive-storefront`: customer pages and components (WIP commit)
- [~] `feat/responsive-admin-ops`: staff shell, components/ui, orders, kitchen, tables, reservations, billing, staff menu, inventory, customers, analytics (WIP commit)
- [~] `feat/responsive-admin-people`: users, workforce, My work, account, schedule, performance, settings; components staff/workforce/settings/forms (WIP commit)

To resume: finish each branch (remove redundant breakpoint font steps, hand-sized buttons → .btn classes, icon buttons h-9 w-9, compact phone paddings, no horizontal scroll at 360px), run lint, tsc and touched tests, then merge after 10a, one at a time, each through the gate.

## Rules of the road

- Flow is always `feat/<name>` → `development` → `main`. No direct commits to `main` or `development`.
- A phase is done only when all six CI checks pass. A test that times out under load is re-run once on its own before it counts as a real failure.
- Tests stay module-wise with `// Arrange // Act // Assert` comments (see `TestsPLAN.md`).
- Every delivered feature is also added to the sprint docs.
