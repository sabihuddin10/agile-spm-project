---
unit: 004-quality-engineering
intent: 001-repository-hardening
phase: inception
status: stories-defined
unit_type: platform
default_bolt_type: simple-construction-bolt
created: 2026-11-17T04:35:54Z
updated: 2026-11-17T04:35:54Z
---

# Unit Brief: Quality Engineering

## Purpose

Add browser-level confidence for critical journeys and reduce frontend test feedback time.

## Scope

### In Scope

- Production-build browser smoke tests with artifacts.
- Vitest worker/environment tuning backed by repeated measurements.

### Out of Scope

- Replacing the existing 1,362 server/frontend tests.
- Broad UI redesign or exhaustive cross-browser certification.

## Assigned Requirements

| FR | Requirement | Priority |
|----|-------------|----------|
| FR-1 | Establish browser-level regression coverage | Must |
| FR-8 | Reduce frontend test startup overhead | Should |

## Domain Concepts

### Key Entities

| Entity | Description | Attributes |
|--------|-------------|------------|
| Critical Journey | Integrated user workflow | role, steps, expected result |
| Test Run | Comparable suite execution | duration, result, environment |

### Key Operations

| Operation | Description | Inputs | Outputs |
|-----------|-------------|--------|---------|
| Run smoke suite | Exercise built frontend and API | seeded app, browser | report/artifacts |
| Benchmark Vitest | Compare deterministic configurations | config, repetitions | median duration |

## Story Summary

| Metric | Count |
|--------|-------|
| Total Stories | 2 |
| Must Have | 1 |
| Should Have | 1 |
| Could Have | 0 |

### Stories

| Story ID | Title | Priority | Status |
|----------|-------|----------|--------|
| 001-add-critical-path-e2e-suite | Add critical-path E2E suite | Must | Draft |
| 002-optimize-frontend-test-runtime | Optimize frontend test runtime | Should | Draft |

## Dependencies

### Depended By

| Unit | Reason |
|------|--------|
| 001-dependency-security | E2E validates framework/middleware upgrades |

## Technical Context

The audit found no declared Playwright/Cypress E2E suite. Existing tests pass: 401 server tests and 961 frontend tests. Vitest reported 96 jsdom environments, 280.20 seconds of aggregate environment time, and 101.81 seconds wall-clock duration.

## Constraints

- Use disposable local/CI data only.
- Keep browser tests deterministic and under 10 minutes.
- Preserve per-file isolation unless measurements and reliability prove a safe alternative.

## Success Criteria

- [ ] Customer and staff critical journeys run against production builds in CI.
- [ ] Failures retain traces/screenshots/logs.
- [ ] All frontend tests remain green with at least 30% median wall-clock improvement.

## Bolt Suggestions

| Bolt | Type | Stories | Objective |
|------|------|---------|-----------|
| 001-quality-engineering | Simple | 001 | Establish integrated browser baseline |
| 007-quality-engineering | Simple | 002 | Tune Vitest execution |
