---
id: 003-dependency-security
unit: 001-dependency-security
intent: 001-repository-hardening
type: simple-construction-bolt
status: complete
stories:
  - 002-upgrade-backend-production-dependencies
created: 2026-11-17T04:35:54Z
started: 2026-11-17T16:42:41Z
completed: 2026-11-17T16:51:20Z
current_stage: null
stages_completed:
  - name: plan
    completed: 2026-11-17T16:51:20Z
    artifact: https://github.com/sabihuddin10/agile-spm-project/pull/16
  - name: implement
    completed: 2026-11-17T16:51:20Z
    artifact: https://github.com/sabihuddin10/agile-spm-project/pull/16
  - name: test
    completed: 2026-11-17T16:51:20Z
    artifact: https://github.com/sabihuddin10/agile-spm-project/pull/16
owner:
  member: Muhammad Zain Abbas
  student_id: 22k-5028
  group_slot: M9
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

**Muhammad Zain Abbas (22k-5028, M9) — Backend Security Engineer**

## Stories Included

- [x] **002-upgrade-backend-production-dependencies**: Upgrade backend production dependencies (Must)

## Expected Outputs

- Updated server manifest and canonical pnpm lockfile.
- Regression tests for malformed/compressed/proxy-shaped traffic.
- Clean backend high/critical production audit.
- Compatibility notes.

## Bolt Type

**Type**: Simple Construction Bolt

## Stages

- [x] **1. Plan**: Confirm patched versions and affected request paths.
- [x] **2. Implement**: Upgrade middleware and add defensive tests/config.
- [x] **3. Test**: Run lint, 401 tests, database tests, audit, and E2E.

## Dependencies

### Requires

- `001-quality-engineering` (browser baseline)

### Enables

- `009-dependency-security`

## Success Criteria

- [x] All targeted findings are resolved.
- [x] Malformed traffic cannot terminate the API process.
- [x] All server/database/browser gates pass.

## Completion record

- **Delivered in**: [pull request #16](https://github.com/sabihuddin10/agile-spm-project/pull/16), merge commit `b3e3813`, merged 2026-11-17T16:51:20Z.
- **Started**: 2026-11-17T16:42:41Z (first commit of the branch). Stage completion times are recorded as the merge time: the stages were not timed individually.
- **Owner**: Muhammad Zain Abbas (all nine bolts were reassigned to one owner, agreed with the professor).
- **What shipped**:
  - Express 4.22.3 and Morgan 1.12.1; overrides pin body-parser 1.20.9 and proxy-addr 2.0.8 (qs follows to 6.16.2). Still Express 4. Production audit reports no findings.
  - 14 regression tests (`server/test/middleware/request-hardening.test.js`): compressed bodies with trailing bytes, truncated or mislabeled compression, malformed JSON, the 100 KB limit, prototype-shaped keys, hostile query strings, and X-Forwarded-For handling with and without the Vercel trust setting. The API keeps answering after each.
  - Notes: `docs/backend-dependency-upgrade.md`.
- **Checks**: every pull request passed CI (`build-and-test` with Postgres 16 and Node 22, `e2e` on three browsers, `dependency-policy` once it existed, and both Vercel previews) before merging.
