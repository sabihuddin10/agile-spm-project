---
unit: 005-deployment-safety
intent: 001-repository-hardening
phase: inception
status: complete
unit_type: platform
default_bolt_type: simple-construction-bolt
created: 2026-11-17T04:35:54Z
updated: 2026-11-18T10:32:12Z
---

# Unit Brief: Deployment Safety

## Purpose

Turn missing or invalid production configuration into an early actionable failure rather than a deployed outage.

## Scope

### In Scope

- Build/start validation for frontend API origin and server secrets/database contract.
- Local-development defaults, committed environment templates, tests, and deployment documentation.

### Out of Scope

- Changing Vercel providers or adding infrastructure-as-code for unrelated resources.

## Assigned Requirements

| FR | Requirement | Priority |
|----|-------------|----------|
| FR-9 | Fail fast on deployment misconfiguration | Must |

## Domain Concepts

### Key Entities

| Entity | Description | Attributes |
|--------|-------------|------------|
| Deployment Config | Values required by a target environment | name, value, environment, sensitivity |
| Validation Result | Pre-deploy decision | valid, errors, warnings |

### Key Operations

| Operation | Description | Inputs | Outputs |
|-----------|-------------|--------|---------|
| Validate frontend config | Reject localhost/missing production API origin | NODE_ENV, API_URL | pass/fail |
| Validate server config | Check secret/database production requirements | env values | pass/fail |

## Story Summary

| Metric | Count |
|--------|-------|
| Total Stories | 1 |
| Must Have | 1 |
| Should Have | 0 |
| Could Have | 0 |

### Stories

| Story ID | Title | Priority | Status |
|----------|-------|----------|--------|
| 001-validate-production-configuration | Validate production configuration | Must | Complete |

## Dependencies

### External Dependencies

| System | Purpose | Risk |
|--------|---------|------|
| Vercel project settings | Holds production configuration | Medium |

## Technical Context

`frontend/next.config.mjs` currently falls back to `http://localhost:4000` whenever `API_URL` is missing, including production builds. The server already checks `JWT_SECRET` in production, providing a pattern to extend and test.

## Constraints

- Keep localhost defaults for local development and tests.
- Never print secret values in validation errors or CI logs.
- Keep frontend and API deployment as separate Vercel projects.

## Success Criteria

- [x] Missing/invalid production configuration fails before deployment.
- [x] Error messages name the configuration key and remediation without revealing values.
- [x] Environment templates and README match executable validation.

## Bolt Suggestions

| Bolt | Type | Stories | Objective |
|------|------|---------|-----------|
| 008-deployment-safety | Simple | 001 | Add tested fail-fast configuration contract |
