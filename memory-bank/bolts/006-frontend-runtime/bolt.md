---
id: 006-frontend-runtime
unit: 003-frontend-runtime
intent: 001-repository-hardening
type: simple-construction-bolt
status: complete
stories:
  - 002-isolate-workforce-mock
created: 2026-11-17T04:35:54Z
started: 2026-11-18T08:16:55Z
completed: 2026-11-18T08:20:22Z
current_stage: null
stages_completed:
  - name: plan
    completed: 2026-11-18T08:20:22Z
    artifact: https://github.com/sabihuddin10/agile-spm-project/pull/20
  - name: implement
    completed: 2026-11-18T08:20:22Z
    artifact: https://github.com/sabihuddin10/agile-spm-project/pull/20
  - name: test
    completed: 2026-11-18T08:20:22Z
    artifact: https://github.com/sabihuddin10/agile-spm-project/pull/20
owner:
  member: Muhammad Zain Abbas
  student_id: 22k-5028
  group_slot: M9
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

**Muhammad Zain Abbas (22k-5028, M9) — Frontend Performance Engineer**

## Stories Included

- [x] **002-isolate-workforce-mock**: Isolate workforce mock (Should)

## Expected Outputs

- Real/mock adapter boundary.
- Mock-mode test setup.
- Production bundle assertion or analyzer evidence.
- Updated developer documentation for mock mode.

## Bolt Type

**Type**: Simple Construction Bolt

## Stages

- [x] **1. Plan**: Choose build-time or lazy mock-only module boundary.
- [x] **2. Implement**: Separate adapters without changing callers.
- [x] **3. Test**: Verify real mode, mock mode, and production chunk contents.

## Dependencies

### Requires

- None.

### Enables

- Smaller, cleaner production client bundles.

## Success Criteria

- [x] Production bundle contains no workforce mock module/demo seeds.
- [x] Mock tests remain deterministic.
- [x] Real workforce API behavior is unchanged.

## Completion record

- **Delivered in**: [pull request #20](https://github.com/sabihuddin10/agile-spm-project/pull/20), merge commit `3cd09f8`, merged 2026-11-18T08:20:22Z.
- **Started**: 2026-11-18T08:16:55Z (first commit of the branch). Stage completion times are recorded as the merge time: the stages were not timed individually.
- **Owner**: Muhammad Zain Abbas (all nine bolts were reassigned to one owner, agreed with the professor).
- **What shipped**:
  - `DEFAULT_ATTENDANCE_SETTINGS` moved to `lib/attendance-defaults.ts`; `workforce-api.ts` loads the mock lazily and only when `NEXT_PUBLIC_WORKFORCE_MOCK` is exactly `true`; real-mode API calls are unchanged. `next.config.mjs` defines the flag at build time (a normal build previously still shipped the mock when the variable was unset).
  - `pnpm --dir frontend run check:bundle` (also a CI step) scans the build output for the mock's demo data: passes with the flag unset and with malformed values, and a `--expect` control proves it can detect the mock when enabled.
  - 18 adapter tests; real-mode My work and Workforce endpoints exercised against the real API in a browser.
- **Checks**: every pull request passed CI (`build-and-test` with Postgres 16 and Node 22, `e2e` on three browsers, `dependency-policy` once it existed, and both Vercel previews) before merging.
