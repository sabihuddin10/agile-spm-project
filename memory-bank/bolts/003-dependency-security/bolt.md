---
id: 003-dependency-security
unit: 001-dependency-security
intent: 001-repository-hardening
type: simple-construction-bolt
status: planned
stories:
  - 002-upgrade-backend-production-dependencies
created: 2026-11-17T04:35:54Z
started: null
completed: null
current_stage: null
stages_completed: []
owner:
  member: Syed Okasha
  student_id: 23k-0850
  group_slot: M3
  role: Backend Security Engineer
requires_bolts:
  - 001-quality-engineering
enables_bolts:
  - 009-dependency-security
requires_units:
  - 004-quality-engineering
blocks: true
complexity:
  avg_complexity: 2
  avg_uncertainty: 2
  max_dependencies: 3
  testing_scope: 3
---

# Bolt: 003-dependency-security

## Overview

Upgrade the vulnerable backend middleware graph and add exploit-shaped regression coverage.

## Objective

Resolve body-parser, proxy-addr, qs, and Morgan advisories while preserving all API parsing, proxy, and error contracts.

## Owner

**Syed Okasha (23k-0850, M3) — Backend Security Engineer**

## Stories Included

- [ ] **002-upgrade-backend-production-dependencies**: Upgrade backend production dependencies (Must)

## Expected Outputs

- Updated server manifest and canonical pnpm lockfile.
- Regression tests for malformed/compressed/proxy-shaped traffic.
- Clean backend high/critical production audit.
- Compatibility notes.

## Bolt Type

**Type**: Simple Construction Bolt

## Stages

- [ ] **1. Plan**: Confirm patched versions and affected request paths.
- [ ] **2. Implement**: Upgrade middleware and add defensive tests/config.
- [ ] **3. Test**: Run lint, 401 tests, database tests, audit, and E2E.

## Dependencies

### Requires

- `001-quality-engineering` (browser baseline)

### Enables

- `009-dependency-security`

## Success Criteria

- [ ] All targeted findings are resolved.
- [ ] Malformed traffic cannot terminate the API process.
- [ ] All server/database/browser gates pass.
