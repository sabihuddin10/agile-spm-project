---
id: 001-harden-polling-lifecycle
unit: 003-frontend-runtime
intent: 001-repository-hardening
status: complete
priority: should
created: 2026-11-17T04:35:54Z
assigned_bolt: 005-frontend-runtime
implemented: true
---

# Story: Harden Polling Lifecycle

## User Story

**As a** user of live operations screens
**I want** polling updates to arrive in order without duplicate in-flight work
**So that** slow networks do not show stale data or amplify API load.

## Acceptance Criteria

- [x] **Given** a callback still in flight, **When** another interval or visibility event fires, **Then** no second callback starts.
- [x] **Given** the poller is disabled or unmounted, **When** an earlier callback settles, **Then** no later cycle starts and consumers can ignore stale completion safely.
- [x] **Given** a rejected callback, **When** the next interval arrives, **Then** polling can recover without an unhandled rejection.
- [x] **Given** the tab becomes visible, **When** no callback is running, **Then** one immediate refresh occurs.

## Technical Notes

- Sixteen production consumers use `usePolling`; most callbacks are async.
- Consider an AbortSignal/generation contract only if consumers can adopt it without broad churn.

## Dependencies

### Requires
- None.

### Enables
- Reliable orders, kitchen, tables, billing, notifications, and workforce refresh behavior.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Interval changes during a request | Old schedule is cleaned up; no overlap occurs |
| Strict Mode effect replay | Cleanup prevents duplicate live timers |

## Out of Scope

- WebSocket migration.
- Changing polling intervals.

## Completion

Implemented in bolt `005-frontend-runtime`: [pull request #19](https://github.com/sabihuddin10/agile-spm-project/pull/19), merged 2026-11-18T07:56:19Z.
