# Rate limiting across API instances (bolt 004)

Sign-in, registration and the two public forms (table bookings, job applications) are rate limited. The
limits used to be counted in each API process's memory, so on serverless hosting (Vercel) every instance
counted alone and running more instances multiplied an attacker's quota. They are now counted in a table
every instance shares.

## The limits (unchanged)

| Name | Counted by | Limit | Window | Notes |
|---|---|---|---|---|
| `auth-login-ip` | client address | 30 | 15 min | |
| `auth-login-email` | normalised email | 5 | 15 min | failures only: a successful sign-in gives its attempt back |
| `auth-register-ip` | client address | 10 | 15 min | |
| `booking-ip` | client address | 5 | 10 min | signed-in staff are exempt |
| `application-ip` | client address | 3 | 1 hour | signed-in staff are exempt |

Blocked requests get `429` with a positive `Retry-After` (seconds until the window resets) and the same
messages as before. The names are fixed on purpose: every instance must count the same limit.

## How it is built

Policy and storage are separate.

- `server/src/middleware/rate-limit.js` is the policy: what is limited, who is exempt, the `429` and `503`
  responses, failures-only handling.
- `server/src/lib/rate-limit-store.js` only counts. A store has `consume` (count one attempt, get back whether
  it is allowed and the seconds until reset) and `refund` (take one back). Two implementations:
  - **`PostgresStore`**: counts in the `rate_limits` table, shared by every instance. Used whenever the API
    persists to a database (`DATABASE_URL` set), which production requires.
  - **`MemoryStore`**: counts in this process. Synchronous, no network. Used in local development and tests,
    and when there is no database. It is the original behaviour, including its cap on tracked keys.

`RATE_LIMIT_STORE=postgres|memory` forces one; unset means "postgres when there is a database". An invalid
value, or `postgres` with no `DATABASE_URL`, stops the API at startup.

## The decision: PostgreSQL, not a new service

The requirements left the shared backend open. PostgreSQL was chosen:

- It is already there (the production database is Neon Postgres), so there is **no new service, secret or
  cost**, and nothing new that can be misconfigured on deploy.
- One statement per attempt is atomic (below), so it is correct under concurrency.
- The database clock is authoritative, which removes clock-skew problems between instances.
- The cost is one small extra query per sign-in, registration or form submission, only on those routes.

A Redis-style store would be faster per call but means provisioning, paying for and securing another
service, and the API would then have two things to be down. At this traffic that is not worth it. If volume
ever demands it, a new store only has to provide `consume` and `refund`.

## Atomic counting

Each attempt is one `INSERT ... ON CONFLICT (key_hash) DO UPDATE` (`CONSUME_SQL`):

- The first attempt of a window creates the row with `reset_at = now() + window`.
- Later attempts update the same row under the row lock `ON CONFLICT` takes, so two instances cannot both
  read "9 of 10" and both succeed. Exactly the permitted number succeed.
- If `reset_at` has passed, the row restarts at 1 with a fresh window.
- The count is capped at `limit + 1`, so a flood cannot grow it without bound, and a blocked attempt does
  not extend the window.
- `now()` is the database's clock.

`REFUND_SQL` gives one attempt back (failures-only limits, when a sign-in succeeds) and does nothing once the
window has ended. A background `DELETE` removes rows that expired over an hour ago, at most once every ten
minutes per instance; if it fails it is logged and nothing else happens.

The counters are written outside the request's own database transaction, so a request that fails with a 5xx
and rolls back does not also roll back its rate limit count.

## When the shared store is unavailable

The limiter **fails closed**: sign-in, registration and the public forms answer `503` with
`Retry-After: 5` and the message "The service is temporarily unavailable. Please try again shortly." The
alternative, letting everyone through, would turn a database hiccup into an open door for credential
guessing. The same database also holds the app's data, so when it is down the API is largely unusable
anyway, and failing closed costs little extra availability. Requests that are not rate limited (the menu,
health checks, reads) are unaffected by the limiter.

The outage is observable: each refusal logs `[rate-limit] store unavailable for "<name>", refusing the
request: <reason>`. The log never contains the IP address or email being counted. A limit can be given
`onStoreError: 'allow'` to fail open instead; none of the current ones does.

## Production without a shared store

A production API with a `DATABASE_URL` always gets the shared store. One without it (the startup check in
`server/src/lib/production-config.js` only warns about that unless `STRICT_PRODUCTION_CONFIG=1`), or one started
with `RATE_LIMIT_STORE=memory`, runs on `MemoryStore`. That is allowed, so a misconfiguration cannot take the
site down, but it is never silent: it logs once at startup:

> [rate-limit] production is using process-local rate limit counters: each API instance counts on its own ...

## Privacy

The table stores `SHA-256(namespace + 0x00 + key)`, never the IP address or email. Logs never include the
key. A hash of an IPv4 address is not secret (the space is small), so treat the table like the rest of the
database; the point is that nothing readable is copied into a new place or into logs.

## Tests

- `server/test/lib/rate-limit-store.test.js`: both stores, selection and the production warning. The Postgres
  store runs against a fake pool that applies the same rules as the SQL, including several "instances" racing
  on one counter.
- `server/test/middleware/rate-limit-shared.test.js`: two instances sharing a quota, `Retry-After`, failures-only,
  staff exemption, outage behaviour and its log line, and the full app answering `503` while unrelated routes
  keep working.
- `server/test-db/rate-limit.test.js`: the real SQL on a real Postgres with separate connection pools: exactly
  N of 60 simultaneous attempts succeed, shared windows, database-clock expiry, refund, no readable keys in the
  table, cleanup, two app instances sharing a lockout, and a `503` with the database unreachable. Runs in CI
  (the `build-and-test` job has a Postgres 16 service); locally it needs `DATABASE_URL` pointing at a
  throwaway database.
