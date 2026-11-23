---
id: 002-dependency-security
unit: 001-dependency-security
intent: 001-repository-hardening
type: simple-construction-bolt
status: complete
stories:
  - 001-upgrade-frontend-production-dependencies
created: 2026-11-17T04:35:54Z
started: 2026-11-17T15:57:13Z
completed: 2026-11-17T16:02:18Z
current_stage: null
stages_completed:
  - name: plan
    completed: 2026-11-17T16:02:18Z
    artifact: https://github.com/sabihuddin10/agile-spm-project/pull/15
  - name: implement
    completed: 2026-11-17T16:02:18Z
    artifact: https://github.com/sabihuddin10/agile-spm-project/pull/15
  - name: test
    completed: 2026-11-17T16:02:18Z
    artifact: https://github.com/sabihuddin10/agile-spm-project/pull/15
owner:
  member: Muhammad Zain Abbas
  student_id: 22k-5028
  group_slot: M9
  role: Frontend Security Engineer
requires_bolts:
  - 001-quality-engineering
enables_bolts:
  - 009-dependency-security
requires_units:
  - 004-quality-engineering
blocks: true
complexity:
  avg_complexity: 3
  avg_uncertainty: 2
  max_dependencies: 3
  testing_scope: 3
---

# Bolt: 002-dependency-security

## Overview

Upgrade the vulnerable frontend production graph to a supported patched baseline.

## Objective

Remove Next.js/PostCSS/source-map-js high and critical findings without breaking App Router, proxy, cookie, or UI behavior.

## Owner

**Muhammad Zain Abbas (22k-5028, M9) — Frontend Security Engineer**

## Stories Included

- [x] **001-upgrade-frontend-production-dependencies**: Upgrade frontend production dependencies (Must)

## Expected Outputs

- Reviewed framework target and migration notes.
- Updated frontend manifest and canonical pnpm lockfile.
- Compatibility changes and focused regressions.
- Clean frontend high/critical production audit.

## Bolt Type

**Type**: Simple Construction Bolt

## Stages

- [x] **1. Plan**: Select patched target and map breaking changes.
- [x] **2. Implement**: Upgrade and adapt the frontend.
- [x] **3. Test**: Run lint, 961 tests, type-check, build, audit, and E2E.

## Dependencies

### Requires

- `001-quality-engineering` (browser baseline)

### Enables

- `009-dependency-security`

## Success Criteria

- [x] No high/critical frontend production advisory remains unapproved.
- [x] All frontend and browser gates pass.
- [x] Migration rationale and residual moderate/low findings are documented.

## Completion record

- **Delivered in**: [pull request #15](https://github.com/sabihuddin10/agile-spm-project/pull/15), merge commit `03dafc1`, merged 2026-11-17T16:02:18Z.
- **Started**: 2026-11-17T15:57:13Z (first commit of the branch). Stage completion times are recorded as the merge time: the stages were not timed individually.
- **Owner**: Muhammad Zain Abbas (all nine bolts were reassigned to one owner, agreed with the professor).
- **What shipped**:
  - Next.js 14.2.35 to 15.5.29 (React 18 kept), `eslint-config-next` to match; overrides for the PostCSS copy Next bundles and for `source-map-js`.
  - Frontend production advisories 30 to 0. Lint, 991 unit tests, type check, production build and the three-browser suite pass; no application code needed changing.
  - Migration notes and the version rationale: `docs/frontend-dependency-upgrade.md`.
- **Notes and deviations**:
  - Vercel installs from the npm lockfiles, which still pinned Next 14 at this point; they were regenerated in bolt 009.
- **Checks**: every pull request passed CI (`build-and-test` with Postgres 16 and Node 22, `e2e` on three browsers, `dependency-policy` once it existed, and both Vercel previews) before merging.
