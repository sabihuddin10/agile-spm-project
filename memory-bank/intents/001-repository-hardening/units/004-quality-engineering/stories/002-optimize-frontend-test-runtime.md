---
id: 002-optimize-frontend-test-runtime
unit: 004-quality-engineering
intent: 001-repository-hardening
status: complete
priority: should
created: 2026-11-17T04:35:54Z
assigned_bolt: 007-quality-engineering
implemented: true
---

# Story: Optimize Frontend Test Runtime

## User Story

**As a** developer
**I want** the frontend suite to reuse test infrastructure safely
**So that** feedback is faster without hiding isolation defects.

## Acceptance Criteria

- [x] **Given** the current 101.81-second audit baseline, **When** three comparable optimized runs complete, **Then** median wall-clock duration improves by at least 30%.
- [x] **Given** the optimized configuration, **When** all 96 files and 961 tests run repeatedly, **Then** results are deterministic and green.
- [x] **Given** stateful browser globals, **When** files run under the chosen pool/isolation mode, **Then** cleanup tests prove state does not leak across files.
- [x] **Given** CI constraints, **When** the suite runs, **Then** worker/resource settings remain stable and documented.

## Technical Notes

- Vitest reported 96 jsdom creations and 280.20 seconds of aggregate environment time.
- Benchmark `vmThreads`, controlled worker counts, and selective environment use; do not assume shared isolation is safe.

## Dependencies

### Requires
- None.

### Enables
- Faster local and CI feedback.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Shared globals leak | Configuration is rejected or cleanup is strengthened |
| Faster run increases flakes | Prefer the slower deterministic configuration |

## Out of Scope

- Deleting meaningful tests for speed.
- Rewriting the test framework.

## Completion

Implemented in bolt `007-quality-engineering`: [pull request #21](https://github.com/sabihuddin10/agile-spm-project/pull/21), merged 2026-11-18T08:42:14Z.
