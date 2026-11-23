# Frontend dependency upgrade: Next.js 14.2.35 to 15.5.29 (bolt 002)

Records why the frontend production dependencies were upgraded, what was chosen, and what is left.

## Why

`pnpm audit --prod` reported 36 production advisories (4 critical, 13 high, 17 moderate, 2 low).
30 of them were in the frontend graph:

| Package | Findings | Notes |
|---|---|---|
| `next` 14.2.35 | 25 (3 critical) | Patched only from 15.5.28. 14.2.35 is the last 14.x release. |
| `postcss` | 4 (2 high) | The copy Next bundles (`next > postcss@8.4.31`). |
| `source-map-js` | 1 (high) | Pulled in by PostCSS; locked at 1.2.1, patched from 1.2.2. |

The other 6 findings are in the API (`server > express`, `morgan`) and belong to bolt 003.

## What changed

- `frontend/package.json`: `next` and `eslint-config-next` to `^15.5.29`.
- Root `package.json`, `pnpm.overrides`:
  - `next>postcss: ^8.5.18` replaces the old PostCSS that Next pins itself.
  - `source-map-js: ^1.2.2` lifts the locked 1.2.1.
  These are the only two overrides, added after the Next upgrade alone left those two findings open.
- `frontend/tsconfig.json`: `"target": "ES2017"`, which Next 15 adds and expects.
- `pnpm-lock.yaml`: regenerated.

## Why 15.5.29

- It is the newest release of the 15.5 line (npm `backport` tag) and is above the 15.5.28 minimum that clears every Next advisory.
- It still accepts React 18 (`^18.2 || ^19`), so React stays at 18.3.1 and no React 19 migration was needed.
- Next 16 is the current `latest`, but a major jump is unrelated to the security goal and was left out of scope.

## Compatibility review

- No code changes were needed. The app has no async `params`/`cookies()`/`headers()` usage, one route handler
  (`/api/health`, `force-dynamic`), and `useSearchParams` in two client pages, which built without a Suspense change.
- The `/api/*` rewrite, the session cookie and the staff and customer journeys behave as before, which the
  browser suite (`docs/e2e.md`) checks in Chromium, Firefox and WebKit.

## Result

- `pnpm audit --prod`: no frontend findings remain. The 6 that are left (1 critical, 1 high, 4 moderate) all
  sit under `server >` and are bolt 003's.
- Frontend lint, 991 unit tests, type check, production build and the 12 browser tests all pass.

## Follow-ups

- The overrides can be dropped once Next ships a patched PostCSS itself. Re-run the audit before removing them.
- `frontend/package-lock.json` is a leftover npm lockfile that makes Next warn about multiple lockfiles. Bolt 009 removes it.
