---
id: 001-validate-production-configuration
unit: 005-deployment-safety
intent: 001-repository-hardening
status: complete
priority: must
created: 2026-11-17T04:35:54Z
assigned_bolt: 008-deployment-safety
implemented: true
---

# Story: Validate Production Configuration

## User Story

**As a** release operator
**I want** invalid production configuration rejected before deployment
**So that** missing API origins or secrets cannot produce a silently broken release.

## Acceptance Criteria

- [x] **Given** a production frontend build without `API_URL`, **When** configuration loads, **Then** it fails with an actionable error instead of rewriting to localhost.
- [x] **Given** a production API start without a valid `JWT_SECRET`, **When** the app initializes, **Then** it fails before accepting traffic without exposing secret values.
- [x] **Given** valid local development settings, **When** developers run the apps, **Then** localhost defaults continue to work.
- [x] **Given** committed environment templates and README deployment steps, **When** compared with executable validation, **Then** required keys and constraints match.

## Technical Notes

- Frontend currently uses `process.env.API_URL || 'http://localhost:4000'` unconditionally in `next.config.mjs` and the health proxy route.
- Consolidate validation so rewrites and health checks cannot disagree.

## Dependencies

### Requires
- None.

### Enables
- Safer Vercel releases and clearer incident diagnosis.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| API_URL is malformed or non-HTTP(S) | Build rejects it with a key-specific error |
| Preview environment has a distinct API | Explicit configured HTTPS origin is accepted |

## Out of Scope

- Changing hosting providers.
- Secret-manager provisioning.

## Completion

Implemented in bolt `008-deployment-safety`: [pull request #18](https://github.com/sabihuddin10/agile-spm-project/pull/18), merged 2026-11-18T07:34:45Z.
