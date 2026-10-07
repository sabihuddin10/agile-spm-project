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
| 2 | Backend — lib & middleware unit tests | 6 | 0 | 0 | 6 |
| 3 | Frontend — lib & context unit tests | 6 | 0 | 0 | 6 |
| 4 | Frontend — high-risk business components | 2 | 10 | 0 | 12 |
| 5 | Frontend — supporting/presentational components | 5 | 0 | 1 | 6 |
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
| Order lifecycle helpers | `src/lib/orders.js` → `test/lib/orders.test.js` | `[x]` `syncOrderStatus` derives order status from item statuses correctly; `[x]` `confirmOrder`/`closeOrder`/`cancelOrder` transitions and guards; `[x]` `markPaid`/`markUnpaid` idempotency; `[x]` `occupyTable`/`releaseTable` table-state side effects; `[x]` `deductStock`/`adjustStock`/`recordMovement` stock math and movement logging; `[x]` `kitchenQueue`/`moveInQueue` ordering and rush/priority logic |
| Reservation helpers | `src/lib/reservations.js` → `test/lib/reservations.test.js` | `[x]` `canAccommodate` capacity/overlap checks; `[x]` `availability` slot generation; `[x]` `suggestAlternatives` returns genuinely open nearby slots; `[x]` `syncTableHolds`/`releaseHold` hold expiry; `[x]` `isLate` grace-period boundary |
| Auth middleware | `src/middleware/auth.js` → `test/middleware/auth.test.js` | `[x]` `authenticate` accepts a valid token, rejects missing/invalid, rejects a deactivated user immediately (US9.4); `[x]` `optionalAuth` doesn't block anonymous requests; `[x]` `requireRole`/`requireAdmin` allow/deny per role correctly |

---

## Phase 3 — Frontend: `lib/` & `context/` unit tests

Pure logic and shared state — highest value-per-test, no rendering needed (except context, which needs a thin wrapper).

| Module | File → target test | Functionality to cover | Status |
|---|---|---|---|
| Menu helpers | `lib/menu.ts` → `lib/__tests__/menu.test.ts` | selections, pricing, allergy conflicts | `[x]` done |
| API client | `lib/api.ts` → `lib/__tests__/api.test.ts` | `[x]` request builder attaches auth header/body correctly; `[x]` `ApiError` carries status + parsed error body; `[x]` `storeAuth`/`getStoredToken`/`getStoredUser`/`clearAuth` read/write storage correctly; `[x]` a 401 on a protected page clears the session and redirects to login |
| Formatting helpers | `lib/format.ts` → `lib/__tests__/format.test.ts` | `[x]` `money`/`percent` formatting incl. null/undefined; `[x]` `localDateISO`/`addDaysISO`/`formatDate` correctness; `[x]` `minutesSince`/`formatMinutes`/`timeAgo` boundary values (just now / minutes / hours / days); `[x]` `modifierText` joins price deltas correctly; `[x]` status-label maps (`ORDER_STATUS`, `ITEM_STATUS`, etc.) have an entry for every enum value |
| Role permissions | `lib/permissions.ts` → `lib/__tests__/permissions.test.ts` | `[x]` `canAccess` matches `SECTION_ROLES` for every role × section pair; `[x]` `isStaff` true only for non-customer roles; `[x]` each `can.*` predicate matches its documented allowed roles |
| Auth context | `context/auth-context.tsx` → `context/__tests__/auth-context.test.tsx` | `[x]` restores a stored session on mount, then re-validates with the server; `[x]` `login`/`register`/`logout` update `user`/`token` and storage; `[x]` `refreshUser` updates state on success, silently no-ops on failure; `[x]` `hasRole` reflects the current user; `[x]` reacts to the `auth:expired` event by clearing the session |
| Cart context | `context/cart-context.tsx` → `context/__tests__/cart-context.test.tsx` | `[x]` add/remove/update line quantities; `[x]` merges identical item+modifier selections into one line (`selectionKey`); `[x]` computed totals update as lines change; `[x]` cart persists/restores across remount if backed by storage; `[x]` clearing the cart; `[x]` a different account signing in clears the cart |

---

## Phase 4 — Frontend: high-risk business components

Components with real business logic, money/stock correctness, or multi-step flows — prioritize these
over presentational ones.

| Module | Files (✅ = already has a real test) | Functionality to cover | Status |
|---|---|---|---|
| `components/billing` | bill-list, bill-panel, **bill-summary ✅**, **bill-utils ✅**, **payment-actions ✅**, receipt, **refund-dialog ✅**, split-dialog, **split-parts ✅**, **tip-control ✅**, **use-bill-action ✅** | `[x]` itemized split sums exactly to the total (`previewEvenSplit`/`previewItemSplit`); `[x]` tip entry (presets + custom, locked once a share is paid); `[x]` split shares pay/undo and the sum-check banner; `[x]` pay/unpay toggles outstanding view, requires a confirm step; `[x]` refund requires a reason, amount bounds, manager-only in the UI; `[ ]` `bill-list`/`bill-panel` (container components) and `receipt`/`split-dialog` left as scaffolded todos | `[ ]` partial |
| `components/orders` | **allergy-banner ✅**, customer-lookup, edit-items-modal, kitchen-ticket, **labels ✅**, new-order-modal, order-card, order-editor, **order-history-table ✅**, **order-progress ✅**, ready-ticket, **use-order-menu ✅** | `[x]` allergy banner/flags shows for conflicting allergens; `[x]` order-progress renders the correct step for each status; `[x]` order-history-table lists closed/cancelled orders; `[x]` useOrderMenu/useMenuIndex load and index the menu; `[ ]` new-order flow builds a valid order payload; `[ ]` edit-items blocked after confirmation; `[ ]` kitchen ticket reflects item status and rush/priority — `customer-lookup`/`edit-items-modal`/`kitchen-ticket`/`new-order-modal`/`order-card`/`order-editor`/`ready-ticket` left as scaffolded todos | `[ ]` partial |
| `components/inventory` | **helpers ✅**, ingredient-form, **low-stock-banner ✅**, movements, purchase-orders, **recipe-editor ✅**, recipes-panel, reorder-form, **stock-adjust ✅**, stock-table | `[x]` low-stock banner appears at/below reorder level, role-gated reorder CTA; `[x]` recipe editor rejects a zero/blank quantity, computes food cost, blocks duplicate ingredients; `[x]` stock-adjust receive(+)/waste(-) deltas, blocks over-wasting; `[x]` helpers: suggestedQty, recipeCost, movementLabel, signedQty; `[ ]` ingredient CRUD form validation; `[ ]` reorder form suggests the documented quantity; `[ ]` purchase-order receive updates stock — `ingredient-form`/`movements`/`purchase-orders`/`recipes-panel`/`reorder-form`/`stock-table` left as scaffolded todos | `[ ]` partial |
| `components/menu` | cart-drawer, **category-manager ✅**, **menu-item-card ✅**, menu-item-form, menu-item-list, **modifier-picker ✅**, public-menu | `[x]` category create/rename/toggle-visibility/delete-when-empty; `[x]` modifier-picker enforces single- (radio, replaces) vs multi-choice (checkbox, toggles), shows price deltas; `[ ]` cart-drawer totals and line removal; `[ ]` menu-item-form validation (price, required fields) — `cart-drawer`/`menu-item-form`/`menu-item-list`/`public-menu` left as scaffolded todos | `[ ]` partial |
| `components/reservations` | new-booking-form, reservation-card, **slot-grid ✅**, **use-availability ✅** | `[x]` slot-grid shows only available slots (lunch/dinner groups, past vs full), selects a slot; `[x]` `use-availability` reloads when date/party size change and never shows a stale date's slots | `[ ]` partial |
| `components/tables` | floor-legend, **status-style ✅**, table-form, table-tile | `[x]` status-style maps every `TableStatus` to a distinct tile/dot class; `[ ]` table-tile renders the correct status color/label; `[ ]` table-form validates duplicate numbers | `[ ]` partial |
| `components/customers` | customer-detail, customer-form, **customer-table ✅**, preference-options (covered indirectly via `components/account/profile-editor`) | `[x]` customer-table search/filter (CustomerFilters: search, clear filters); `[ ]` customer-form validation (email, required fields) | `[ ]` partial |
| `components/staff` | account-table, all-accounts-panel, applications-panel, careers-form, **confirm-dialog ✅**, **credentials-modal ✅**, my-schedule, performance-panel, **role-meta ✅**, **shift-form ✅**, shift-planner, team-panel | `[x]` shift-form rejects an inverted (end before start) shift, confirms before delete, creates/edits/saves status; `[x]` confirm-dialog blocks (disables buttons, ignores close) while busy; `[x]` role-meta: role ranking, initials, time/hours math, week start; `[ ]` application approve/reject flow; `[ ]` role-change reflected in account-table — `account-table`/`all-accounts-panel`/`applications-panel`/`careers-form`/`my-schedule`/`performance-panel`/`shift-planner`/`team-panel` left as scaffolded todos | `[ ]` partial |
| `components/analytics` | analytics-card, analytics-dashboard, **analytics-format ✅**, chart-setup, **inventory-health ✅**, **kpi-tiles ✅**, peak-hours-chart, **range-controls ✅**, reservation-stats, revenue-trend-chart, table-utilization, top-dishes | `[x]` `analytics-format` helpers format numbers/percentages/dates correctly, flags partial buckets; `[x]` range-controls presets/custom dates change the requested period; `[x]` kpi-tiles render the right values and no-data hints; `[x]` inventory-health ranks at-risk items first, toggles healthy items — `analytics-card`/`analytics-dashboard`/`chart-setup`/`peak-hours-chart`/`reservation-stats`/`revenue-trend-chart`/`table-utilization`/`top-dishes` left as scaffolded todos | `[ ]` partial |
| `components/auth` | **login-form ✅**, **register-form ✅** | `[x]` login-form validates and submits credentials, routes by role, shows server errors, demo-account quick-fill; `[x]` register-form validates name/email/password length/match and submits | `[x]` done |
| `components/booking` | **booking-form ✅** | `[x]` validates name/email/date/time; `[x]` shows alternative slots on a 409 conflict; `[x]` success state shows the booking confirmation | `[x]` done |
| `components/account` | active-order-card, my-orders, my-reservations, **order-history ✅**, **profile-editor ✅** | `[x]` order-history sorted newest first, receipt button gating, refund display, pagination; `[ ]` my-orders/my-reservations list the signed-in customer's own records only — `active-order-card`/`my-orders`/`my-reservations` left as scaffolded todos | `[ ]` partial |

---

## Phase 5 — Frontend: supporting / presentational components

Lower risk (mostly rendering/props-driven), but still part of "every module has tests."

| Module | Files | Functionality to cover | Status |
|---|---|---|---|
| `components/layout` | **dev-shell, menu-drawer, mobile-bottom-nav, notification-bell, staff-layout, staff-shell, storefront-shell ✅** | `[x]` nav renders only the links permitted for the current role (dev-shell, mobile-bottom-nav, staff-shell); `[x]` notification-bell loads, shows unread count, opens/marks read/mark-all-read, navigates on click; `[x]` staff-layout loading/redirect-anonymous/redirect-customer/403-forbidden-then-redirect; `[x]` menu-drawer role-aware links + Escape/sign-out close; `[x]` storefront-shell cart button, guest vs signed-in vs staff header | `[x]` done |
| `components/overview` | **live-tile, low-stock-banner, next-shift-card, overview-dashboard, quick-links, role-widgets, use-overview-data ✅** | `[x]` role-widgets (Floor/Kitchen/TodaySummary) render only the widgets relevant to the signed-in role, with correct flags/hints; `[x]` use-overview-data role-based fetch skipping, error toast-once, loaded/updatedAt state; `[x]` overview-dashboard greeting, connecting/live state, composes child widgets by role access | `[x]` done |
| `components/scrum` | **sprint-card ✅** | `[x]` renders sprint metadata (number, module, goal, priority, lead, points, story count); `[x]` Planned/Delivered badge by status; `[x]` expand/collapse a story's acceptance criteria & evidence, one at a time | `[x]` done |
| `components/settings` | **settings-form ✅** | `[x]` loading/error states; `[x]` manager can view & edit, waiter sees a read-only disabled form; `[x]` dirty indicator + Reset; `[x]` client-side required-field validation; `[x]` save success toast; `[x]` server range-validation error mapped onto the matching field with friendly units | `[x]` done |
| `components/storefront` | cart-lines, checkout-estimate, checkout-form, flame-mark, item-options-modal, order-placed, qty-stepper, status-pill | `[ ]` checkout-estimate totals match `lib/menu` pricing; `[ ]` qty-stepper min/max clamping; `[ ]` item-options-modal (already indirectly covered by `menu-item-card` test — add its own direct test) | `[ ]` |
| `components/tables` *(status-style)* | covered under Phase 4 | — | `[ ]` |
| `components/ui` | **badge, card, empty-state, modal, page-header, spinner, toast ✅** | `[x]` modal closes on close-button/Escape/backdrop click but not on inner-panel click; `[x]` toast fire/dismiss + tone-specific styling + throws outside provider; `[x]` empty-state/card/page-header render given title/subtitle/action; `[x]` badge tone classes | `[x]` done |

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
