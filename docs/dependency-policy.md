# Dependency policy: lockfiles and the production advisory gate (bolt 009)

Keeps the security fixes from bolts 002 and 003 from silently coming undone.

## Lockfiles

There are **three** committed lockfiles, on purpose:

| File | Used by |
|---|---|
| `pnpm-lock.yaml` | local development and CI (`pnpm install --frozen-lockfile`) |
| `frontend/package-lock.json` | the Vercel web project, which installs from `frontend/` with npm |
| `server/package-lock.json` | the Vercel API project, which installs from `server/` with npm |

**Why the npm lockfiles stay.** The two Vercel projects deploy from their own folders and install with npm,
so the npm lockfiles, not `pnpm-lock.yaml`, decide what runs in production. Removing them would change how
production installs. (Bolt 009's original wording asks for `pnpm-lock.yaml` to be the only lockfile; the
requirements allow npm lockfiles to stay when explicitly justified, and this is that justification.)

**What this exposed.** The npm lockfiles had been left behind: `frontend/package-lock.json` still pinned
Next 14.2.35 (the manifest said 15.5.29) and did not list the test tooling at all, and `server/package-lock.json`
still pinned the vulnerable `body-parser`, `proxy-addr` and `qs`. Bolts 002 and 003 had only updated
`pnpm-lock.yaml`. Both npm lockfiles were regenerated in this bolt, and the checks below stop it recurring.

**Rules**, enforced by `pnpm run check:lockfiles` (also a CI step):

1. No lockfile other than the three above is committed (no `yarn.lock`, no extra `package-lock.json`).
2. Each npm lockfile matches its own `package.json` (dependencies and devDependencies). A mismatch means the
   lockfile is stale.

### Changing dependencies

Update `package.json`, then update **all** lockfiles that apply:

- pnpm: `pnpm install` (or `pnpm --dir frontend add <pkg>`).
- npm: regenerate in a clean copy of the package, because the repository root declares npm workspaces and npm
  would otherwise update a root lockfile instead:

  ```bash
  mkdir /tmp/lock && cp frontend/package.json frontend/package-lock.json /tmp/lock/
  cd /tmp/lock && npm install --package-lock-only --legacy-peer-deps --ignore-scripts
  cp package-lock.json <repo>/frontend/package-lock.json
  ```

  `--legacy-peer-deps` is needed for the frontend: `vitest` 5.1 wants `@types/node` 22 or newer while the project
  uses 20, which pnpm only warns about but npm treats as an error. Use `npm update <pkg> --package-lock-only`
  to move a locked transitive package without re-resolving everything.
- npm has its own `overrides` (`frontend/package.json`) for the same two packages pnpm overrides in the root
  `package.json` (`next > postcss`, `source-map-js`); pnpm ignores the npm block and the other way round.

## Production advisory gate

`pnpm run audit:prod` (`scripts/audit-gate.mjs`) audits production dependencies in **all three lockfile sets**
(`pnpm audit --prod` and `npm audit --omit=dev` for each npm lockfile) and fails on any **high or critical**
advisory that has no approved exception. Moderate and low findings are reported by the audit tools but do not
block.

| Exit code | Meaning |
|---|---|
| 0 | pass |
| 1 | policy failure: an unapproved high or critical finding, or a malformed or expired exception |
| 2 | **audit unavailable**: an audit could not run or returned an unreadable report |

An outage is deliberately exit 2, never 0: if the advisory service is down or unreachable, CI fails with an
explicit message instead of passing as if nothing were wrong. Re-run when the service is back.

### Exceptions

If a high or critical finding cannot be fixed yet, add a narrow, owned, expiring entry to
`security/audit-exceptions.json`:

```json
{
  "exceptions": [
    {
      "advisory": "GHSA-xxxx-xxxx-xxxx",
      "package": "left-pad",
      "owner": "Muhammad Zain Abbas",
      "reason": "Fixed release is not published yet; tracked upstream, not reachable from our code.",
      "expires": "2026-12-31"
    }
  ]
}
```

- `advisory` is the GitHub advisory id (shown in the gate's output) and `package` is the vulnerable package.
  An exception covers only that advisory in that package.
- `owner` and a real `reason` (20+ characters) are required.
- `expires` must be a future date no more than **90 days** away. An expired entry fails the gate even if its
  finding is gone, so stale exceptions get removed or renewed with a fresh reason.
- Prefer upgrading or an override over an exception. The file is empty today.

## Running everything locally

```bash
pnpm run verify
```

runs, in order: the lockfile check, the policy script tests, server lint and tests, frontend lint, tests and type
check, and the advisory gate. The database tests (`pnpm --dir server test:db`) need PostgreSQL and run in CI.

## In CI

The `dependency-policy` job in `.github/workflows/ci.yml` runs the lockfile check, the script tests and the
advisory gate on every push and pull request.
