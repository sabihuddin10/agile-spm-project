---
id: 003-enforce-lockfile-and-audit-policy
unit: 001-dependency-security
intent: 001-repository-hardening
status: draft
priority: must
created: 2026-11-17T04:35:54Z
assigned_bolt: 009-dependency-security
implemented: false
---

# Story: Enforce Lockfile and Audit Policy

## User Story

**As a** release maintainer
**I want** one package-resolution authority and a production advisory gate
**So that** local, CI, and deployment installs cannot drift silently into vulnerable graphs.

## Acceptance Criteria

- [ ] **Given** the pnpm workspace declaration, **When** repository lockfiles are inspected, **Then** `pnpm-lock.yaml` is the only active JavaScript lockfile.
- [ ] **Given** a clean checkout, **When** `pnpm install --frozen-lockfile` runs, **Then** every workspace installs reproducibly.
- [ ] **Given** a high or critical production advisory, **When** CI runs, **Then** it fails unless a documented exception includes owner, rationale, and expiry.
- [ ] **Given** local developer commands, **When** the root verification command runs, **Then** it includes both server and frontend tests plus security checks.

## Technical Notes

- Current competing files: root `pnpm-lock.yaml`, `frontend/package-lock.json`, and `server/package-lock.json`.
- Add policy without making registry availability silently skip the gate.

## Dependencies

### Requires
- `001-upgrade-frontend-production-dependencies`
- `002-upgrade-backend-production-dependencies`

### Enables
- Reliable future dependency updates and releases.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Advisory service outage | CI reports an explicit infrastructure failure rather than a false pass |
| Temporary exception | Exception is narrow, owned, justified, and expires automatically |

## Out of Scope

- Automatic dependency merging.
- Blanket suppression of moderate/low findings.
