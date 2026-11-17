---
id: 002-isolate-workforce-mock
unit: 003-frontend-runtime
intent: 001-repository-hardening
status: draft
priority: should
created: 2026-11-17T04:35:54Z
assigned_bolt: 006-frontend-runtime
implemented: false
---

# Story: Isolate Workforce Mock

## User Story

**As a** production user
**I want** the browser to receive only the real workforce adapter
**So that** demo data and unnecessary mock code are not shipped to production.

## Acceptance Criteria

- [ ] **Given** a production build with mock mode disabled, **When** bundle output is inspected, **Then** the workforce-mock module and demo seed strings are absent.
- [ ] **Given** mock mode is enabled in tests, **When** workforce tests run, **Then** the existing mock behavior remains available and deterministic.
- [ ] **Given** real mode, **When** workforce operations run, **Then** all calls continue through the existing API contracts.

## Technical Notes

- `workforce-api.ts` currently statically imports and unconditionally constructs the roughly 40 KB source mock.
- Prefer build-time module separation or a lazy mock-only boundary that cannot enter the production chunk graph.

## Dependencies

### Requires
- None.

### Enables
- Smaller production chunks and reduced demo-data exposure.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Mock flag text is malformed | Real API mode is selected |
| Dynamic import fails in mock mode | Test/dev receives an actionable error |

## Out of Scope

- Removing mock functionality from tests.
- Workforce feature redesign.
