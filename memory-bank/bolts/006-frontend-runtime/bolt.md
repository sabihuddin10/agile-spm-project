---
id: 006-frontend-runtime
unit: 003-frontend-runtime
intent: 001-repository-hardening
type: simple-construction-bolt
status: planned
stories:
  - 002-isolate-workforce-mock
created: 2026-11-17T04:35:54Z
started: null
completed: null
current_stage: null
stages_completed: []
owner:
  member: Khalil
  student_id: k232007
  group_slot: M6
  role: Frontend Performance Engineer
requires_bolts: []
enables_bolts: []
requires_units: []
blocks: false
complexity:
  avg_complexity: 2
  avg_uncertainty: 2
  max_dependencies: 2
  testing_scope: 2
---

# Bolt: 006-frontend-runtime

## Overview

Split the real workforce API adapter from demo-only mock code at the production bundle boundary.

## Objective

Keep mock behavior in tests/dev without statically importing or instantiating mock data in production clients.

## Owner

**Khalil (k232007, M6) — Frontend Performance Engineer**

## Stories Included

- [ ] **002-isolate-workforce-mock**: Isolate workforce mock (Should)

## Expected Outputs

- Real/mock adapter boundary.
- Mock-mode test setup.
- Production bundle assertion or analyzer evidence.
- Updated developer documentation for mock mode.

## Bolt Type

**Type**: Simple Construction Bolt

## Stages

- [ ] **1. Plan**: Choose build-time or lazy mock-only module boundary.
- [ ] **2. Implement**: Separate adapters without changing callers.
- [ ] **3. Test**: Verify real mode, mock mode, and production chunk contents.

## Dependencies

### Requires

- None.

### Enables

- Smaller, cleaner production client bundles.

## Success Criteria

- [ ] Production bundle contains no workforce mock module/demo seeds.
- [ ] Mock tests remain deterministic.
- [ ] Real workforce API behavior is unchanged.
