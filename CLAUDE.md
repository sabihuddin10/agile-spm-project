# CLAUDE.md

Guidance for Claude Code (and anyone else) working in this repository.

## Project

Restaurant Operations & Ordering Platform — a pnpm workspace with two packages:

- `server/` — Express 4 REST API, in-memory data store (`src/data/`), routes per domain in `src/routes/` (auth, customers, menu, orders, billing, tables, reservations, inventory, staff, analytics, notifications, settings).
- `frontend/` — Next.js 14 (App Router), pages under `src/app/`, shared UI under `src/components/`, one subfolder per feature module in both.

Run `pnpm install` at the root once; `pnpm dev` runs both apps together.

## Git branching — always follow this

Three kinds of branches, strict direction of flow:

```
feat/<short-name>  →  development  →  main
```

- **`main`** — production/release branch. Protected. Only receives merges from `development`. Never commit or push directly to `main`.
- **`development`** — integration branch. Protected. Default base for all new work. Feature branches are cut from `development` and merged back into it via PR. Never commit or push directly to `development`.
- **`feat/<short-name>`** — one branch per feature/fix (e.g. `feat/neon-persistence`, `feat/complete-product-backlog`). Branch from the latest `development`, open a PR back into `development` when done. Keep the name short and descriptive, matching the existing `feat/...` convention (not `feature/...`).

Rules:

1. Before starting new work, make sure you're branching from an up-to-date `development`, not `main`.
2. Never fast-forward or force-push `main` or `development` directly — always go through a PR.
3. `main` only moves forward by merging `development` in, when `development` is in a releasable state (CI green).
4. A branch's PR must pass the CI gate (see below) before it merges.
5. If asked to "merge into main" without qualification, confirm whether that means `development → main` (a release) or a feature branch — the default flow is feature → development, not feature → main directly.

## CI — Definition of Done

`.github/workflows/ci.yml` runs on every push to `main`/`development` and on every PR. A change is not done until all of these pass:

1. `pnpm --dir server run lint` — syntax check of every server source/test file.
2. `pnpm --dir server test` — server acceptance tests.
3. `pnpm --dir frontend run lint` — ESLint.
4. `pnpm --dir frontend run test` — frontend unit tests (Vitest).
5. `pnpm --dir frontend exec tsc --noEmit` — type check.
6. `pnpm --dir frontend run build` — production build.

Run these locally before calling anything ready to merge.

## Test conventions

Tests are organized **module-wise**, mirroring the source directory structure — not by sprint number.

- **Server** (`server/test/`): subfolders mirror `server/src/` — `routes/<module>.test.js` (one file per route module: auth, customers, menu, orders, billing, tables, reservations, inventory, staff, analytics), `lib/<module>.test.js`, `data/<module>.test.js`. Uses Node's built-in `node:test` + `node:assert/strict`; shared helpers live in `server/test/helpers.js`.
- **Frontend** (`frontend/src/**/__tests__/`): each `app/<route>` and `components/<module>` folder has its own `__tests__/` directory, mirroring that structure exactly. Uses Vitest + React Testing Library (config: `frontend/vitest.config.mts`). Modules without real tests yet have a stub file with `test.todo(...)` entries describing what's needed — fill those in rather than adding tests elsewhere.
- Every test follows **Arrange-Act-Assert (AAA)**: set up state, perform the action, then assert — with `// Arrange` / `// Act` / `// Assert` comments marking each phase (multi-step acceptance tests may repeat the cycle within one `test()`).
