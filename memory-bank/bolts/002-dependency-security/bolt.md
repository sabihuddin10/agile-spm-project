---
id: 002-dependency-security
unit: 001-dependency-security
intent: 001-repository-hardening
type: simple-construction-bolt
status: planned
stories:
  - 001-upgrade-frontend-production-dependencies
created: 2026-11-17T04:35:54Z
started: null
completed: null
current_stage: null
stages_completed: []
owner:
  member: Shah Anas Khan
  student_id: 23K-3028
  group_slot: M2
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

**Shah Anas Khan (23K-3028, M2) — Frontend Security Engineer**

## Stories Included

- [ ] **001-upgrade-frontend-production-dependencies**: Upgrade frontend production dependencies (Must)

## Expected Outputs

- Reviewed framework target and migration notes.
- Updated frontend manifest and canonical pnpm lockfile.
- Compatibility changes and focused regressions.
- Clean frontend high/critical production audit.

## Bolt Type

**Type**: Simple Construction Bolt

## Stages

- [ ] **1. Plan**: Select patched target and map breaking changes.
- [ ] **2. Implement**: Upgrade and adapt the frontend.
- [ ] **3. Test**: Run lint, 961 tests, type-check, build, audit, and E2E.

## Dependencies

### Requires

- `001-quality-engineering` (browser baseline)

### Enables

- `009-dependency-security`

## Success Criteria

- [ ] No high/critical frontend production advisory remains unapproved.
- [ ] All frontend and browser gates pass.
- [ ] Migration rationale and residual moderate/low findings are documented.
