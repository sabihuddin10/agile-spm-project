---
id: 002-upgrade-backend-production-dependencies
unit: 001-dependency-security
intent: 001-repository-hardening
status: draft
priority: must
created: 2026-11-17T04:35:54Z
assigned_bolt: 003-dependency-security
implemented: false
---

# Story: Upgrade Backend Production Dependencies

## User Story

**As a** API maintainer
**I want** Express and vulnerable middleware dependencies upgraded
**So that** unauthenticated malformed traffic cannot exploit known crash or address-parsing weaknesses.

## Acceptance Criteria

- [ ] **Given** the patched backend graph, **When** `pnpm audit --prod` runs, **Then** body-parser, proxy-addr, qs, and Morgan high/critical findings are resolved.
- [ ] **Given** compressed, malformed, oversized, nested, and prototype-shaped requests, **When** they reach the API, **Then** the process survives and returns the expected safe 4xx response.
- [ ] **Given** the dependency upgrade, **When** server lint, all 401 server tests, database tests, and browser smoke tests run, **Then** all pass.

## Technical Notes

- Audit recommends Express 4.22.3, body-parser 1.20.9+, proxy-addr 2.0.8+, qs 6.16.1+, and Morgan 1.12.1+ along the current line.
- Add focused regression input for the body-parser compressed trailing-byte advisory where practical.

## Dependencies

### Requires
- `004-quality-engineering/001-add-critical-path-e2e-suite`

### Enables
- `001-dependency-security/003-enforce-lockfile-and-audit-policy`

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Express parsing defaults change | Existing 100 KB/object/reserved-key contract remains enforced |
| Trust-proxy behavior changes | Vercel client addressing and local untrusted proxy behavior remain correct |

## Out of Scope

- Express 5 migration unless separately approved.
- API contract redesign.
