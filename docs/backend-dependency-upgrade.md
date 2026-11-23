# Backend dependency upgrade: Express 4.22.3 line (bolt 003)

Records why the API's production dependencies were upgraded, what was chosen, and how it was verified.

## Why

After the frontend upgrade (`docs/frontend-dependency-upgrade.md`), `pnpm audit --prod` still reported 6 advisories,
all under `server >`:

| Package | Was | Fixed in | Severity | Advisory |
|---|---|---|---|---|
| `proxy-addr` | 2.0.7 | 2.0.8 | critical | IP spoofing via an IPv4-mapped IPv6 trust subnet |
| `body-parser` | 1.20.6 | 1.20.9 | high | DoS from trailing bytes after a compressed request body |
| `qs` | 6.15.3 | 6.16.1 | moderate (3) | array-limit bypass, DoS via `isBuffer`, DoS in `stringify` with `arrayFormat: 'comma'` |
| `morgan` | 1.12.0 | 1.12.1 | moderate | log injection through an unescaped double quote |

## What changed

- `server/package.json`: `express` to `^4.22.3` (the newest Express 4.x) and `morgan` to `^1.12.1`.
  Express 4.22.3 already allows the patched `body-parser` (`~1.20.5`), `proxy-addr` (`~2.0.7`) and `qs` (`~6.16.0`).
- Root `package.json`, `pnpm.overrides`: `body-parser ~1.20.9` and `proxy-addr ~2.0.8`. The lockfile kept the old
  versions because they still satisfied Express's ranges, and `pnpm update` did not move them, so the overrides
  pin the patched versions. `qs` followed: both copies now resolve to 6.16.2.
- `server/test/middleware/request-hardening.test.js`: 14 regression tests (below).
- `pnpm-lock.yaml`: regenerated.

Express 5 was not adopted: the Express 4 API contract is unchanged.

## Regression tests

Hostile or malformed traffic must get a safe 4xx, and every test ends by proving the API still answers:

- compressed JSON: valid is accepted; trailing bytes after the stream, a truncated stream, a body that is not
  the declared encoding, and an unknown `Content-Encoding` are all 4xx (415 for the unknown encoding)
- malformed JSON (400), a body over the 100 KB limit (413), and a small compressed body that inflates past it (413)
- prototype-shaped keys (`__proto__`, `constructor`), top level and nested (400), and `Object.prototype` stays clean
- query strings with repeated, bracketed, deeply nested, 200-index or `__proto__` keys (400); a comma-separated
  value stays a plain string; a 60 KB query string does not crash the API
- client addressing through `X-Forwarded-For`: off Vercel the header is ignored (spoofed addresses share one
  rate-limit bucket), on Vercel one trusted hop makes it the client address

Morgan is only used in its `dev` format, which has no quoted fields, so the log-injection advisory has no
exploitable path here; the upgrade removes it regardless.

## Result

- `pnpm audit --prod`: 0 findings (info, low, moderate, high and critical all zero).
- Server lint and 444 tests pass (430 existing plus 14 new). Frontend lint, 991 unit tests, type check and build are
  unchanged by this bolt. The three-browser E2E suite passes.
- The database tests need PostgreSQL and run in CI (Postgres 16 service); they were not run on the author's machine.

## Related E2E fix

Verifying this change exposed a race in the E2E sign-in helper: typing into the controlled login form before React
hydrates wiped the email field, leaving "Sign in" disabled, mostly in Firefox and WebKit on a busy machine. The helper
now retries until the values stick and retries an aborted navigation. The API logs showed every login that reached
it returned 200, so the upgrade was not involved.

## Follow-ups

- The overrides can go once Express's own ranges resolve to the patched versions on a fresh install. Re-run the
  audit before removing them. Bolt 009 turns the audit into a CI gate.
