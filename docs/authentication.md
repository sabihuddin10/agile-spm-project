# Authentication: how it works, what was hardened, known limits

## How sign-in works

- **Accounts:** `POST /api/auth/register` (customers only; a `role` in the body is ignored) and `POST /api/auth/login`
  (every role). Staff accounts are created by managers and admins; the super admin is bound by
  `pnpm --dir server superadmin`.
- **Session:** a signed JWT (HS256 only) in an `HttpOnly`, `SameSite=Lax` cookie scoped to `/api`, `Secure` in
  production, 12 hours. A `Bearer` token is accepted too. The role used for every decision is read from the account at
  request time, never from the token.
- **Revocation:** each account has a `tokenVersion`. Changing or resetting a password, suspending the account, and
  signing out all bump it, which ends every session issued before. Deleting the account ends them too.
- **Browser writes** send `X-Requested-With: RestaurantOps` (checked by `protectCookieWrites`), so a request forged from
  another site cannot ride the cookie.
- **Brute force:** per-IP and per-email limits on sign-in, shared across API instances (`docs/rate-limiting.md`).
- **No account enumeration by timing:** an unknown email is checked against a placeholder hash made with the same work
  factor, so it costs as much as a real account.

## Passwords

- Hashing lives in one module, `server/src/lib/passwords.js` (`hashPassword`, `passwordMatches`, `needsRehash`,
  `bcryptCost`). Nothing else calls bcrypt.
- **Work factor:** bcrypt cost 10 by default. `BCRYPT_COST` (10 to 14) raises it for new hashes; a missing, non-numeric
  or out-of-range value falls back to a safe bound. A stored hash with a lower cost is replaced the next time its owner
  signs in successfully (never on a wrong password), so raising the cost needs no migration.
- **Length:** new and changed passwords are limited to **72 bytes** (UTF-8). bcrypt only reads the first 72 bytes, so a
  longer password used to be accepted but silently cut off; two different long passwords sharing their first 72 bytes
  unlocked the same account. Sign-in still accepts up to 128 characters, so existing accounts keep working.
- **Policy:** 8 or more characters with a lowercase letter, an uppercase letter, a number and a special character,
  not your email or name, not a very common password (`server/src/lib/password-policy.js`, mirrored in
  `frontend/src/lib/validation/password.ts`).

## Known limits (found, measured, not fixed)

- **Hashing blocks the event loop.** `bcryptjs` is pure JavaScript, so each hash or comparison runs synchronously for
  about 120 ms at cost 10 on a 2013 laptop. Its async API was measured too and does not help: the event loop got to run
  twice during a 124 ms comparison. Sign-in is rate limited, which bounds the damage, but a real fix needs a native
  library (a new dependency) or a different algorithm with a migration, which is a larger decision than a bug fix.
- **Signing out ends every session** of that account (all devices), because revocation is per account, not per session.
- **Registration says when an email is taken** (`409`), which reveals that the address has an account. This is a common
  trade-off for usability; the sign-in path does not leak.
- Tokens carry no `iss` or `aud` claim. Adding them would sign everyone out once at deploy time.
