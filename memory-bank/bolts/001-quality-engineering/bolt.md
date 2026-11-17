---
id: 001-quality-engineering
unit: 004-quality-engineering
intent: 001-repository-hardening
type: simple-construction-bolt
status: planned
stories:
  - 001-add-critical-path-e2e-suite
created: 2026-11-17T04:35:54Z
started: null
completed: null
current_stage: null
stages_completed: []
owner:
  member: Muhammad Zain Abbas
  student_id: 22k-5028
  group_slot: M9
  role: QA Automation Engineer
requires_bolts: []
enables_bolts:
  - 002-dependency-security
  - 003-dependency-security
requires_units: []
blocks: false
complexity:
  avg_complexity: 2
  avg_uncertainty: 2
  max_dependencies: 2
  testing_scope: 3
---

# Bolt: 001-quality-engineering

## Overview

Establish a small production-build browser suite before dependency upgrades begin.

## Objective

Cover one customer and one staff critical journey across browser, Next.js proxy, Express API, session cookie, and seeded state.

## Owner

**Muhammad Zain Abbas (22k-5028, M9) — QA Automation Engineer**

## Stories Included

- [ ] **001-add-critical-path-e2e-suite**: Add critical-path E2E suite (Must)

## Expected Outputs

- Browser test configuration and deterministic start/stop harness.
- Customer and staff smoke journeys.
- CI job with trace/screenshot/log artifacts.
- Short testing/runbook documentation.

## Bolt Type

**Type**: Simple Construction Bolt
**Definition**: `.specsmd/aidlc/templates/construction/bolt-types/simple-construction-bolt.md`

## Stages

- [ ] **1. Plan**: Select journeys, data isolation, ports, and CI artifact policy.
- [ ] **2. Implement**: Add harness, browser tests, scripts, and CI integration.
- [ ] **3. Test**: Prove deterministic production-build execution and failure artifacts.

## Dependencies

### Requires

- None.

### Enables

- `002-dependency-security`
- `003-dependency-security`

## Success Criteria

- [ ] Both critical journeys pass against production builds.
- [ ] Failure artifacts are retained in CI.
- [ ] Suite completes in under 10 minutes.
- [ ] No production data is used.
