---
intent: 001-repository-hardening
phase: construction
status: complete
completed: 2026-11-18T10:26:11Z
---

# Repository Hardening: completion summary

All nine bolts are complete and merged into `development`, then released to `main` in
[pull request #23](https://github.com/sabihuddin10/agile-spm-project/pull/23) (merge commit `00ac21b`,
2026-11-18). Owner of every bolt: Muhammad Zain Abbas (22k-5028), agreed with the professor. Every pull request
passed CI before merging; each bolt's own `bolt.md` has the detailed completion record.

## Bolts

| Bolt | Story | Delivered | Pull request | Merged (UTC) |
|---|---|---|---|---|
| 001 quality-engineering | Critical-path E2E suite | Browser tests on Chromium, Firefox and WebKit, CI job with failure artifacts | [#14](https://github.com/sabihuddin10/agile-spm-project/pull/14) | 2026-11-17 15:33 |
| 002 dependency-security | Frontend dependencies | Next.js 15.5.29, frontend advisories 30 to 0 | [#15](https://github.com/sabihuddin10/agile-spm-project/pull/15) | 2026-11-17 16:02 |
| 003 dependency-security | Backend dependencies | Express/Morgan patched, 14 hostile-traffic tests | [#16](https://github.com/sabihuddin10/agile-spm-project/pull/16) | 2026-11-17 16:51 |
| 009 dependency-security | Lockfile and audit policy | Advisory gate and lockfile check in CI | [#17](https://github.com/sabihuddin10/agile-spm-project/pull/17) | 2026-11-17 17:51 |
| 008 deployment-safety | Validate production configuration | Production build fails on a bad `API_URL` | [#18](https://github.com/sabihuddin10/agile-spm-project/pull/18) | 2026-11-18 07:34 |
| 005 frontend-runtime | Polling lifecycle | One request in flight, clean teardown | [#19](https://github.com/sabihuddin10/agile-spm-project/pull/19) | 2026-11-18 07:56 |
| 006 frontend-runtime | Isolate workforce mock | Mock out of production bundles, bundle check in CI | [#20](https://github.com/sabihuddin10/agile-spm-project/pull/20) | 2026-11-18 08:20 |
| 007 quality-engineering | Frontend test runtime | 74.6% faster (140.3 s to 35.6 s), isolation check | [#21](https://github.com/sabihuddin10/agile-spm-project/pull/21) | 2026-11-18 08:42 |
| 004 api-resilience | Distributed rate limits | Shared Postgres counters, fail closed on outage | [#22](https://github.com/sabihuddin10/agile-spm-project/pull/22) | 2026-11-18 08:57 |

Related pull requests: [#24](https://github.com/sabihuddin10/agile-spm-project/pull/24) (reconcile five commits that
reached `main` directly), [#25](https://github.com/sabihuddin10/agile-spm-project/pull/25) (startup config rules warn
instead of refusing to start), [#23](https://github.com/sabihuddin10/agile-spm-project/pull/23) (release).

## Outcome against the intent's goals

| Goal | Result |
|---|---|
| No known production dependency exposure | `pnpm audit --prod` went from 36 advisories (4 critical, 13 high) to none, and a CI gate keeps it there |
| Protect production traffic consistently | Rate limits shared across instances; a production build fails on a missing or unusable `API_URL` |
| Representative, efficient regression detection | Browser smoke suite in CI on three engines; frontend suite 74.6% faster |
| Prevent client-side race and bundle regressions | Polling is single-flight; the demo mock is not in production bundles, enforced in CI |

## Deviations and decisions to know about

- **Bolt 009: three lockfiles, not one.** Vercel installs each project from its own folder with npm, so the two npm
  lockfiles stay (guarded and audited). Bolts 002 and 003 had at first only updated `pnpm-lock.yaml`; the npm lockfiles
  were stale and were regenerated in bolt 009. See `docs/dependency-policy.md`.
- **Bolt 004 backend choice:** PostgreSQL, the existing database, over a new Redis-style service. See `docs/rate-limiting.md`.
- **Bolt 008 and `main`:** a parallel implementation reached `main` by direct push; reconciled in #24 into one validator
  with the strictest rule of each. A path in `API_URL` is now rejected.
- **Startup rules (#25):** a `JWT_SECRET` under 32 characters or a missing `DATABASE_URL` logs a `[config]` warning and
  the API keeps running, so a live API is never stopped by a setting nobody could check. `STRICT_PRODUCTION_CONFIG=1`
  makes them refuse to start.
- **Test environment:** the E2E API runs with `NODE_ENV=test` because WebKit rejects `Secure` cookies over plain http.

## Not verified by the team

- The Vercel Production environment variables and build logs (no access from this machine).
- Bolt 004's database tests could not be run locally (no PostgreSQL available); CI ran them on Postgres 16 and they passed.

## Documentation added

`docs/e2e.md`, `docs/frontend-dependency-upgrade.md`, `docs/backend-dependency-upgrade.md`, `docs/dependency-policy.md`,
`docs/rate-limiting.md`, `docs/frontend-test-performance.md`.
