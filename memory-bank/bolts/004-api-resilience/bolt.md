---
id: 004-api-resilience
unit: 002-api-resilience
intent: 001-repository-hardening
type: ddd-construction-bolt
status: complete
stories:
  - 001-distribute-security-rate-limits
created: 2026-11-17T04:35:54Z
started: 2026-11-18T08:54:18Z
completed: 2026-11-18T08:57:14Z
current_stage: null
stages_completed:
  - name: model
    completed: 2026-11-18T08:57:14Z
    artifact: https://github.com/sabihuddin10/agile-spm-project/pull/22
  - name: design
    completed: 2026-11-18T08:57:14Z
    artifact: https://github.com/sabihuddin10/agile-spm-project/pull/22
  - name: adr-analysis
    completed: 2026-11-18T08:57:14Z
    artifact: https://github.com/sabihuddin10/agile-spm-project/pull/22
  - name: implement
    completed: 2026-11-18T08:57:14Z
    artifact: https://github.com/sabihuddin10/agile-spm-project/pull/22
  - name: test
    completed: 2026-11-18T08:57:14Z
    artifact: https://github.com/sabihuddin10/agile-spm-project/pull/22
owner:
  member: Muhammad Zain Abbas
  student_id: 22k-5028
  group_slot: M9
  role: Platform Reliability Engineer
requires_bolts: []
enables_bolts: []
requires_units: []
blocks: false
complexity:
  avg_complexity: 3
  avg_uncertainty: 2
  max_dependencies: 3
  testing_scope: 3
---

# Bolt: 004-api-resilience

## Overview

Model and implement cross-instance rate-limit decisions for sensitive API paths.

## Objective

Separate limiter policy from storage and provide an atomic production adapter plus deterministic in-memory adapter.

## Owner

**Muhammad Zain Abbas (22k-5028, M9) — Platform Reliability Engineer**

## Stories Included

- [x] **001-distribute-security-rate-limits**: Distribute security rate limits (Must)

## Expected Outputs

- Limit-key/window/decision domain model.
- Storage adapter contract and selected production implementation.
- Middleware integration with outage behavior.
- Concurrency, cross-instance, and existing semantic tests.

## Bolt Type

**Type**: DDD Construction Bolt
**Definition**: `.specsmd/aidlc/templates/construction/bolt-types/ddd-construction-bolt.md`

## Stages

- [x] **1. Model**: Define keys, windows, counters, decisions, and invariants.
- [x] **2. Design**: Select backend and atomic adapter protocol.
- [x] **3. ADR Analysis**: Record backend/failure-mode decision if approved.
- [x] **4. Implement**: Integrate adapters and middleware.
- [x] **5. Test**: Verify cross-instance races, failures-only refunds, expiry, and outages.

## Dependencies

### Requires

- None; backend choice is a design-stage checkpoint.

### Enables

- Deployment-wide authentication/public-form protection.

## Success Criteria

- [x] Two instances share atomic limit state.
- [x] Existing messages, exemptions, and `Retry-After` semantics remain correct.
- [x] Production cannot silently fall back to process-local sensitive limits.

## Completion record

- **Delivered in**: [pull request #22](https://github.com/sabihuddin10/agile-spm-project/pull/22), merge commit `5ccdb51`, merged 2026-11-18T08:57:14Z.
- **Started**: 2026-11-18T08:54:18Z (first commit of the branch). Stage completion times are recorded as the merge time: the stages were not timed individually.
- **Owner**: Muhammad Zain Abbas (all nine bolts were reassigned to one owner, agreed with the professor).
- **What shipped**:
  - Policy and storage separated: `middleware/rate-limit.js` (policy) and `lib/rate-limit-store.js` (`MemoryStore` and `PostgresStore`, both `consume` and `refund`).
  - Shared production counters in a `rate_limits` table (migration `007_rate_limits.sql`, renumbered from 006 when `main` was synced): one atomic `INSERT ... ON CONFLICT DO UPDATE` per attempt by the database clock, count capped at limit + 1, background cleanup, only a SHA-256 of the key stored.
  - Store unavailable: fails closed with `503` and `Retry-After: 5`, logged without the counted key. Existing limits, messages, `429` behaviour, failures-only counting and staff exemptions unchanged.
  - Real-database tests in CI (Postgres 16): 60 simultaneous attempts across separate connection pools let exactly 10 through; shared windows, database-clock expiry, refund, cleanup, two app instances sharing a lockout, and `503` with the database unreachable. Plus 32 server unit tests. Notes: `docs/rate-limiting.md`.
- **Notes and deviations**:
  - ADR stage (open question "choose the shared backend"): decided PostgreSQL, the existing database, over a new Redis-style service: no new service, secret or cost, atomic and correct under concurrency. Rationale in `docs/rate-limiting.md`.
  - Production without a database runs the in-memory store, which is allowed but logs a warning at startup (it is never silent).
- **Checks**: every pull request passed CI (`build-and-test` with Postgres 16 and Node 22, `e2e` on three browsers, `dependency-policy` once it existed, and both Vercel previews) before merging.
