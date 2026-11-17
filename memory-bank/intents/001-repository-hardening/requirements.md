---
intent: 001-repository-hardening
phase: inception
status: units-defined
created: 2026-11-17T04:35:54Z
updated: 2026-11-17T04:35:54Z
---

# Requirements: Repository Hardening

## Intent Overview

Reduce verified security, runtime-reliability, test-infrastructure, and deployment risks in the existing Plate & Flame application without changing its business behavior. The work is planned for nine team members, with one primary owner per bolt.

## Business Goals

| Goal | Success Metric | Priority |
|------|----------------|----------|
| Remove known production dependency exposure | `pnpm audit --prod` reports no high or critical advisories | Must |
| Protect production traffic consistently | Security limits work across serverless instances and deployments fail safely when misconfigured | Must |
| Make regression detection representative and efficient | Critical browser journeys run in CI and the frontend test suite is materially faster | Must |
| Prevent client-side race and bundle regressions | Polls do not overlap and demo-only workforce code is absent from production bundles | Should |

---

## Functional Requirements

### FR-1: Establish browser-level regression coverage
- **Description**: Add an automated browser smoke suite for authentication, ordering, staff operations, and API-to-UI integration paths that unit and route tests do not exercise together.
- **Acceptance Criteria**: The suite runs against production builds, covers at least one customer and one staff critical journey, captures failure artifacts, and is required in CI.
- **Priority**: Must
- **Related Stories**: 004-quality-engineering/001-add-critical-path-e2e-suite

### FR-2: Remediate frontend production dependency advisories
- **Description**: Upgrade Next.js and affected transitive frontend production dependencies to supported patched versions while preserving App Router behavior.
- **Acceptance Criteria**: Frontend production audit has no high or critical findings, all frontend tests/type-check/lint/build pass, and browser smoke tests pass.
- **Priority**: Must
- **Related Stories**: 001-dependency-security/001-upgrade-frontend-production-dependencies

### FR-3: Remediate backend production dependency advisories
- **Description**: Upgrade Express and affected middleware/transitive packages, including body-parser, proxy-addr, qs, and Morgan, to patched versions.
- **Acceptance Criteria**: Backend production audit has no high or critical findings and all 401 server tests plus database tests pass.
- **Priority**: Must
- **Related Stories**: 001-dependency-security/002-upgrade-backend-production-dependencies

### FR-4: Enforce dependency governance
- **Description**: Make pnpm the sole lockfile authority and add repeatable production advisory checks to CI and local scripts.
- **Acceptance Criteria**: Nested npm lockfiles are removed or explicitly justified, frozen pnpm installation succeeds, and CI fails on unapproved high/critical production advisories.
- **Priority**: Must
- **Related Stories**: 001-dependency-security/003-enforce-lockfile-and-audit-policy

### FR-5: Make abuse limits deployment-wide
- **Description**: Replace or supplement process-local authentication and public-form rate-limit state with a shared production-capable implementation while retaining deterministic local tests.
- **Acceptance Criteria**: Limits are consistent across two simulated instances, preserve `Retry-After` and failure-only semantics, fail safely when the shared store is unavailable, and retain staff exemptions where specified.
- **Priority**: Must
- **Related Stories**: 002-api-resilience/001-distribute-security-rate-limits

### FR-6: Prevent overlapping and stale frontend polling
- **Description**: Coordinate recurring frontend requests so slow requests cannot overlap, update unmounted consumers, or overwrite fresher data.
- **Acceptance Criteria**: The shared polling hook has single-flight behavior, cleans up on disable/unmount, handles visibility changes, and has regression tests for slow and rejected callbacks.
- **Priority**: Should
- **Related Stories**: 003-frontend-runtime/001-harden-polling-lifecycle

### FR-7: Isolate demo-only workforce code from production
- **Description**: Ensure the large in-browser workforce mock and its seed data are loaded only when the explicit mock flag is enabled.
- **Acceptance Criteria**: Production bundles contain no workforce-mock module, mock-mode tests still pass, and real API behavior remains unchanged.
- **Priority**: Should
- **Related Stories**: 003-frontend-runtime/002-isolate-workforce-mock

### FR-8: Reduce frontend test startup overhead
- **Description**: Tune Vitest isolation/pooling so jsdom is not recreated unnecessarily while retaining deterministic tests.
- **Acceptance Criteria**: All 961 tests remain green and three comparable runs show at least a 30% median wall-clock improvement from the 101.81-second audit baseline.
- **Priority**: Should
- **Related Stories**: 004-quality-engineering/002-optimize-frontend-test-runtime

### FR-9: Fail fast on deployment misconfiguration
- **Description**: Validate production-facing environment configuration so a missing API URL cannot silently target localhost and required secrets/config are checked before deployment.
- **Acceptance Criteria**: Production build or startup fails with an actionable error when required values are missing or invalid, local defaults remain convenient, and deployment documentation/tests cover the contract.
- **Priority**: Must
- **Related Stories**: 005-deployment-safety/001-validate-production-configuration

---

## Non-Functional Requirements

### Security

| Requirement | Metric | Target |
|-------------|--------|--------|
| Production dependency exposure | High/critical advisories | 0 unapproved findings |
| Abuse protection consistency | Cross-instance limit decisions | Same decision for the same key/window |
| Secret handling | Secrets in code, bundles, logs, or artifacts | 0 |

### Reliability

| Requirement | Metric | Target |
|-------------|--------|--------|
| Existing behavior | Existing automated suites | 100% passing |
| Polling concurrency | In-flight callback per poller | Maximum 1 |
| Deployment configuration | Invalid production config | Deterministic fail-fast |

### Performance

| Requirement | Metric | Target |
|-------------|--------|--------|
| Frontend test duration | Median wall-clock time | At least 30% below 101.81 s baseline |
| Production client bundle | Demo workforce mock | Not present |
| E2E CI duration | Critical-path suite | Under 10 minutes |

### Maintainability

| Requirement | Metric | Target |
|-------------|--------|--------|
| Lockfile authority | Committed JavaScript lockfiles | One (`pnpm-lock.yaml`) |
| Bolt ownership | Planned bolts with one primary owner | 9 of 9 |
| Traceability | FRs mapped to stories and bolts | 100% |

---

## Constraints

### Technical Constraints

- Preserve the current pnpm workspace, Next.js App Router, Express REST API, PostgreSQL/Neon data model, Vercel deployment topology, JWT-cookie flow, and role behavior unless a bolt explicitly records an approved migration.
- Keep existing public API contracts and all current tests green.
- Use the existing CI definition as the Definition of Done and add gates incrementally.
- Do not use production data or production databases for tests.

### Business Constraints

- Nine primary owners are available; each receives exactly one initial bolt.
- The supplied M1–M9 roster is the source of truth for bolt ownership.
- Security remediation precedes dependency-policy enforcement.

---

## Assumptions

| Assumption | Risk if Invalid | Mitigation |
|------------|-----------------|------------|
| Vercel remains the production host | Some Next.js advisories and configuration controls differ elsewhere | Reassess exposure and deployment checks before moving hosts |
| Existing tests accurately represent current business behavior | Upgrades may preserve tests while breaking an uncovered journey | Establish the E2E baseline before framework upgrades |
| A shared rate-limit store can be provisioned | Deployment-wide protection cannot be guaranteed | Use a documented fail-closed strategy for sensitive endpoints and retain local adapter tests |
| Team members can work from dependency-aware branches | Parallel work may conflict in lockfiles/configuration | Sequence bolts 002/003 before bolt 009 and coordinate lockfile ownership |

---

## Open Questions

| Question | Owner | Due Date | Resolution |
|----------|-------|----------|------------|
| Choose the shared production rate-limit backend | Muhammad Shaheer Zafar (M4) | Bolt 004 Plan stage | Pending |
| Choose the exact supported Next.js target after compatibility review | Shah Anas Khan (M2) | Bolt 002 Plan stage | Minimum patched line is 15.5.28 |
