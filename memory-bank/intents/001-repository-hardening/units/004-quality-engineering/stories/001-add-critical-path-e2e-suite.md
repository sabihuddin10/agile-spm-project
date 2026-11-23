---
id: 001-add-critical-path-e2e-suite
unit: 004-quality-engineering
intent: 001-repository-hardening
status: complete
priority: must
created: 2026-11-17T04:35:54Z
assigned_bolt: 001-quality-engineering
implemented: true
---

# Story: Add Critical-Path E2E Suite

## User Story

**As a** release reviewer
**I want** browser tests for the most important integrated journeys
**So that** framework, proxy, cookie, API, and UI regressions are caught before deployment.

## Acceptance Criteria

- [x] **Given** production builds of the frontend and API, **When** the E2E suite runs, **Then** a customer can sign in and complete a critical storefront journey.
- [x] **Given** a seeded staff account, **When** the suite runs, **Then** a staff member can sign in and complete a role-authorized operations journey.
- [x] **Given** a test failure, **When** CI finishes, **Then** trace, screenshot, and relevant logs are retained.
- [x] **Given** a clean CI runner, **When** the suite runs, **Then** it uses disposable deterministic data and completes within 10 minutes.

## Technical Notes

- No declared Playwright, Cypress, WebDriver, or Puppeteer E2E suite exists today.
- Keep the initial suite small and high-value; use existing seeded accounts only in isolated test environments.

## Dependencies

### Requires
- None.

### Enables
- `001-dependency-security/001-upgrade-frontend-production-dependencies`
- `001-dependency-security/002-upgrade-backend-production-dependencies`

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Port already allocated | Harness chooses/configures deterministic isolated ports |
| Test fails after login | Artifacts preserve enough state to diagnose cookie/proxy failures |

## Out of Scope

- Exhaustive cross-browser matrix.
- Every backlog story as an E2E case.

## Completion

Implemented in bolt `001-quality-engineering`: [pull request #14](https://github.com/sabihuddin10/agile-spm-project/pull/14), merged 2026-11-17T15:33:23Z.
