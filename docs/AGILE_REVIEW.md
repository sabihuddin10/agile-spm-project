# Software Project Management · Agile Review

**Plate & Flame — Restaurant Operations & Ordering Platform**  
*How we planned, built and reviewed it with Scrum*

- **Repository:** [github.com/sabihuddin10/agile-spm-project](https://github.com/sabihuddin10/agile-spm-project)
- **Live Web App:** [plate-and-flame-web.vercel.app](https://plate-and-flame-web.vercel.app)
- **Live API Status:** [plate-and-flame-api.vercel.app/api/health](https://plate-and-flame-api.vercel.app/api/health)
- **Date:** 15 November 2026
- **Metrics:** 17 sprints · 82 user stories · 355 story points · 10 pull requests · 133 CI runs (127 green) · 1,446 automated tests

**Team:**  
Sabih Uddin Meraj, Burhanuddin Khatri, Fozan Javaid, Shaheer Zafar, Shahaan Khalid, Syed Okasha Shoaib, Shah Anas Khan, Kahlil Ahmed, Muhammad Zain Abbas

---

## 1. Executive Summary

Plate & Flame is a full-stack restaurant operations platform: customers order and book online, waiters run the floor and bills, chefs work a kitchen display, managers control menu, stock, staff and analytics, and admins administer accounts — with a single super admin above them. It was built with Scrum in 17 sprints covering 82 user stories (355 story points), every one of which is marked done on the in-app Scrum board (`/dev`) with its acceptance criteria and the test that verifies it. Delivery is evidenced by 10 pull requests, 65 feature branches, 51 releases from development to main and 133 CI runs, and the product is live on Vercel with a Neon PostgreSQL database.

---

## 2. Product and Stakeholders

Restaurants often run on paper orders, verbal kitchen hand-offs and notebook bookings. The platform digitises the full cycle: customer orders → waiter confirms → kitchen prepares → waiter serves → bill settled → stock deducted → analytics updated.

| Role | Main capabilities |
|---|---|
| **Customer** | Menu with modifiers and allergen warnings, dine-in / pickup / delivery orders, bookings, receipts, profile |
| **Waiter** | Orders, floor plan, reservations, customer ledger, billing (tips, splits) |
| **Chef** | Kitchen display (start/ready, rush, reorder), dish availability, recipes, stock counts |
| **Manager** | Menu and recipes, inventory and purchase orders, refunds, shifts, hiring, analytics, settings |
| **Admin** | Everything, plus roles, suspension and removal of accounts below admin; wages and payroll |
| **Super admin** | Everything an admin can, plus managing admins; bound to one email, never assignable (Sprint 17) |

---

## 3. How We Applied Scrum

| Scrum element | How it was implemented | Evidence |
|---|---|---|
| **Product Backlog** | Epics per module, INVEST stories with Given/When/Then criteria, Fibonacci points, MoSCoW priority | `Product_Backlog.docx`; `frontend/src/data/backlog.ts`; Scrum board `/dev` |
| **Sprint Backlogs** | Committed stories, goal and lead per sprint | `Sprint_Backlogs.docx`; Appendix A |
| **Definition of Done** | Six-check CI gate: server lint, server tests, web lint, web tests, type check, production build (+ DB tests) | `.github/workflows/ci.yml`; 133 runs |
| **Increments** | One feature branch per change → development → release to main | 65 feature branches, 51 releases, 10 PRs |
| **Ceremonies** | Planning, daily scrum, review, retrospective, refinement templates | `Scrum_Ceremony_Templates.docx`; §7–9 |
| **Transparency** | Living work plan with phase status; in-app Scrum board with burn-up | `WORKPLAN.md`; in-app board `/dev` |

---

## 4. Planning

The proposal planned 10 modules in 10 weekly sprints, ordered by dependency: auth and customers first, then the order-to-cash chain (menu → orders → kitchen → billing), then floor and bookings, back-of-house, and analytics last. The work breakdown structure split the project into five phases. Backlog refinement later added Sprints 11–17 (quality and security, account hierarchy, attendance, payroll, UI polish, validation and responsive sizing, super admin) — the backlog grew from 217 planned points to 355.

| Sprint | Module | MoSCoW | Lead | Stories | Points | Delivered (git) |
|---|---|---|---|---|---|---|
| 1 | Customer Management + Core Setup | Must | #4 (Shaheer Zafar) | 5 | 24 | 05–06 Oct 2026 · PR #1 |
| 2 | Menu Management | Must | #3 (Fozan Javaid) | 5 | 19 | 05–06 Oct 2026 · PR #1 |
| 3 | Order Management | Must | #1 (Sabih Uddin) | 5 | 24 | 05–06 Oct 2026 · PR #1 |
| 4 | Kitchen Workflow | Must | #2 (Burhanuddin Khatri) | 5 | 24 | 05–06 Oct 2026 · PR #1 |
| 5 | Billing | Must | #1 (Sabih Uddin) | 5 | 24 | 05–06 Oct 2026 · PR #1 |
| 6 | Table Management | Should | #5 (Shahaan Khalid) | 4 | 16 | 05–06 Oct 2026 · PR #1 |
| 7 | Reservations | Should | #4 (Shaheer Zafar) | 4 | 16 | 05–06 Oct 2026 · PR #1 |
| 8 | Inventory | Should | #3 (Fozan Javaid) | 5 | 27 | 05–06 Oct 2026 · PR #1 |
| 9 | Staff Management | Could | #5 (Shahaan Khalid) | 5 | 21 | 05–06 Oct 2026 · PR #1 |
| 10 | Analytics + Project Retrospective | Could | #7 (Shah Anas Khan) | 6 | 22 | 05–06 Oct 2026 · PR #1 |
| 11 | Quality, Security & Operations | Must | #7 (Shah Anas Khan) | 7 | 30 | 07 Oct 2026 |
| 12 | Staff Accounts & Hierarchy | Must | #5 (Shahaan Khalid) | 6 | 23 | 07–08 Oct 2026 |
| 13 | Attendance & My Work | Should | #5 (Shahaan Khalid) | 5 | 22 | 09 Oct 2026 |
| 14 | Payroll & Workforce Hub | Should | #1 (Sabih Uddin) | 5 | 22 | 09–10 Oct 2026 |
| 15 | Admin UI Polish & Input Safety | Should | #6 (Syed Okasha) | 4 | 17 | 10 Oct 2026 |
| 16 | Form Validation, Phone Format & Responsive Sizing | Should | #6 (Syed Okasha) | 4 | 16 | 10–21 Oct 2026 · PR #4–#5 |
| 17 | Super Admin & Account Governance | Must | #5 (Shahaan Khalid) | 2 | 8 | 15 Nov 2026 · PR #11 |

---

## 5. Increments, Reviews and Responding to Change

| Feedback or finding | Backlog change |
|---|---|
| Data was lost on every serverless restart | Neon persistence (PR #2/#3), later a 28-table relational schema (PR #6, #8) |
| Phone numbers were stored in many formats | Phase 9: one +92 format, digits only, in the UI and the API |
| Admin screens oversized on phones | Phases 10a/10b: responsive sizes, checked at 360px |
| “Should a single super-admin manage the other admins?” (Phase 8) | Sprint 17: super admin bound to one email (PR #11) |
| CI red on main after direct pushes | CI repaired in PR #11; PR-only flow reaffirmed |

### Key Pull Requests

| PR | Opened | Author | Branches | Title | State |
|---|---|---|---|---|---|
| #1 | 2026-10-05 | Fozan3060 | `feat/complete-productbacklog` → `main` | Complete the Product Backlog: all 10 modules, acceptance tests and CI | Merged |
| #2 | 2026-10-07 | burhankhatri | `feat/neon-persistence` → `main` | feat(api): persist the store in Neon Postgres and deploy to Vercel | Merged |
| #3 | 2026-10-07 | burhankhatri | `feat/neon-persistence` → `development` | feat(api): persist the store in Neon Postgres and deploy to Vercel | Merged |
| #4 | 2026-10-21 | Fozan3060 | `feat/board-phone-docs` → `development` | Fix Scrum board totals/phone header, keep legacy phones editable, add Sprints 15-16 | Merged |
| #5 | 2026-10-21 | Fozan3060 | `development` → `main` | Release: Scrum board fixes, legacy phones, Sprints 15-16 docs | Merged |
| #6 | 2026-10-21 | k224347-sudo | `feat/relational-schema` → `development` | feat: relational PostgreSQL schema with local/Neon init script | Merged |
| #7 | 2026-10-21 | k224347-sudo | `development` → `main` | Development | Merged |
| #8 | 2026-11-12 | burhankhatri | `feat/db-wiring` → `development` | feat(db): persist the store in the relational Postgres tables | Merged |
| #9 | 2026-11-13 | SyedOkashaShoaib | `feat/auth-hardening` → `development` | Harden authentication and browser sessions | Merged |
| #10 | 2026-11-14 | ShaheerZafar1265 | `feat/tables-validation` → `main` | Feat/tables validation | Merged |

---

## 6. Retrospectives

| Phase | Went well | Went badly | Action carried forward |
|---|---|---|---|
| **Sprints 1–10** | Every story shipped with an acceptance test; CI gate from day one. | All 10 modules landed in one large PR, so reviews were coarse. | Small feature branches and one PR or merge per feature (65 branches followed). |
| **Sprints 11–14** | Module-wise tests with AAA; RBAC access matrix covers every route. | Slot-grid tests failed after 19:00 because they hard-coded a date. | Pin test dates far in the future; time-independent tests. |
| **Sprints 15–16** | Live validation matching server limits; responsive sizes at 360px. | Layout checks cannot run in jsdom; manual browser checks lagged. | Keep a manual phone-check item in the work plan per release. |
| **Nov increments** | Relational schema with constraints; persistence tested on real Postgres in CI. | Commits pushed straight to main left CI red on main and development for a day. | PR-only flow into development and main; never bypass the gate (PR #11 repaired CI). |
| **Sprint 17** | Independent code review caught an account-takeover path before release. | Late scope (super admin) arrived on the final day. | Answer open product questions earlier during backlog refinement. |

---

## 7. Ceremonies & Meetings

| Date | Ceremony | Recorded outcome | Attendees |
|---|---|---|---|
| 18 Sep 2026 | Project kick-off / Sprint 0 | Repository created (init commit); proposal, product backlog, WBS, Gantt and ceremony templates prepared. | All 9 (kickoff) |
| 05-06 Oct 2026 | Sprint review, Sprints 1-10 | PR #1 merged: all 10 modules, acceptance tests per user story, CI Definition-of-Done gate. | All 9; PR #1 by Fozan Javaid |
| 07 Oct 2026 | Sprint planning, Sprints 11-12 | 44 feature-branch merges in one day: repo conventions (`CLAUDE.md`), module-wise tests, Neon persistence (PR #2/#3). | All 9; PR #2/#3 by Burhanuddin Khatri |
| 08-10 Oct 2026 | Reviews, Sprints 11-14 | Accounts and hierarchy, attendance and payroll released; work plan phases 1-7a recorded with test counts. | All 9 |
| 21 Oct 2026 | Review and refinement, Sprints 15-16 | PR #4-#7: Scrum board fixes, Sprints 15-16 documented, relational PostgreSQL schema. | All 9; PR #4/#5 Fozan Javaid, PR #6/#7 Sabih Uddin Meraj |
| 12 Nov 2026 | Review: persistence | PR #8: the API persists to the 28 relational tables. | All 9; PR #8 by Burhanuddin Khatri |
| 13-14 Nov 2026 | Review: security hardening | PR #9 (auth hardening), PR #10 (tables validation), superuser accounts. | All 9; PR #9 Syed Okasha Shoaib, PR #10 Shaheer Zafar |
| 15 Nov 2026 | Planning and review, Sprint 17 | Open question "one super admin over admins?" answered; PR #11 (super admin, CI repaired), PR #12 (sync of main). | All 9 |

---

## 8. Team Contribution & Roles

| Member | Roll no. | Scrum role | Lead / Focus Modules | Main Codebase Areas |
|---|---|---|---|---|
| **Sabih Uddin Meraj** | 22K4347 | Product Owner | Sprints 3, 5, 14 (Order Management, Billing, Payroll) | `frontend/src`, `server/test`, `server/src` |
| **Burhanuddin Khatri** | 22K0591 | DevOps / Database | Sprint 4 (Kitchen Workflow & Neon DB Persistence) | `docs & root`, `server/src`, `server/test` |
| **Fozan Javaid** | 23K0605 | Scrum Master | Sprints 2, 8 (Menu Management, Inventory) | `frontend/src`, `server/src`, `server/test` |
| **Shaheer Zafar** | 22K5138 | Developer | Sprints 1, 7 (Customer Management, Reservations; PR #10) | `frontend/src`, `server/test`, `server/src` |
| **Shahaan Khalid** | 22K4442 | Developer | Sprints 6, 9, 12, 13, 17 (Tables, Staff, Attendance, Super Admin) | `frontend/src`, `server/test`, `server/src` |
| **Syed Okasha Shoaib** | 23K-0850 | QA / Security | Sprints 15, 16 (Auth Hardening & UI/UX) | `frontend/src`, `server/src`, `server/test` |
| **Shah Anas Khan** | 23K-3028 | Docs & Planning | Sprint 11 (Quality, Security & Operations) | Documentation, sprint planning records |
| **Kahlil Ahmed** | K232007 | Testing & Research | Bolt 006 (Testing, Mock Isolation, User Research) | Manual/UI testing, user research |
| **Muhammad Zain Abbas** | 22K5028 | Review & Reporting | Bolt 009 (Sprint reviews, lockfile audit, status reporting) | Sprint reviews, status reporting |

