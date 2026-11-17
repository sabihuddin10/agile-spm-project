---
id: 001-upgrade-frontend-production-dependencies
unit: 001-dependency-security
intent: 001-repository-hardening
status: draft
priority: must
created: 2026-11-17T04:35:54Z
assigned_bolt: 002-dependency-security
implemented: false
---

# Story: Upgrade Frontend Production Dependencies

## User Story

**As a** platform maintainer
**I want** the frontend framework and transitive production packages upgraded to supported patched versions
**So that** customer and staff pages are not exposed to known critical or high vulnerabilities.

## Acceptance Criteria

- [ ] **Given** the patched frontend dependency graph, **When** `pnpm audit --prod` runs, **Then** no high or critical frontend finding remains without a time-bounded approved exception.
- [ ] **Given** the upgrade, **When** frontend lint, 961 tests, type-check, production build, and browser smoke tests run, **Then** all pass.
- [ ] **Given** App Router pages and `/api/*` rewrites, **When** customer and staff smoke journeys run, **Then** routing, cookies, dynamic components, and proxy behavior match the current contract.

## Technical Notes

- Audit baseline: Next.js 14.2.35 has 25 findings; the strictest current recommendation is 15.5.28 or later.
- Include affected PostCSS and source-map-js paths in the resolved graph.
- Review official migration notes before choosing the exact supported line.

## Dependencies

### Requires
- `004-quality-engineering/001-add-critical-path-e2e-suite`

### Enables
- `001-dependency-security/003-enforce-lockfile-and-audit-policy`

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Framework changes React peer requirements | Migration is explicit and all component tests remain green |
| Advisory applies only to unused deployment mode | Record exposure analysis; prefer patched version over indefinite suppression |

## Out of Scope

- UI redesign.
- Unrelated package modernization.
