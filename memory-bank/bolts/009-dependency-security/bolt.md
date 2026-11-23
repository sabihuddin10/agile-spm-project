---
id: 009-dependency-security
unit: 001-dependency-security
intent: 001-repository-hardening
type: simple-construction-bolt
status: complete
stories:
  - 003-enforce-lockfile-and-audit-policy
created: 2026-11-17T04:35:54Z
started: 2026-11-17T17:45:42Z
completed: 2026-11-17T17:51:19Z
current_stage: null
stages_completed:
  - name: plan
    completed: 2026-11-17T17:51:19Z
    artifact: https://github.com/sabihuddin10/agile-spm-project/pull/17
  - name: implement
    completed: 2026-11-17T17:51:19Z
    artifact: https://github.com/sabihuddin10/agile-spm-project/pull/17
  - name: test
    completed: 2026-11-17T17:51:19Z
    artifact: https://github.com/sabihuddin10/agile-spm-project/pull/17
owner:
  member: Muhammad Zain Abbas
  student_id: 22k-5028
  group_slot: M9
  role: Dependency Governance Engineer
requires_bolts:
  - 002-dependency-security
  - 003-dependency-security
enables_bolts: []
requires_units: []
blocks: true
complexity:
  avg_complexity: 2
  avg_uncertainty: 1
  max_dependencies: 3
  testing_scope: 2
---

# Bolt: 009-dependency-security

## Overview

Make the remediated pnpm graph canonical and enforce a durable production advisory policy.

## Objective

Remove competing npm lockfiles, add reproducible root verification/audit commands, and gate high/critical findings in CI with narrow expiring exceptions only.

## Owner

**Muhammad Zain Abbas (22k-5028, M9) — Dependency Governance Engineer**

## Stories Included

- [x] **003-enforce-lockfile-and-audit-policy**: Enforce lockfile and audit policy (Must)

## Expected Outputs

- One canonical `pnpm-lock.yaml` and lockfile-policy documentation.
- Root verification scripts covering both workspaces.
- CI production advisory gate and exception schema/process.
- Clean-checkout frozen-install evidence.

## Bolt Type

**Type**: Simple Construction Bolt

## Stages

- [x] **1. Plan**: Define lockfile and advisory exception policy.
- [x] **2. Implement**: Remove competing locks and add scripts/CI gate.
- [x] **3. Test**: Verify clean install, outage behavior, policy failures, and full CI.

## Dependencies

### Requires

- `002-dependency-security`
- `003-dependency-security`

### Enables

- Reproducible and security-gated future releases.

## Success Criteria

- [ ] `pnpm-lock.yaml` is the sole active JavaScript lockfile *(not met, deliberately: see the deviation below)*.
- [x] Frozen install and full root verification succeed.
- [x] Unapproved high/critical production findings fail CI.
- [x] Advisory-service failures cannot produce false green builds.

## Completion record

- **Delivered in**: [pull request #17](https://github.com/sabihuddin10/agile-spm-project/pull/17), merge commit `c620b32`, merged 2026-11-17T17:51:19Z.
- **Started**: 2026-11-17T17:45:42Z (first commit of the branch). Stage completion times are recorded as the merge time: the stages were not timed individually.
- **Owner**: Muhammad Zain Abbas (all nine bolts were reassigned to one owner, agreed with the professor).
- **What shipped**:
  - `pnpm run audit:prod` audits the pnpm lockfile and both npm lockfiles and fails on any unapproved high or critical production advisory. Exit codes: 0 pass, 1 policy failure, 2 audit unavailable (a registry outage never passes). Exceptions live in `security/audit-exceptions.json` and need an owner, a real reason and an expiry within 90 days.
  - `pnpm run check:lockfiles` fails on an unexpected lockfile or an npm lockfile that no longer matches its `package.json`; `pnpm run verify` runs both workspaces plus the security checks; new `dependency-policy` CI job; 25 policy tests; clean-clone frozen install verified. Policy: `docs/dependency-policy.md`.
  - Found and fixed: both npm lockfiles were stale (frontend still pinned Next 14.2.35; server the vulnerable body-parser, proxy-addr and qs), so bolts 002 and 003 had only reached `pnpm-lock.yaml`. Both were regenerated.
- **Notes and deviations**:
  - **Deviation:** `pnpm-lock.yaml` is NOT the only lockfile. Vercel installs each project from its own folder with npm, so `frontend/package-lock.json` and `server/package-lock.json` were kept on purpose (removing them would change how production installs). They are guarded instead: kept in sync with their `package.json` and audited. The requirements allow npm lockfiles to stay when explicitly justified; the justification is in `docs/dependency-policy.md`.
- **Checks**: every pull request passed CI (`build-and-test` with Postgres 16 and Node 22, `e2e` on three browsers, `dependency-policy` once it existed, and both Vercel previews) before merging.
