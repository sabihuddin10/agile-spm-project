---
id: 001-quality-engineering
unit: 004-quality-engineering
intent: 001-repository-hardening
type: simple-construction-bolt
status: complete
stories:
  - 001-add-critical-path-e2e-suite
created: 2026-11-17T04:35:54Z
started: 2026-11-17T14:54:34Z
completed: 2026-11-17T15:33:23Z
current_stage: null
stages_completed:
  - name: plan
    completed: 2026-11-17T15:33:23Z
    artifact: https://github.com/sabihuddin10/agile-spm-project/pull/14
  - name: implement
    completed: 2026-11-17T15:33:23Z
    artifact: https://github.com/sabihuddin10/agile-spm-project/pull/14
  - name: test
    completed: 2026-11-17T15:33:23Z
    artifact: https://github.com/sabihuddin10/agile-spm-project/pull/14
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

- [x] **001-add-critical-path-e2e-suite**: Add critical-path E2E suite (Must)

## Expected Outputs

- Browser test configuration and deterministic start/stop harness.
- Customer and staff smoke journeys.
- CI job with trace/screenshot/log artifacts.
- Short testing/runbook documentation.

## Bolt Type

**Type**: Simple Construction Bolt
**Definition**: `.specsmd/aidlc/templates/construction/bolt-types/simple-construction-bolt.md`

## Stages

- [x] **1. Plan**: Select journeys, data isolation, ports, and CI artifact policy.
- [x] **2. Implement**: Add harness, browser tests, scripts, and CI integration.
- [x] **3. Test**: Prove deterministic production-build execution and failure artifacts.

## Dependencies

### Requires

- None.

### Enables

- `002-dependency-security`
- `003-dependency-security`

## Success Criteria

- [x] Both critical journeys pass against production builds.
- [x] Failure artifacts are retained in CI.
- [x] Suite completes in under 10 minutes.
- [x] No production data is used.

## Completion record

- **Delivered in**: [pull request #14](https://github.com/sabihuddin10/agile-spm-project/pull/14), merge commit `5e71f2b`, merged 2026-11-17T15:33:23Z.
- **Started**: 2026-11-17T14:54:34Z (first commit of the branch). Stage completion times are recorded as the merge time: the stages were not timed individually.
- **Owner**: Muhammad Zain Abbas (all nine bolts were reassigned to one owner, agreed with the professor).
- **What shipped**:
  - Playwright suite `e2e/tests/critical-path.spec.ts` against production builds on isolated ports (API 4100, web 3100), in-memory data only: a customer places a pickup order, a waiter confirms it, a chef sees it in the kitchen queue, and a customer is refused at `/staff/kitchen`.
  - Runs on Chromium, Firefox and WebKit (12 tests). CI job `e2e` has a 10-minute timeout and runs in about 2 minutes.
  - On failure the job uploads the HTML report, traces, screenshots and server logs; verified locally by breaking an assertion on purpose. Runbook: `docs/e2e.md`.
- **Notes and deviations**:
  - The test API runs with `NODE_ENV=test`: WebKit refuses a `Secure` session cookie over plain `http://localhost`, so sign-in failed only in that engine. The frontend under test is a real production build.
- **Checks**: every pull request passed CI (`build-and-test` with Postgres 16 and Node 22, `e2e` on three browsers, `dependency-policy` once it existed, and both Vercel previews) before merging.
