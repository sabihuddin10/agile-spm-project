---
unit: 001-dependency-security
intent: 001-repository-hardening
phase: inception
status: stories-defined
unit_type: platform
default_bolt_type: simple-construction-bolt
created: 2026-11-17T04:35:54Z
updated: 2026-11-17T04:35:54Z
---

# Unit Brief: Dependency Security

## Purpose

Eliminate known production dependency exposure and make package resolution/advisory policy repeatable.

## Scope

### In Scope

- Next.js/PostCSS/source-map-js remediation and compatibility work.
- Express middleware/transitive dependency remediation.
- Canonical pnpm lockfile and CI audit enforcement.

### Out of Scope

- Feature redesigns unrelated to dependency compatibility.
- Automatic major-version upgrades without test evidence.
- Development-only advisory remediation unless it blocks the production baseline.

## Assigned Requirements

| FR | Requirement | Priority |
|----|-------------|----------|
| FR-2 | Remediate frontend production dependency advisories | Must |
| FR-3 | Remediate backend production dependency advisories | Must |
| FR-4 | Enforce dependency governance | Must |

## Domain Concepts

### Key Entities

| Entity | Description | Attributes |
|--------|-------------|------------|
| Dependency Baseline | Approved production package graph | package, version, advisory status |
| Advisory Policy | CI decision rules | severity, allowlist, expiry, rationale |
| Lockfile | Reproducible resolution source | manager, integrity, importers |

### Key Operations

| Operation | Description | Inputs | Outputs |
|-----------|-------------|--------|---------|
| Remediate frontend | Upgrade and verify frontend packages | current manifest, advisories | patched build |
| Remediate backend | Upgrade and verify API packages | current manifest, advisories | patched API |
| Enforce baseline | Audit canonical graph in CI | pnpm lockfile | pass/fail report |

## Story Summary

| Metric | Count |
|--------|-------|
| Total Stories | 3 |
| Must Have | 3 |
| Should Have | 0 |
| Could Have | 0 |

### Stories

| Story ID | Title | Priority | Status |
|----------|-------|----------|--------|
| 001-upgrade-frontend-production-dependencies | Upgrade frontend production dependencies | Must | Draft |
| 002-upgrade-backend-production-dependencies | Upgrade backend production dependencies | Must | Draft |
| 003-enforce-lockfile-and-audit-policy | Enforce lockfile and audit policy | Must | Draft |

## Dependencies

### Depends On

| Unit | Reason |
|------|--------|
| 004-quality-engineering | Browser smoke coverage reduces major-upgrade regression risk |

### Depended By

| Unit | Reason |
|------|--------|
| 005-deployment-safety | Deployments should consume the patched canonical graph |

### External Dependencies

| System | Purpose | Risk |
|--------|---------|------|
| npm registry/advisory database | Versions and vulnerability metadata | Medium |
| Next.js/Express release notes | Migration guidance | Medium |

## Technical Context

- Current audit: 36 production advisories—4 critical, 13 high, 17 moderate, 2 low.
- Next.js 14.2.35 accounts for 25 findings; the strictest audit recommendation is 15.5.28 or later.
- Express transitive findings include body-parser, proxy-addr, and qs; Morgan also has a finding.
- The repository declares pnpm but commits two nested npm lockfiles.

## Constraints

- Preserve App Router behavior and the Express 4 API contract unless an approved migration requires otherwise.
- Update lockfiles only in their assigned sequence to minimize merge conflicts.
- Verify with existing tests plus the E2E baseline.

## Success Criteria

- [ ] No unapproved high or critical production advisories.
- [ ] Frozen pnpm install succeeds.
- [ ] All lint, test, type-check, database, build, and E2E gates pass.
- [ ] One canonical lockfile remains.

## Bolt Suggestions

| Bolt | Type | Stories | Objective |
|------|------|---------|-----------|
| 002-dependency-security | Simple | 001 | Patch frontend graph |
| 003-dependency-security | Simple | 002 | Patch backend graph |
| 009-dependency-security | Simple | 003 | Enforce canonical baseline |
