---
unit: 003-frontend-runtime
intent: 001-repository-hardening
phase: inception
status: complete
unit_type: frontend
default_bolt_type: simple-construction-bolt
created: 2026-11-17T04:35:54Z
updated: 2026-11-18T10:32:12Z
---

# Unit Brief: Frontend Runtime

## Purpose

Prevent recurring-request races and keep demo-only workforce infrastructure out of production clients.

## Scope

### In Scope

- Shared polling single-flight, cleanup, and rejection behavior.
- Workforce mock loading boundary and bundle verification.

### Out of Scope

- Replacing polling with WebSockets.
- Redesigning workforce features or mock behavior.

## Assigned Requirements

| FR | Requirement | Priority |
|----|-------------|----------|
| FR-6 | Prevent overlapping and stale frontend polling | Should |
| FR-7 | Isolate demo-only workforce code from production | Should |

## Domain Concepts

### Key Entities

| Entity | Description | Attributes |
|--------|-------------|------------|
| Poll Cycle | One recurring async callback execution | running, generation, enabled |
| Runtime Mode | Real API or explicit workforce mock | build flag, adapter |

### Key Operations

| Operation | Description | Inputs | Outputs |
|-----------|-------------|--------|---------|
| Schedule poll | Run visible-tab callback without overlap | callback, interval | lifecycle control |
| Select workforce adapter | Load real API or mock implementation | explicit build flag | adapter |

## Story Summary

| Metric | Count |
|--------|-------|
| Total Stories | 2 |
| Must Have | 0 |
| Should Have | 2 |
| Could Have | 0 |

### Stories

| Story ID | Title | Priority | Status |
|----------|-------|----------|--------|
| 001-harden-polling-lifecycle | Harden polling lifecycle | Should | Complete |
| 002-isolate-workforce-mock | Isolate workforce mock | Should | Complete |

## Dependencies

### External Dependencies

None. Both changes stay within the frontend package.

## Technical Context

`usePolling` invokes callbacks on intervals and visibility changes without awaiting or cancelling them. Sixteen consumers pass async loaders. `workforce-api.ts` statically imports and instantiates the roughly 40 KB source mock even when the public mock flag is false.

## Constraints

- Preserve the existing polling intervals and screen behavior.
- Mock-mode unit tests must remain deterministic.
- Do not expose demo wages, attendance, or users in production bundles.

## Success Criteria

- [x] A poller never has more than one callback in flight.
- [x] Disable/unmount prevents later state-affecting callbacks.
- [x] Production bundle analysis cannot find the workforce mock module.

## Bolt Suggestions

| Bolt | Type | Stories | Objective |
|------|------|---------|-----------|
| 005-frontend-runtime | Simple | 001 | Coordinate polling lifecycle |
| 006-frontend-runtime | Simple | 002 | Split production and mock adapters |
