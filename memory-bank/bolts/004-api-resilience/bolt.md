---
id: 004-api-resilience
unit: 002-api-resilience
intent: 001-repository-hardening
type: ddd-construction-bolt
status: planned
stories:
  - 001-distribute-security-rate-limits
created: 2026-11-17T04:35:54Z
started: null
completed: null
current_stage: null
stages_completed: []
owner:
  member: Muhammad Shaheer Zafar
  student_id: 22K5138
  group_slot: M4
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

**Muhammad Shaheer Zafar (22K5138, M4) — Platform Reliability Engineer**

## Stories Included

- [ ] **001-distribute-security-rate-limits**: Distribute security rate limits (Must)

## Expected Outputs

- Limit-key/window/decision domain model.
- Storage adapter contract and selected production implementation.
- Middleware integration with outage behavior.
- Concurrency, cross-instance, and existing semantic tests.

## Bolt Type

**Type**: DDD Construction Bolt
**Definition**: `.specsmd/aidlc/templates/construction/bolt-types/ddd-construction-bolt.md`

## Stages

- [ ] **1. Model**: Define keys, windows, counters, decisions, and invariants.
- [ ] **2. Design**: Select backend and atomic adapter protocol.
- [ ] **3. ADR Analysis**: Record backend/failure-mode decision if approved.
- [ ] **4. Implement**: Integrate adapters and middleware.
- [ ] **5. Test**: Verify cross-instance races, failures-only refunds, expiry, and outages.

## Dependencies

### Requires

- None; backend choice is a design-stage checkpoint.

### Enables

- Deployment-wide authentication/public-form protection.

## Success Criteria

- [ ] Two instances share atomic limit state.
- [ ] Existing messages, exemptions, and `Retry-After` semantics remain correct.
- [ ] Production cannot silently fall back to process-local sensitive limits.
