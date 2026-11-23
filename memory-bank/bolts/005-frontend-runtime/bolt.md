---
id: 005-frontend-runtime
unit: 003-frontend-runtime
intent: 001-repository-hardening
type: simple-construction-bolt
status: complete
stories:
  - 001-harden-polling-lifecycle
created: 2026-11-17T04:35:54Z
started: 2026-11-18T07:51:42Z
completed: 2026-11-18T07:56:19Z
current_stage: null
stages_completed:
  - name: plan
    completed: 2026-11-18T07:56:19Z
    artifact: https://github.com/sabihuddin10/agile-spm-project/pull/19
  - name: implement
    completed: 2026-11-18T07:56:19Z
    artifact: https://github.com/sabihuddin10/agile-spm-project/pull/19
  - name: test
    completed: 2026-11-18T07:56:19Z
    artifact: https://github.com/sabihuddin10/agile-spm-project/pull/19
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

- [x] **001-harden-polling-lifecycle**: Harden polling lifecycle (Should)

## Expected Outputs

- Updated shared polling hook contract.
- Hook tests for slow/rejected callbacks, visibility, disable, interval change, and Strict Mode cleanup.
- Consumer compatibility review.

## Bolt Type

**Type**: Simple Construction Bolt

## Stages

- [x] **1. Plan**: Choose single-flight and optional cancellation/generation semantics.
- [x] **2. Implement**: Update hook and affected consumers.
- [x] **3. Test**: Exercise timers, promises, cleanup, and representative screens.

## Dependencies

### Requires

- None.

### Enables

- Stable live operations screens under slow networks.

## Success Criteria

- [x] Maximum one in-flight callback per poller.
- [x] No unhandled rejection or post-cleanup rescheduling.
- [x] Existing frontend suite remains green.

## Completion record

- **Delivered in**: [pull request #19](https://github.com/sabihuddin10/agile-spm-project/pull/19), merge commit `4cfb29f`, merged 2026-11-18T07:56:19Z.
- **Started**: 2026-11-18T07:51:42Z (first commit of the branch). Stage completion times are recorded as the merge time: the stages were not timed individually.
- **Owner**: Muhammad Zain Abbas (all nine bolts were reassigned to one owner, agreed with the professor).
- **What shipped**:
  - `usePolling` now allows one callback in flight per poller (interval and visibility triggers alike), never produces an unhandled rejection, recovers on the next interval, and clears its timer and listener on disable, unmount and interval change. The in-flight flag outlives the effect, so changing the interval during a slow request cannot overlap. Signature unchanged; none of the 16 consumers changed.
  - 17 hook tests, 5 of which fail against the original hook (checked by restoring it temporarily).
- **Notes and deviations**:
  - One existing test (`staff/orders` polling) advanced two intervals in one synchronous jump and only reached 3 calls because of the overlapping requests removed here; it now lets each request settle between ticks. Expected counts are unchanged.
- **Checks**: every pull request passed CI (`build-and-test` with Postgres 16 and Node 22, `e2e` on three browsers, `dependency-policy` once it existed, and both Vercel previews) before merging.
