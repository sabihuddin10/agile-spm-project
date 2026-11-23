---
id: 008-deployment-safety
unit: 005-deployment-safety
intent: 001-repository-hardening
type: simple-construction-bolt
status: complete
stories:
  - 001-validate-production-configuration
created: 2026-11-17T04:35:54Z
started: 2026-11-18T07:25:13Z
completed: 2026-11-18T07:34:45Z
current_stage: null
stages_completed:
  - name: plan
    completed: 2026-11-18T07:34:45Z
    artifact: https://github.com/sabihuddin10/agile-spm-project/pull/18
  - name: implement
    completed: 2026-11-18T07:34:45Z
    artifact: https://github.com/sabihuddin10/agile-spm-project/pull/18
  - name: test
    completed: 2026-11-18T07:34:45Z
    artifact: https://github.com/sabihuddin10/agile-spm-project/pull/18
owner:
  member: Muhammad Zain Abbas
  student_id: 22k-5028
  group_slot: M9
  role: Release Engineer
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

# Bolt: 008-deployment-safety

## Overview

Add a tested environment contract that fails production builds/starts before a broken deployment is published.

## Objective

Reject missing, malformed, or localhost production API origins and preserve/extend the API's production secret checks.

## Owner

**Muhammad Zain Abbas (22k-5028, M9) — Release Engineer**

## Stories Included

- [x] **001-validate-production-configuration**: Validate production configuration (Must)

## Expected Outputs

- Shared frontend configuration validation used by rewrites and health proxy.
- Server production configuration checks/tests.
- Updated `.env.example`, README, and deployment verification.

## Bolt Type

**Type**: Simple Construction Bolt

## Stages

- [x] **1. Plan**: Define environment-specific required/allowed values.
- [x] **2. Implement**: Add validation and align consumers/docs.
- [x] **3. Test**: Exercise valid local/preview/prod and invalid prod matrices.

## Dependencies

### Requires

- None.

### Enables

- Deterministic safe releases.

## Success Criteria

- [x] Production cannot fall back to localhost.
- [x] Errors are actionable and never reveal secret values.
- [x] Local developer defaults remain convenient.

## Completion record

- **Delivered in**: [pull request #18](https://github.com/sabihuddin10/agile-spm-project/pull/18), merge commit `5fe9916`, merged 2026-11-18T07:34:45Z.
- **Started**: 2026-11-18T07:25:13Z (first commit of the branch). Stage completion times are recorded as the merge time: the stages were not timed individually.
- **Owner**: Muhammad Zain Abbas (all nine bolts were reassigned to one owner, agreed with the professor).
- **What shipped**:
  - `frontend/src/lib/api-origin.mjs`: one validator shared by the Next rewrite and the `/api/health` route. A production build fails when `API_URL` is missing, malformed, not https or points at localhost; errors name the setting and never print its value; local development keeps its default. `ALLOW_LOCAL_API=1` opts a deliberately local production build out (CI, browser tests).
  - The API keeps refusing to start in production without a real `JWT_SECRET`; tests added. `.env.example` and the README match the code.
- **Notes and deviations**:
  - `main` received a parallel implementation of the same rule by direct push; the two were reconciled in the sync pull request #24 (one validator with every rule from both; a path in `API_URL` is now rejected).
  - The stricter server rules from `main` (secret of at least 32 characters, `DATABASE_URL` required) were changed in pull request #25 to log a `[config]` warning instead of refusing to start, because a live API must not be taken down by settings nobody could check; `STRICT_PRODUCTION_CONFIG=1` restores refusal.
- **Checks**: every pull request passed CI (`build-and-test` with Postgres 16 and Node 22, `e2e` on three browsers, `dependency-policy` once it existed, and both Vercel previews) before merging.
