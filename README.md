# Restaurant Operations & Ordering Platform

A full-stack **Restaurant Operations & Ordering Platform** — the working software deliverable for a 10-sprint Agile/Scrum intern project. This repository currently implements the **foundation (Sprints 1–2)**: authentication/RBAC, Customer Management, and Menu Management, plus an in-app Scrum board that documents the Agile delivery.

## Monorepo layout

```
.
├── server/      Express 4 REST API — in-memory storage (no database)
└── frontend/    Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS
```

## Tech stack

| Layer      | Technology                                                    |
|------------|---------------------------------------------------------------|
| Frontend   | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS 3 |
| Backend    | Express 4 (REST)                                              |
| Storage    | In-memory server store (+ client-side state) — **no database** |
| Auth/RBAC  | Mock JWT auth, role-based access for 5 stakeholder roles       |
| Charts     | Chart.js (react-chartjs-2) — wired for later Analytics sprint  |

> **Note:** Storage is intentionally in-memory. All data is seeded on server start and **resets whenever the server restarts**. There is no persistence layer yet.

## The 5 stakeholder roles

Customer · Waiter · Chef · Manager · Admin

Each role has its own dashboard and permission set, enforced by RBAC middleware on the API and route guards on the client.

## Getting started

```bash
# 1. Install all workspace dependencies (server + frontend)
npm install

# 2. Run both servers (Express on :4000, Next.js on :3000)
npm run dev
```

Open http://localhost:3000 · API base: http://localhost:4000/api

### Demo accounts (seeded on server start)

| Role    | Email             | Password |
|---------|-------------------|----------|
| Admin   | admin@rest.test   | password |
| Manager | manager@rest.test | password |
| Chef    | chef@rest.test    | password |
| Waiter  | waiter@rest.test  | password |
| Customer| customer@rest.test | password |

## Sprint roadmap

| Sprint | Module                 | Status             |
|--------|------------------------|--------------------|
| 1      | Auth/RBAC + Customers   | ✅ In this build   |
| 2      | Menu Management         | ✅ In this build   |
| 3      | Order Management        | 🔜 Planned         |
| 4      | Kitchen Workflow (KDS)  | 🔜 Planned         |
| 5      | Billing                 | 🔜 Planned         |
| 6–10   | Tables, Reservations, Inventory, Staff, Analytics | 🔜 Planned |

See the `docs/` folder and the in-app **Scrum board** for the full product backlog and sprint tracking.
