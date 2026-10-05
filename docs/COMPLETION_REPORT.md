# Backlog Completion Increment — Report

**Project:** Plate & Flame — Restaurant Operations & Ordering Platform
**Date:** 5 October 2026
**Scope:** Bring the working software in line with the full Product Backlog (10 modules, 49 stories, 217 points) and the Sprint Definition of Done.

---

## 1. Summary

| | Before this increment | After |
|---|---|---|
| Stories fully meeting their acceptance criteria | 1 of 49 | **49 of 49** |
| Production build (`next build`) | Failing (TypeScript error) | Passing |
| Automated tests | None | **51 acceptance tests**, one file per sprint |
| Lint | No ESLint config | ESLint clean; server syntax check |
| CI pipeline | None | GitHub Actions: lint, tests, type check, build |
| Critical defects | 5 open (see §3) | 0 open |

Every story's acceptance criteria now have an automated test and a demo path. The in-app Scrum board (`/dev`) shows both when you expand a story.

## 2. How the work was run

1. **Backlog audit.** Each of the 49 stories in `Product_Backlog.docx` was checked against its Given/When/Then acceptance criteria in the running code, and classed as *met*, *partial*, *missing* or *broken*. Result: 1 met, 19 partial, 20 missing, 9 broken.
2. **Prioritisation.** The same two rules as the Product Backlog were used: technical dependency first, then business value (MoSCoW). The broken *Must* items came first, especially access control, which blocked every staff screen. Next came the core order-to-cash path (Menu, Order, Kitchen, Billing). *Should* and *Could* modules followed.
3. **Shared foundation, then modules in parallel.** The data model, API and a shared frontend layer (types, API client, permission map, live-refresh hook) were built first. Module screens were then built in parallel against that stable contract.
4. **Definition of Done.** Each module was checked against the DoD in `Sprint_Backlogs.docx`:
   - an automated acceptance test per story;
   - lint, type check and production build all clean;
   - role-specific UI checked in a real browser at desktop and phone widths;
   - no open critical defects.

## 3. Defects found and fixed

| # | Defect | Impact | Fix |
|---|--------|--------|-----|
| 1 | Role guard used the *highest* role in each allowed list (`Math.max`) | Waiter, Chef and Manager got 403 on every staff screen; only Admin could work | Guard now checks exact role membership. Same fix in the UI navigation. Covered by the US1.1 test |
| 2 | Reservations API mounted without authentication | Staff reservation list returned 401 for everyone, and **anyone could delete any booking** without logging in | Optional auth on public routes; staff and owner checks on every change |
| 3 | `POST /orders` trusted a customer-supplied `customerId` | A customer could spend another customer's loyalty points | Customer orders always use the caller's own profile |
| 4 | Menu changes required a user that was never attached | Menu management returned 401 for every role | Auth attached to menu routes |
| 5 | Type error in `auth-context.tsx` | `next build` failed, so the app could not be deployed | Fixed; the build is now part of CI |
| 6 | Billing page called `.toFixed()` on a null tax value | Billing page crashed on seeded orders | Tax always computed server-side in cents |
| 7 | Customer ledger filters never re-queried | Search and filters did nothing | Fixed with debounced reload |
| 8 | Changing a tip or re-splitting after one guest had paid | Would erase that guest's recorded payment | API returns 409 once any share is paid. Found in code review during this increment; regression test added |

## 4. Story status

Legend for **Before**: ✅ met · 🟡 partial · ❌ missing · 🐞 broken. Every story is now **Done**. Tests live in `server/test/`. Demo paths are on the Scrum board.

| Sprint | Story | Before | What was delivered |
|---|---|---|---|
| 1 | US1.1 RBAC for 5 roles | 🐞 | Exact-role guards on every route; one permissions map drives the UI; 403 screen redirects to the user's own dashboard |
| 1 | US1.2 Register / edit profile | ✅ | Kept; email validation and duplicate-email protection added |
| 1 | US1.3 Search/filter ledger | 🐞 | Filters reload results; "no results" state |
| 1 | US1.4 Order history & totals | 🟡 | History comes from real orders, newest first; spend is net of refunds |
| 1 | US1.5 Dietary/allergy prefs | 🟡 | Allergy banner on waiter order cards and chef kitchen tickets; "None recorded" when empty |
| 2 | US2.1 Item CRUD | 🐞 | Works for Manager/Admin; changes appear on the live menu |
| 2 | US2.2 Categories | 🟡 | Empty or hidden categories don't appear on the customer menu |
| 2 | US2.3 Modifiers | ❌ | Options carry price deltas; customers and waiters choose them when adding a dish; server prices every line |
| 2 | US2.4 Dietary/allergen tags | 🟡 | Customers see a warning on dishes containing their recorded allergens |
| 2 | US2.5 Out of stock | 🐞 | Customers already saw sold-out dishes, but staff could not mark them (defect 4). Chefs can now toggle availability only |
| 3 | US3.1 Place order | 🟡 | Dine-in at a table, pickup or delivery; card or cash; Flame Points; clear message if a dish sells out |
| 3 | US3.2 Confirm order | 🟡 | Confirm routes the order to the kitchen; line items editable only before confirmation |
| 3 | US3.3 Lifecycle tracking | 🟡 | placed → confirmed → preparing → ready → served → closed; all screens refresh every 5–10 s |
| 3 | US3.4 Item-level status | 🟡 | Each dish has its own status, shown in every view |
| 3 | US3.5 Attach to table | ❌ | Waiter "New order" with a table, or assign one later; shows on the floor plan |
| 4 | US4.1 Kitchen queue | 🟡 | Confirmed orders only, oldest first, position numbers |
| 4 | US4.2 In preparation | ❌ | Per-dish Start |
| 4 | US4.3 Mark ready | 🟡 | Per-dish Ready; separate "ready for pickup" list |
| 4 | US4.4 Waiter notified | ❌ | In-app notification bell with unread badge for the assigned waiter |
| 4 | US4.5 Prioritise & time | ❌ | Elapsed timers, delay flag after a threshold set in Settings, Rush, move up/down |
| 5 | US5.1 Itemized bill | 🐞 | Itemized bill with modifier deltas; printable |
| 5 | US5.2 Tax, service, tip | ❌ | Manager-set tax and service-charge rates as separate lines; tip by % or amount |
| 5 | US5.3 Split bill | ❌ | Split evenly or by items; shares always sum to the cent; each share paid separately |
| 5 | US5.4 Paid / unpaid | 🟡 | Mark paid (card/cash) or unpaid; outstanding view excludes paid bills |
| 5 | US5.5 Receipt / refund | ❌ | Printable receipts (staff and customer); manager refunds with reason; revenue reported net of refunds |
| 6 | US6.1 Tables & zones | ❌ | Add/edit tables with number, seats and zone |
| 6 | US6.2 Live floor plan | 🟡 | Grouped by zone, colour-coded status, active orders and next booking, live refresh |
| 6 | US6.3 Assign table to order | ❌ | See US3.5 |
| 6 | US6.4 Occupied/free | 🟡 | Table frees itself when the order closes, unless held |
| 7 | US7.1 Book a slot | 🐞 | Availability by party size; full slots rejected with up to 3 alternatives; status "requested" |
| 7 | US7.2 Manage status | 🐞 | Staff confirm; customer notified in-app, guest email logged |
| 7 | US7.3 Table for reservation | 🟡 | Assigned table shows *Reserved* from an hour before the booking |
| 7 | US7.4 No-shows & cancellations | 🐞 | No-show only after the grace period; cancel or no-show releases the table |
| 8 | US8.1 Ingredient CRUD | 🟡 | Full CRUD in the UI; stock adjustments logged |
| 8 | US8.2 Recipes (BOM) | ❌ | Recipe editor per dish |
| 8 | US8.3 Auto-deduct | ❌ | Closing an order deducts recipe × quantity exactly once; stock movement log |
| 8 | US8.4 Low-stock alerts | 🟡 | Manager notification on crossing the threshold, plus dashboard banner |
| 8 | US8.5 Reorder form | ❌ | Suggested quantities, printable, submit to supplier, mark received to restock |
| 9 | US9.1 Onboard & approve | ❌ | Public careers form → approval creates the account with a temporary password |
| 9 | US9.2 Assign roles | 🐞 | Admin role changes take effect on the user's next request |
| 9 | US9.3 Shift schedules | ❌ | Weekly rota for managers; "My schedule" for every staff member |
| 9 | US9.4 Suspend / remove | 🟡 | Suspend, reactivate and remove; access blocked on the next request; can't lock yourself out |
| 9 | US9.5 Performance | ❌ | Orders taken and served, revenue, tips, dishes prepared, prep time, shifts, hours |
| 10 | US10.1 Revenue/order trends | ❌ | Chart.js trend by day, week or month over any date range |
| 10 | US10.2 Top dishes | 🟡 | Ranked by quantity and by revenue |
| 10 | US10.3 Table turnover | ❌ | Turnover time and occupancy % per table and zone |
| 10 | US10.4 Peak hours | ❌ | Orders by hour of day |
| 10 | US10.5 Inventory health | 🟡 | Low and near-threshold ingredients, ranked by risk |
| 10 | US10.6 No-show rate | ❌ | No-show % and cancellation rate for the period |

Analytics needs history, so the API seeds 60 days of realistic orders, bookings and shifts. A fixed random seed makes the history identical on every restart.

## 5. Definition of Done

| DoD item (Sprint_Backlogs.docx) | Status |
|---|---|
| Code passes CI (build + lint + tests) | ✅ `.github/workflows/ci.yml`; locally: 51/51 tests, lint clean, build passes |
| All acceptance criteria verified manually or by automated test | ✅ Automated test per story; key flows also walked through in a real browser (below) |
| UI reviewed for the relevant roles, responsive and usable | ✅ Every screen opened as each role; no runtime errors; no horizontal overflow at 390 px |
| No known critical defects | ✅ All 8 defects in §3 fixed |
| Deployed to staging and demoed at Sprint Review | ⏳ Team step: no staging environment is configured in the repo |
| WPDS entry completed | ⏳ Team step |

**Browser walkthrough performed** (headless Chrome against the running app):
1. Customer orders a Large Margherita with Mushrooms plus a Hummus Plate, dine-in at Table 5, paying cash.
2. Waiter confirms. Chef taps Start all, then All ready. The waiter's bell shows the notification. Waiter marks it served.
3. The bill shows the modifier line, 5% service charge and 10% tax ($36.23). It is split two ways ($18.12 + $18.11) and both shares are paid.
4. The order closes, Table 5 returns to free, the inventory log shows "Sale #1872" deductions, and the customer can open the receipt in their account.

## 6. Decisions and changes to the original plan

- **Storage.** The proposal named Firebase/Firestore. The working software uses an in-memory store with generated seed data, so it runs without cloud credentials and every demo starts from the same state. Trade-off: data resets on restart. Persistence is the top item for the next backlog.
- **Live updates** use 5–10 s polling rather than websockets. This meets "within a few seconds" (US3.3, US4.1, US6.2) with no extra infrastructure.
- **Money** is computed only on the server, in integer cents, so splits and refunds always reconcile.
- **Redux, Formik and Yup** from the proposal turned out to be unnecessary: React Context and plain controlled forms were enough. Formik and Yup are still listed as dependencies and can be removed.

## 7. Demo script (about 10 minutes)

Restart the app shortly before the demo (`pnpm dev`). Seed times are relative to server start, so "live" orders look fresh.

1. **`/dev` Scrum board.** 49 stories and 217 points. Expand a story to show its acceptance criteria, demo path and test file. Point out the Definition of Done panel.
2. **Customer** (`customer@rest.test`). On `/menu`, Peanut Satay is flagged for the peanut allergy. Add a Large pizza with extras and the price updates. Check out dine-in at a table. In `/account`, the order is tracked live.
3. **Waiter** (`waiter@rest.test`). In Orders, the new order has an allergy banner. Edit it, then confirm. The Floor plan shows zones and a table held for a booking.
4. **Chef** (`chef@rest.test`). The KDS shows a rush order and a delay flag. Start and ready dishes. Try `/staff/analytics` to show the 403 screen and redirect.
5. **Waiter.** The bell shows "ready" notifications. Serve the order. In Billing, add a tip, split by items, take both payments, and print the receipt.
6. **Manager** (`manager@rest.test`). Inventory shows the sale deductions, low-stock banner and reorder form. Staff management covers the rota and performance. Analytics: switch Day, Week and Month; top dishes; peak hours; no-show rate. Settings: change the service charge.
7. **Tests.** Run `pnpm test` to show the 51 acceptance tests named by story ID.

## 8. Next backlog candidates

1. Persistent database (Firestore as originally proposed, or SQLite/Postgres).
2. Staging deployment (Vercel for the web app plus a hosted API) to close the last DoD item.
3. Real email for booking confirmations; currently logged as simulated email.
4. Payment provider integration; payments are currently recorded, not processed.
5. Browser-level end-to-end tests in CI (e.g. Playwright) alongside the API tests.
6. Remove unused dependencies (Formik, Yup) and the stale `package-lock.json` files, since pnpm is the package manager.
