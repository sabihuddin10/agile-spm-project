---
id: 009-dependency-security
unit: 001-dependency-security
intent: 001-repository-hardening
type: simple-construction-bolt
status: planned
stories:
  - 003-enforce-lockfile-and-audit-policy
created: 2026-11-17T04:35:54Z
started: null
completed: null
current_stage: null
stages_completed: []
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

- [ ] **003-enforce-lockfile-and-audit-policy**: Enforce lockfile and audit policy (Must)

## Expected Outputs

- One canonical `pnpm-lock.yaml` and lockfile-policy documentation.
- Root verification scripts covering both workspaces.
- CI production advisory gate and exception schema/process.
- Clean-checkout frozen-install evidence.

## Bolt Type

**Type**: Simple Construction Bolt

## Stages

- [ ] **1. Plan**: Define lockfile and advisory exception policy.
- [ ] **2. Implement**: Remove competing locks and add scripts/CI gate.
- [ ] **3. Test**: Verify clean install, outage behavior, policy failures, and full CI.

## Dependencies

### Requires

- `002-dependency-security`
- `003-dependency-security`

### Enables

- Reproducible and security-gated future releases.

## Success Criteria

- [ ] `pnpm-lock.yaml` is the sole active JavaScript lockfile.
- [ ] Frozen install and full root verification succeed.
- [ ] Unapproved high/critical production findings fail CI.
- [ ] Advisory-service failures cannot produce false green builds.
