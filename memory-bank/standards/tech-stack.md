# Tech Stack

## Overview

Plate & Flame is a JavaScript/TypeScript full-stack web application organized as a pnpm workspace. The frontend and API deploy as separate Vercel projects, while PostgreSQL provides the shared relational data store.

## Languages and Runtime

- Use TypeScript for the Next.js frontend and shared browser-facing types.
- Use modern JavaScript ES modules for the Express API.
- Support Node.js 18 or newer; CI and production builds use Node.js 22.
- Use SQL for the PostgreSQL schema, seed data, constraints, and indexes.

Do not migrate either package to a different language or module system as part of unrelated work.

## Frameworks and Libraries

### Frontend

- Next.js 14 with the App Router
- React 18
- TypeScript in strict mode
- Tailwind CSS 3 for styling
- Formik and Yup for form state and validation where those patterns already exist
- Chart.js through `react-chartjs-2` for analytics visualizations

### Backend

- Express 4 REST API using ES modules
- `jsonwebtoken` for JWT sessions and `bcryptjs` for password hashing
- `pg` for local PostgreSQL and `@neondatabase/serverless` for Neon
- In-memory state when `DATABASE_URL` is absent, with relational persistence when it is present

Prefer an existing dependency or a small local helper over introducing another package. Any new dependency must have a clear maintenance and security rationale.

## Authentication and Authorization

- Use a 12-hour JWT stored in an HttpOnly same-origin cookie.
- Require `JWT_SECRET` in production; never commit secrets or put them in `NEXT_PUBLIC_*` variables.
- Enforce authorization in the API with authentication and role guards. UI permission checks mirror server behavior but are not a security boundary.
- Preserve session revocation through account token versions and the existing password/account lifecycle.
- Keep request rate limits and server-side input validation on all public or authentication-sensitive endpoints.

## Infrastructure and Deployment

- Deploy `frontend/` and `server/` as separate Vercel projects.
- Route browser `/api/*` traffic through the Next.js rewrite to the Express deployment.
- Use local PostgreSQL for development and tests and Neon PostgreSQL for production.
- Use GitHub Actions as the required CI gate for linting, tests, type checking, database integration tests, and the production build.
- Keep environment-specific configuration in uncommitted environment files or deployment settings, using the committed `.env.example` files as the contract.

## Package Manager

- Use pnpm 10 from the repository root; the repository pins `pnpm@10.12.4`.
- Treat `pnpm-lock.yaml` as the canonical lockfile.
- Run package-specific commands with `pnpm --dir server ...` or `pnpm --dir frontend ...`.
- Do not update the package manager, lockfile, or dependency versions incidentally.

## Decision Relationships

Next.js and Vercel define the frontend build and deployment model. Express remains a separately deployed API so route modules and middleware stay independent from the UI. Both the local `pg` driver and the Neon serverless driver target the same PostgreSQL schema, which keeps development, CI, and production data behavior aligned.
