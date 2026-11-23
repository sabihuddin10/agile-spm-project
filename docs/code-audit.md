# Code audit: authentication, database, data structures, OOP

An audit of the whole project for four kinds of problem. Every finding below was checked against the code or
measured, and each fix went through its own pull request with tests and CI. The last section lists what was found
and **deliberately not fixed**, with the reason.

## Authentication

| Finding | Evidence | Outcome |
|---|---|---|
| Passwords over 72 bytes were silently truncated | bcrypt reads 72 bytes; the policy allowed 128 characters. A *different* password sharing only the first 72 characters signed into the same account (checked) | **Fixed.** New passwords are limited to 72 bytes (server and web form); sign-in still accepts up to 128 characters so existing accounts keep working |
| Hashing written out in eight places with a fixed cost | `bcrypt.hashSync(x, 10)` in registration, three password routes, seed data, two scripts | **Fixed.** `lib/passwords.js` is the only module that hashes; `BCRYPT_COST` (10 to 14) is bounded; old hashes upgrade at the next successful sign-in |
| Hashing blocks the event loop | `bcryptjs` is pure JavaScript: 128 ms to hash, 117 ms to compare at cost 10. Its async API let the loop run only twice in a 124 ms comparison | **Not fixed.** Needs a native library or another algorithm plus a migration; sign-in is rate limited. Documented |
| Sign-in already resists timing and enumeration | An unknown email is checked against a placeholder hash of the same cost | Good as it was |

Details: `docs/authentication.md`.

## Database

The schema is in good shape: 25 CHECK constraints, 64 indexes, a case-insensitive unique email, and foreign keys that
use `SET NULL` or `CASCADE` sensibly (deleting a user is safe at the database level). The problems were in how data
is written and migrated.

| Finding | Evidence | Outcome |
|---|---|---|
| `TRUNCATE ... CASCADE` could silently wipe a table | A table added later with a foreign key into a persisted table, and forgotten in the list, would be emptied on every save | **Fixed.** No `CASCADE`: the save now fails loudly and rolls back. A test requires every table to be persisted or deliberately excluded |
| The attendance migration thrashed on every server start | `001` re-created an index that `006` dropped again; `006` took an `ACCESS EXCLUSIVE` lock and re-validated every row each time | **Fixed.** Once migrated, it does nothing; tests show a reader does not block it |
| Every change rewrites all 27 tables | `saveStore` truncates and re-inserts the whole dataset inside one transaction under one global advisory lock | **Not fixed.** Needs per-table change tracking and incremental upserts, a redesign. The next thing to do if data volume grows |
| Every request serializes the whole store twice | `JSON.stringify(snapshot())` before and after each request, reads included | **Not fixed**, same reason |

## Data structures

Four nested scans, O(n x m), replaced with maps built once. Each keeps the original algorithm in its test as a
reference and requires identical output on randomized data; read counters show the scaling.

| Where | Was | Now |
|---|---|---|
| Public menu and categories | every category per item, every item per category | a `Set` and one `countBy` |
| Inventory list | every menu item and recipe line, per ingredient | one ingredient-to-recipes index (`lib/recipe-usage.js`) |
| Floor plan (polled every few seconds) | every order and reservation, per table | grouped by table once (`lib/floor-index.js`) |
| Staff performance report | five passes over all orders per person | one pass (`lib/staff-performance.js`) |
| Looking up the signed-in user | a linear scan of all users on every request | O(1) verified lookup (`UserDirectory`) |

Shared helpers: `lib/collections.js`.

## Object-oriented structure

- Eight files reached into the global `users` array, and the rules for registering a customer and removing an account
  lived inside an Express route that knew about the customers and tables collections.
- **`UserDirectory`** now owns the user collection. Its indexes are a *verified* cache: a hit is used only if it is still
  the object at its recorded position, so it stays correct when `restore()` swaps every object on reload, when emails are
  edited in place, and when accounts are removed behind its back.
- **`AccountService`** owns `registerCustomer` and `removeAccount`. Collaborators are injected, so it is tested without a
  database; routes keep the access rules and the HTTP status.
- `Order`, `OrderItem` and `Bill` (added on `main`) are used by `lib/order-math.js` only; the other order logic is still
  plain functions over plain objects.

## Found and deliberately not fixed

1. **The in-memory store is a set of shared mutable arrays imported everywhere** (`users`, `orders`, `tables`...). Any
   route can change any of them, which is the root of most coupling in the server. Replacing it means rewriting every
   route and the persistence layer at once; the directory and service are the safe first steps in that direction.
2. **The whole-dataset rewrite and double serialization** per request (database section).
3. **Synchronous bcrypt** (authentication section).
4. Sign-out ends every session of the account; registration reports a taken email (`409`); tokens carry no `iss`/`aud`.
   All are documented trade-offs in `docs/authentication.md`.

## How the fixes were checked

Every pull request passed CI (server and frontend suites, the real-database tests on PostgreSQL 16, the three-browser
suite, the dependency policy check). Server tests went from 501 to 542 across these changes (the frontend from 1,058 to 1,061), plus 10 new tests that run only against a real database. The one CI failure along the
way was in a new test (a lock control needed a transaction), not in the code under test, and was fixed before merging.
