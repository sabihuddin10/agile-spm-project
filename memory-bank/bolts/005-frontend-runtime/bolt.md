---
id: 005-frontend-runtime
unit: 003-frontend-runtime
intent: 001-repository-hardening
type: simple-construction-bolt
status: planned
stories:
  - 001-harden-polling-lifecycle
created: 2026-11-17T04:35:54Z
started: null
completed: null
current_stage: null
stages_completed: []
owner:
  member: Muhammad Zain Abbas
  student_id: 22k-5028
  group_slot: M9
  role: Frontend Reliability Engineer
requires_bolts: []
enables_bolts: []
requires_units: []
blocks: false
complexity:
  avg_complexity: 2
  avg_uncertainty: 1
  max_dependencies: 2
  testing_scope: 2
---

# Bolt: 005-frontend-runtime

## Overview

Give the shared polling hook single-flight and cleanup semantics used by sixteen live-data consumers.

## Objective

Prevent overlapping callbacks, unhandled rejections, and stale scheduling across visibility, enablement, interval, and unmount changes.

## Owner

**Muhammad Zain Abbas (22k-5028, M9) — Frontend Reliability Engineer**

## Stories Included

- [ ] **001-harden-polling-lifecycle**: Harden polling lifecycle (Should)

## Expected Outputs

- Updated shared polling hook contract.
- Hook tests for slow/rejected callbacks, visibility, disable, interval change, and Strict Mode cleanup.
- Consumer compatibility review.

## Bolt Type

**Type**: Simple Construction Bolt

## Stages

- [ ] **1. Plan**: Choose single-flight and optional cancellation/generation semantics.
- [ ] **2. Implement**: Update hook and affected consumers.
- [ ] **3. Test**: Exercise timers, promises, cleanup, and representative screens.

## Dependencies

### Requires

- None.

### Enables

- Stable live operations screens under slow networks.

## Success Criteria

- [ ] Maximum one in-flight callback per poller.
- [ ] No unhandled rejection or post-cleanup rescheduling.
- [ ] Existing frontend suite remains green.
