---
id: 007-quality-engineering
unit: 004-quality-engineering
intent: 001-repository-hardening
type: simple-construction-bolt
status: complete
stories:
  - 002-optimize-frontend-test-runtime
created: 2026-11-17T04:35:54Z
started: 2026-11-18T08:38:38Z
completed: 2026-11-18T08:42:14Z
current_stage: null
stages_completed:
  - name: plan
    completed: 2026-11-18T08:42:14Z
    artifact: https://github.com/sabihuddin10/agile-spm-project/pull/21
  - name: implement
    completed: 2026-11-18T08:42:14Z
    artifact: https://github.com/sabihuddin10/agile-spm-project/pull/21
  - name: test
    completed: 2026-11-18T08:42:14Z
    artifact: https://github.com/sabihuddin10/agile-spm-project/pull/21
owner:
  member: Muhammad Zain Abbas
  student_id: 22k-5028
  group_slot: M9
  role: Test Infrastructure Engineer
requires_bolts: []
enables_bolts: []
requires_units: []
blocks: false
complexity:
  avg_complexity: 2
  avg_uncertainty: 2
  max_dependencies: 1
  testing_scope: 2
---

# Bolt: 007-quality-engineering

## Overview

Benchmark and tune Vitest worker/environment configuration without sacrificing isolation.

## Objective

Reduce the 101.81-second audit baseline by at least 30% while keeping all 961 tests deterministic.

## Owner

**Muhammad Zain Abbas (22k-5028, M9) — Test Infrastructure Engineer**

## Stories Included

- [x] **002-optimize-frontend-test-runtime**: Optimize frontend test runtime (Should)

## Expected Outputs

- Reproducible benchmark method and three-run baseline/after results.
- Tuned Vitest configuration.
- Isolation/leak regression tests or documented safeguards.
- CI worker/resource guidance.

## Bolt Type

**Type**: Simple Construction Bolt

## Stages

- [x] **1. Plan**: Define comparable measurements and candidate configurations.
- [x] **2. Implement**: Apply the fastest deterministic safe configuration.
- [x] **3. Test**: Run repeated full suites and verify isolation.

## Dependencies

### Requires

- None.

### Enables

- Faster local/CI feedback for all other bolts.

## Success Criteria

- [x] Median duration improves at least 30%.
- [x] All 96 files/961 tests pass repeatedly.
- [x] No cross-file state leak or increased flake rate is observed.

## Completion record

- **Delivered in**: [pull request #21](https://github.com/sabihuddin10/agile-spm-project/pull/21), merge commit `7633042`, merged 2026-11-18T08:42:14Z.
- **Started**: 2026-11-18T08:38:38Z (first commit of the branch). Stage completion times are recorded as the merge time: the stages were not timed individually.
- **Owner**: Muhammad Zain Abbas (all nine bolts were reassigned to one owner, agreed with the professor).
- **What shipped**:
  - Vitest `pool: vmThreads` (one worker per CPU, a sandboxed global scope per file). Median of three full runs on the same machine: 140.3 s to 35.6 s, **74.6% faster**, all 1,043 tests passing every run; on GitHub runners the unit-test step went 35 s to 16 s.
  - `check:isolation` (CI step): fixtures pollute window, globals, storage, cookies, DOM, a timer, module state and a stubbed env var, and the next file in the same worker must see none of it; a control run with isolation off must fail; no test may write `process.env` directly. It found and fixed a real env-stub leak between files.
  - `bench:test` repeats the suite and reports each run and the median; any failing test fails the benchmark. Method, numbers, limits and how to back out: `docs/frontend-test-performance.md`.
- **Notes and deviations**:
  - The original 101.81 s audit baseline came from a different machine; the comparison above is on one machine (140.3 s before).
- **Checks**: every pull request passed CI (`build-and-test` with Postgres 16 and Node 22, `e2e` on three browsers, `dependency-policy` once it existed, and both Vercel previews) before merging.
