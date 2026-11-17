# Data Stack

## Overview

The application uses a relational PostgreSQL schema for restaurant operations data. It can run entirely in memory for fast isolated tests, but configured environments load and persist the same application state through normalized PostgreSQL tables.

## Database

- PostgreSQL is the database contract in development, CI, and production.
- Local development uses a standard PostgreSQL server; production uses managed Neon PostgreSQL.
- Schema, foreign keys, constraints, and indexes live in ordered SQL files under `server/schema/`.
- Seed data must remain deterministic and safe for demo or test use.
- Schema changes require a new ordered schema file or an explicitly reviewed update to the initialization flow; never mutate production data implicitly from request handlers.

Relational storage fits the system's connected customers, orders, bills, inventory, reservations, staff, attendance, and payroll data. Database constraints are part of application correctness and must not be replaced solely with client-side checks.

## Database Client

The project intentionally uses direct PostgreSQL clients rather than an ORM:

- `pg` connects to ordinary PostgreSQL over TCP.
- `@neondatabase/serverless` connects to `*.neon.tech` databases over WebSockets.
- `server/src/data/db.js` selects the driver from the `DATABASE_URL` host and exposes a common pool interface.
- Relational adapters under `server/src/data/relational/` own SQL access and mapping.

Use parameterized queries for every value. User input must never be interpolated into SQL text. Dynamic table, column, or type identifiers must pass the repository's strict identifier validation.

## Persistence Rules

- When `DATABASE_URL` is unset, use the in-memory store and do not attempt a database connection.
- When it is set, apply the schema once per pool and use the existing transaction/persistence middleware.
- Keep money as integer cents and preserve server-side calculation of prices, taxes, service charges, tips, refunds, and splits.
- Maintain identical schema behavior between local PostgreSQL, the CI PostgreSQL service, and Neon.
- Run destructive database scripts only against an explicitly selected disposable or development database; never point database tests or reset commands at production.

## Verification

- Unit and acceptance tests may use the in-memory store or a fake pool.
- Changes to schema, SQL, persistence, or data mapping must also pass `pnpm --dir server test:db` against a disposable PostgreSQL database.
- Keep the SQL-safety tests green whenever query construction changes.

## Decision Relationships

Direct SQL keeps the relational schema and safety constraints visible, while the dual-driver pool preserves a single code path across local PostgreSQL and Neon. The in-memory mode supports fast tests without weakening the configured persistence contract.
