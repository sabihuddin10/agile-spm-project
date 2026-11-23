---
unit: 002-api-resilience
intent: 001-repository-hardening
phase: inception
status: complete
unit_type: backend
default_bolt_type: ddd-construction-bolt
created: 2026-11-17T04:35:54Z
updated: 2026-11-18T10:32:12Z
---

# Unit Brief: API Resilience

## Purpose

Make authentication and public-form abuse limits consistent across serverless API instances.

## Scope

### In Scope

- Shared limiter contract and production adapter.
- Failure-only authentication counting, staff exemptions, `Retry-After`, cleanup, and deterministic tests.
- Safe fallback behavior for local development and store outages.

### Out of Scope

- Changing existing limit values without an explicit security rationale.
- General caching or unrelated persistence refactors.

## Assigned Requirements

| FR | Requirement | Priority |
|----|-------------|----------|
| FR-5 | Make abuse limits deployment-wide | Must |

## Domain Concepts

### Key Entities

| Entity | Description | Attributes |
|--------|-------------|------------|
| Limit Key | IP or normalized identity being counted | namespace, key |
| Limit Window | Fixed period for a counter | start, resetAt, count |
| Limit Decision | Middleware outcome | allowed, retryAfter, remaining |

### Key Operations

| Operation | Description | Inputs | Outputs |
|-----------|-------------|--------|---------|
| Consume attempt | Atomically increment/check a key | key, limit, window | decision |
| Refund successful attempt | Preserve failures-only semantics | key, response status | updated counter |
| Expire window | Remove stale counters | current time | reclaimed records |

## Story Summary

| Metric | Count |
|--------|-------|
| Total Stories | 1 |
| Must Have | 1 |
| Should Have | 0 |
| Could Have | 0 |

### Stories

| Story ID | Title | Priority | Status |
|----------|-------|----------|--------|
| 001-distribute-security-rate-limits | Distribute security rate limits | Must | Complete |

## Dependencies

### External Dependencies

| System | Purpose | Risk |
|--------|---------|------|
| Shared rate-limit backend (TBD) | Atomic cross-instance counters | High until selected |

## Technical Context

The current middleware keeps a `Map` inside each process. The source and README explicitly note that each Vercel instance counts independently, which weakens authentication and public-form controls under horizontal scaling.

## Constraints

- Retain a zero-network in-memory adapter for unit tests and local development.
- Atomic operations must prevent cross-instance races.
- Do not leak normalized email or sensitive identifiers in logs.

## Success Criteria

- [x] Two adapter instances share the same decisions for a key/window.
- [x] Existing limiter tests remain green and new outage/concurrency tests pass.
- [x] Production configuration cannot silently use process-local security counters.

## Bolt Suggestions

| Bolt | Type | Stories | Objective |
|------|------|---------|-----------|
| 004-api-resilience | DDD | 001 | Model and implement shared limiting |
