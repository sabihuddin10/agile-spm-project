# Critical-path browser tests (E2E)

A small Playwright suite that drives the real app in a browser, against **production builds**, to catch
regressions that unit and route tests cannot see together: the browser, the Next.js `/api` proxy, the
Express API, the session cookie and the seeded state.

## What it covers

One order travels the whole way, then one access check:

1. **Customer** signs in, adds a dish, checks out for pickup (cash), and finds the order in My account.
2. **Waiter** signs in and confirms that order, which sends it to the kitchen.
3. **Chef** signs in, sees the order in the kitchen queue, and starts it.
4. **Authorization**: a customer who opens `/staff/kitchen` is sent back to the storefront.

The journeys share one order, so they run in order in a single worker. Tests live in `e2e/tests/`.

The whole suite runs in **three browser engines**, one after the other: Chromium, Firefox and WebKit
(Safari's engine). Run one engine with `pnpm run e2e -- --project=firefox`.

## Running it locally

One-time, if the three browsers are not installed for Playwright 1.64.1:

```bash
pnpm install
pnpm run e2e:install
```

Run the suite (a few minutes: the production build, then three browser passes):

```bash
pnpm run e2e
```

Open the HTML report after a run (the test names show which browser each result is from):

```bash
pnpm exec playwright show-report e2e/playwright-report
```

## How it is isolated

- Fixed ports that differ from the dev servers: API **4100**, web **3100**. Stop `pnpm dev` only if you want
  to keep its `frontend/.next` build: the suite runs `next build`, which rewrites that folder.
- The API runs in memory from the seed data, with `NODE_ENV=test` (a `Secure` session cookie would be rejected by WebKit over plain http). `DATABASE_URL` is forced empty, so a developer's `server/.env`
  can never point the suite at a real database. No production data is used.
- The API signing secret is a throwaway test value set in `e2e/playwright.config.ts`.
- The accounts are the public demo seeds listed in the README (`customer@`, `waiter@`, `chef@rest.test`).

## When a test fails

Playwright keeps, per failed test, a **trace** and a **screenshot** in `e2e/test-results/`, plus the HTML
report in `e2e/playwright-report/`. The two servers write their output to `e2e/logs/api.log` and
`e2e/logs/web.log`. All three folders are git-ignored.

- Replay a trace step by step: `pnpm exec playwright show-trace e2e/test-results/<test>/trace.zip`
- Cookie or proxy problems usually show up as a failed sign-in or a 401 in `e2e/logs/api.log`.
- A port already in use means another process holds 4100 or 3100. Stop it and rerun.

## In CI

The `e2e` job in `.github/workflows/ci.yml` runs on every push and pull request, with a 10-minute timeout.
On failure it uploads the `e2e-artifacts` artifact (report, traces, screenshots and server logs) for 14 days.

## Changing the suite

Keep it small: it is a smoke suite for the most valuable integrated journeys, not one test per story.
Add journeys to `e2e/tests/`, use accessible roles and labels for selectors, and keep the data disposable.
