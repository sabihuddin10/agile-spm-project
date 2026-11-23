---
id: 001-distribute-security-rate-limits
unit: 002-api-resilience
intent: 001-repository-hardening
status: complete
priority: must
created: 2026-11-17T04:35:54Z
assigned_bolt: 004-api-resilience
implemented: true
---

# Story: Distribute Security Rate Limits

## User Story

**As a** service operator
**I want** authentication and public-form limits coordinated across API instances
**So that** horizontal scaling cannot multiply an attacker's effective quota.

## Acceptance Criteria

- [x] **Given** two API instances using the same production limiter backend, **When** requests share a key/window, **Then** both observe one atomic counter and identical blocking decision.
- [x] **Given** failure-only email throttling, **When** a login succeeds, **Then** the attempt is not retained while 401/403 failures are retained.
- [x] **Given** a blocked request, **When** the API returns `429`, **Then** `Retry-After` is positive and reflects the shared reset time.
- [x] **Given** local tests or development, **When** the in-memory adapter is selected explicitly, **Then** existing deterministic behavior remains available.
- [x] **Given** the shared store is unavailable, **When** a sensitive authentication request arrives, **Then** the documented safe fallback is applied and observable.

## Technical Notes

- Separate limiter policy from storage adapter.
- Avoid logging raw normalized emails or credentials.
- Preserve current staff exemptions and per-route messages.

## Dependencies

### Requires
- Shared backend selection during the bolt's design stage.

### Enables
- Consistent serverless abuse protection.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Simultaneous increments at the limit boundary | Exactly the permitted count succeeds |
| Clock skew between instances | Backend reset time remains authoritative |

## Out of Scope

- General-purpose caching.
- Changing role permissions.

## Completion

Implemented in bolt `004-api-resilience`: [pull request #22](https://github.com/sabihuddin10/agile-spm-project/pull/22), merged 2026-11-18T08:57:14Z.
