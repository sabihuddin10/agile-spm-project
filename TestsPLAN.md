# Tests Plan

In-depth, phased plan for the test suite across both the server and the frontend.
Tests are organized **module-wise**, mirroring the source directory structure
(`server/src/*` and `frontend/src/*`), and every test follows **Arrange-Act-Assert (AAA)**.

## Legend

- `[x]` — done: real tests written, passing, reviewed.
- `[ ]` — left: not written yet. On the frontend, most of these already have a
  `__tests__` scaffold file with `test.todo(...)` placeholders; "left" means the
  todo still needs a real implementation.

## Status at a glance

| Phase | Area | Done | Partial | Left | Total |
|---|---|---|---|---|---|
| 1 | Backend — route/acceptance tests | 10 | 0 | 0 | 10 |
| 2 | Backend — lib & middleware unit tests | 4 | 0 | 2 | 6 |
| 3 | Frontend — lib & context unit tests | 1 | 0 | 5 | 6 |
| 4 | Frontend — high-risk business components | 0 | 2 | 10 | 12 |
| 5 | Frontend — supporting/presentational components | 0 | 0 | 6 | 6 |
| 6 | Frontend — app pages | 0 | 0 | 21 | 21 |

"Partial" (Phase 4) = the module has one file with a real test (`menu-item-card`,
`profile-editor`) but other files in that same module folder are still `test.todo`.

(Phase 4/5 "modules" count by `components/<folder>`; several folders have more than
one file, each file gets its own `describe`/`test.todo` block within that module's test file.)

---

## Phase 0 — Infrastructure — `[x]` done

- [x] Backend test suite restructured module-wise: `server/test/{routes,lib,data}/` mirroring `server/src/{routes,lib,data}/`.
- [x] Frontend test runner set up: Vitest + React Testing Library, `jsdom` env, `@/` alias (`frontend/vitest.config.mts`, `vitest.setup.ts`).
- [x] `__tests__/` scaffolding created for every existing `app/*` and `components/*` module, mirroring that structure, with `test.todo(...)` placeholders (153 across 38 files).
- [x] Both suites wired into the CI Definition-of-Done gate (`.github/workflows/ci.yml`).

---

## Phase 1 — Backend: route / acceptance tests — `[x]` done (53/53 passing)

One file per route module in `server/src/routes/`, named after the user stories they satisfy.

| Module | File | User stories | Status |
|---|---|---|---|
| Auth & RBAC | `test/routes/auth.test.js` | US1.1, US1.2 (register) | `[x]` |
| Customers | `test/routes/customers.test.js` | US1.2–US1.5 | `[x]` |
| Menu | `test/routes/menu.test.js` | US2.1–US2.5 | `[x]` |
| Orders & kitchen | `test/routes/orders.test.js` | US3.1–US3.5, US4.1–US4.5 | `[x]` |
| Billing | `test/routes/billing.test.js` | US5.1–US5.5 | `[x]` |
| Tables / floor plan | `test/routes/tables.test.js` | US6.1, US6.2, US6.4 | `[x]` |
| Reservations | `test/routes/reservations.test.js` | US7.1–US7.4 | `[x]` |
| Inventory | `test/routes/inventory.test.js` | US8.1–US8.5 | `[x]` |
| Staff | `test/routes/staff.test.js` | US9.1–US9.5 | `[x]` |
| Analytics | `test/routes/analytics.test.js` | US10.1–US10.6 | `[x]` |
| Order pricing/splitting math | `test/lib/order-math.test.js` | US2.3, US5.2, US5.3 | `[x]` |
| Snapshot persistence | `test/data/snapshot.test.js` | whole-store round-trip | `[x]` |

Nothing left in this phase.

---

## Phase 2 — Backend: lib & middleware unit tests — `[ ]` not started

These files currently have **no dedicated unit tests** — they're only exercised indirectly
through the Phase 1 route tests. Isolated unit tests would pin down their edge cases
directly instead of relying on an HTTP round-trip to reach them.

| Module | File → target test | Functionality to cover |
|---|---|---|
| JWT signing/verification | `src/lib/jwt.js` → `test/lib/jwt.test.js` | `[x]` `signToken` produces a token `verifyToken` can decode back to the same payload; `[x]` `verifyToken` rejects a tampered/expired/garbage/wrong-secret token |
| Notifications | `src/lib/notify.js` → `test/lib/notify.test.js` | `[x]` `notify()` stores a notification addressable by `userId` or `role`; `[x]` `notificationsFor(user)` returns only notifications for that user's id/role, newest first, in-app channel only; `[x]` `serializeNotification` shapes the response and marks read/unread correctly; `[x]` the 1000-entry cap drops the oldest first |
| Date/time helpers | `src/lib/time.js` → `test/lib/time.test.js` | `[x]` `localDate`/`localTime` formatting; `[x]` `combine(date, time)` round-trips; `[x]` `addDays` across month/year boundaries; `[x]` `isValidDate`/`isValidTime` reject malformed input; `[x]` `weekStart` always returns the correct Monday |
| Order lifecycle helpers | `src/lib/orders.js` → `test/lib/orders.test.js` | `[ ]` `syncOrderStatus` derives order status from item statuses correctly; `[ ]` `confirmOrder`/`closeOrder`/`cancelOrder` transitions and guards; `[ ]` `markPaid`/`markUnpaid` idempotency; `[ ]` `occupyTable`/`releaseTable` table-state side effects; `[ ]` `deductStock`/`adjustStock`/`recordMovement` stock math and movement logging; `[ ]` `kitchenQueue`/`moveInQueue` ordering and rush/priority logic |
| Reservation helpers | `src/lib/reservations.js` → `test/lib/reservations.test.js` | `[ ]` `canAccommodate` capacity/overlap checks; `[ ]` `availability` slot generation; `[ ]` `suggestAlternatives` returns genuinely open nearby slots; `[ ]` `syncTableHolds`/`releaseHold` hold expiry; `[ ]` `isLate` grace-period boundary |
| Auth middleware | `src/middleware/auth.js` → `test/middleware/auth.test.js` | `[x]` `authenticate` accepts a valid token, rejects missing/invalid, rejects a deactivated user immediately (US9.4); `[x]` `optionalAuth` doesn't block anonymous requests; `[x]` `requireRole`/`requireAdmin` allow/deny per role correctly |

---

## Phase 3 — Frontend: `lib/` & `context/` unit tests

Pure logic and shared state — highest value-per-test, no rendering needed (except context, which needs a thin wrapper).

| Module | File → target test | Functionality to cover | Status |
|---|---|---|---|
| Menu helpers | `lib/menu.ts` → `lib/__tests__/menu.test.ts` | selections, pricing, allergy conflicts | `[x]` done |
| API client | `lib/api.ts` → `lib/__tests__/api.test.ts` | `[ ]` request builder attaches auth header/body correctly; `[ ]` `ApiError` carries status + parsed error body; `[ ]` `storeAuth`/`getStoredToken`/`getStoredUser`/`clearAuth` read/write storage correctly |
| Formatting helpers | `lib/format.ts` → `lib/__tests__/format.test.ts` | `[ ]` `money`/`percent` formatting incl. null/undefined; `[ ]` `localDateISO`/`addDaysISO`/`formatDate` correctness; `[ ]` `minutesSince`/`formatMinutes`/`timeAgo` boundary values (just now / minutes / hours / days); `[ ]` `modifierText` joins price deltas correctly; `[ ]` status-label maps (`ORDER_STATUS`, `ITEM_STATUS`, etc.) have an entry for every enum value |
| Role permissions | `lib/permissions.ts` → `lib/__tests__/permissions.test.ts` | `[ ]` `canAccess` matches `SECTION_ROLES` for every role × section pair; `[ ]` `isStaff` true only for non-customer roles; `[ ]` each `can.*` predicate matches its documented allowed roles |
| Auth context | `context/auth-context.tsx` → `context/__tests__/auth-context.test.tsx` | `[ ]` restores a stored session on mount, then re-validates with the server; `[ ]` `login`/`register`/`logout` update `user`/`token` and storage; `[ ]` `refreshUser` updates state on success, silently no-ops on failure; `[ ]` `hasRole` reflects the current user; `[ ]` reacts to the `auth:expired` event by clearing the session |
| Cart context | `context/cart-context.tsx` → `context/__tests__/cart-context.test.tsx` | `[ ]` add/remove/update line quantities; `[ ]` merges identical item+modifier selections into one line (`selectionKey`); `[ ]` computed totals update as lines change; `[ ]` cart persists/restores across remount if backed by storage; `[ ]` clearing the cart |

---

## Phase 4 — Frontend: high-risk business components

Components with real business logic, money/stock correctness, or multi-step flows — prioritize these
over presentational ones.

| Module | Files (✅ = already has a real test) | Functionality to cover | Status |
|---|---|---|---|
| `components/billing` | bill-list, bill-panel, bill-summary, bill-utils, payment-actions, receipt, refund-dialog, split-dialog, split-parts, tip-control, use-bill-action | `[ ]` itemized bill renders every line + modifier deltas; `[ ]` tip entry recalculates total; `[ ]` even/by-item split sums exactly to the total; `[ ]` pay/unpay toggles outstanding view; `[ ]` refund requires a reason and is manager-only in the UI; `[ ]` receipt only available once paid | `[ ]` |
| `components/orders` | allergy-banner, customer-lookup, edit-items-modal, kitchen-ticket, labels, new-order-modal, order-card, order-editor, order-history-table, order-progress, ready-ticket, use-order-menu | `[ ]` new-order flow builds a valid order payload; `[ ]` edit-items blocked after confirmation; `[ ]` kitchen ticket reflects item status and rush/priority; `[ ]` allergy banner shows for conflicting allergens; `[ ]` order-progress renders the correct step for each status | `[ ]` |
| `components/inventory` | helpers, ingredient-form, low-stock-banner, movements, purchase-orders, recipe-editor, recipes-panel, reorder-form, stock-adjust, stock-table | `[ ]` ingredient CRUD form validation; `[ ]` low-stock banner appears at/below reorder level; `[ ]` reorder form suggests the documented quantity; `[ ]` purchase-order receive updates stock; `[ ]` recipe editor rejects a zero/negative quantity | `[ ]` |
| `components/menu` | cart-drawer, category-manager, **menu-item-card ✅**, menu-item-form, menu-item-list, modifier-picker, public-menu | `[ ]` cart-drawer totals and line removal; `[ ]` category visibility toggle; `[ ]` modifier-picker enforces single- vs multi-choice; `[ ]` menu-item-form validation (price, required fields) | `[x]` menu-item-card / `[ ]` rest |
| `components/reservations` | new-booking-form, reservation-card, slot-grid, use-availability | `[ ]` slot-grid shows only available slots; `[ ]` booking form validates party size/date/time; `[ ]` `use-availability` reloads when date/party size change | `[ ]` |
| `components/tables` | floor-legend, status-style, table-form, table-tile | `[ ]` table-tile renders the correct status color/label; `[ ]` table-form validates duplicate numbers; `[ ]` status-style maps every `TableStatus` | `[ ]` |
| `components/customers` | customer-detail, customer-form, customer-table, preference-options | `[ ]` customer-table search/filter; `[ ]` customer-form validation (email, required fields); `[ ]` preference chips toggle dietary/allergy values | `[ ]` |
| `components/staff` | account-table, all-accounts-panel, applications-panel, careers-form, confirm-dialog, credentials-modal, my-schedule, performance-panel, role-meta, shift-form, shift-planner, team-panel | `[ ]` application approve/reject flow; `[ ]` shift-form rejects overlapping/inverted shifts; `[ ]` role-change reflected in account-table; `[ ]` confirm-dialog blocks until confirmed | `[ ]` |
| `components/analytics` | analytics-card, analytics-dashboard, analytics-format, chart-setup, inventory-health, kpi-tiles, peak-hours-chart, range-controls, reservation-stats, revenue-trend-chart, table-utilization, top-dishes | `[ ]` `analytics-format` helpers format numbers/percentages correctly; `[ ]` range-controls change the requested granularity/period; `[ ]` kpi-tiles render the right values from a given summary payload | `[ ]` |
| `components/auth` | login-form, register-form | `[ ]` login-form validates and submits credentials, shows server errors; `[ ]` register-form validates password length/email and submits | `[ ]` |
| `components/booking` | booking-form | `[ ]` validates name/email/date/time; `[ ]` shows alternative slots on a 409 conflict; `[ ]` success state shows the booking reference | `[ ]` |
| `components/account` | active-order-card, my-orders, my-reservations, order-history, **profile-editor ✅** | `[ ]` my-orders/my-reservations list the signed-in customer's own records only; `[ ]` order-history sorted newest first | `[x]` profile-editor / `[ ]` rest |

---

## Phase 5 — Frontend: supporting / presentational components

Lower risk (mostly rendering/props-driven), but still part of "every module has tests."

| Module | Files | Functionality to cover | Status |
|---|---|---|---|
| `components/layout` | dev-shell, menu-drawer, mobile-bottom-nav, notification-bell, staff-layout, staff-shell, storefront-shell | `[ ]` nav renders the links permitted for the current role; `[ ]` notification-bell shows unread count | `[ ]` |
| `components/overview` | live-tile, low-stock-banner, next-shift-card, overview-dashboard, quick-links, role-widgets, use-overview-data | `[ ]` role-widgets render only the widgets relevant to the signed-in role | `[ ]` |
| `components/scrum` | sprint-card | `[ ]` renders sprint metadata passed in via props | `[ ]` |
| `components/settings` | settings-form | `[ ]` tax/service-charge rate form validation and submit | `[ ]` |
| `components/storefront` | cart-lines, checkout-estimate, checkout-form, flame-mark, item-options-modal, order-placed, qty-stepper, status-pill | `[ ]` checkout-estimate totals match `lib/menu` pricing; `[ ]` qty-stepper min/max clamping; `[ ]` item-options-modal (already indirectly covered by `menu-item-card` test — add its own direct test) | `[ ]` |
| `components/tables` *(status-style)* | covered under Phase 4 | — | `[ ]` |
| `components/ui` | badge, card, empty-state, modal, page-header, spinner, toast | `[ ]` modal traps focus/closes on Escape and backdrop click; `[ ]` toast auto-dismiss timing; `[ ]` empty-state renders given message/action | `[ ]` |

---

## Phase 6 — Frontend: app pages

Thin wrapper tests: each page renders without crashing, shows its primary heading, and
(for staff pages) is gated to the right roles. Lower complexity than components since most
logic lives in the components they render.

| Page | Status |
|---|---|
| `app/page.tsx` (home) + `app/layout.tsx` — **not yet scaffolded, add first** | `[ ]` |
| `app/account` | `[ ]` |
| `app/book` | `[ ]` |
| `app/careers` | `[ ]` |
| `app/dev` | `[ ]` |
| `app/login` | `[ ]` |
| `app/menu` | `[ ]` |
| `app/register` | `[ ]` |
| `app/staff` (overview) | `[ ]` |
| `app/staff/analytics` | `[ ]` |
| `app/staff/billing` | `[ ]` |
| `app/staff/customers` | `[ ]` |
| `app/staff/inventory` | `[ ]` |
| `app/staff/kitchen` | `[ ]` |
| `app/staff/menu` | `[ ]` |
| `app/staff/orders` | `[ ]` |
| `app/staff/reservations` | `[ ]` |
| `app/staff/schedule` | `[ ]` |
| `app/staff/settings` | `[ ]` |
| `app/staff/tables` | `[ ]` |
| `app/staff/users` | `[ ]` |

---

## Suggested execution order

1. **Phase 2** (backend lib/middleware) — pure functions, fast to write, de-risks the logic every route test already depends on indirectly.
2. **Phase 3** (frontend lib/context) — same reasoning on the frontend; `permissions.ts` and `cart-context.tsx` gate/compute things many components rely on.
3. **Phase 4** (high-risk components) — billing → orders → inventory → menu (remaining files) → reservations/tables → customers/staff → analytics → auth/booking → account (remaining files). Money, stock, and order-lifecycle correctness first.
4. **Phase 5** (supporting components) — lower risk, fill in after Phase 4.
5. **Phase 6** (app pages) — thin wrappers, do last; add the two missing root scaffolds (`app/page.tsx`, `app/layout.tsx`) first.

## Keeping this plan current

Tick a box here in the same PR/commit that adds the real test it describes. If a module's
functionality changes, update its "functionality to cover" bullets in the same change —
this file should never describe tests that no longer match the code.
