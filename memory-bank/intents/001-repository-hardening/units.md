---
intent: 001-repository-hardening
phase: inception
status: complete
updated: 2026-11-18T10:32:12Z
---

# Repository Hardening - Unit Decomposition

## Requirement-to-Unit Mapping

- **FR-1**: Establish browser-level regression coverage → `004-quality-engineering`
- **FR-2**: Remediate frontend production dependency advisories → `001-dependency-security`
- **FR-3**: Remediate backend production dependency advisories → `001-dependency-security`
- **FR-4**: Enforce dependency governance → `001-dependency-security`
- **FR-5**: Make abuse limits deployment-wide → `002-api-resilience`
- **FR-6**: Prevent overlapping and stale frontend polling → `003-frontend-runtime`
- **FR-7**: Isolate demo-only workforce code from production → `003-frontend-runtime`
- **FR-8**: Reduce frontend test startup overhead → `004-quality-engineering`
- **FR-9**: Fail fast on deployment misconfiguration → `005-deployment-safety`

## Units Overview

### 001-dependency-security

Owns patched frontend/backend dependency baselines, canonical package resolution, and advisory enforcement.

- **Stories**: 3
- **Bolts**: 3
- **Depends on**: E2E baseline for framework/middleware upgrade validation
- **Default bolt type**: simple-construction-bolt

### 002-api-resilience

Owns deployment-wide abuse controls and deterministic limit semantics.

- **Stories**: 1
- **Bolts**: 1
- **Depends on**: Shared production-capable counter backend decision
- **Default bolt type**: ddd-construction-bolt

### 003-frontend-runtime

Owns recurring request lifecycle and production-only client bundle boundaries.

- **Stories**: 2
- **Bolts**: 2
- **Depends on**: Existing API client and workforce feature contracts
- **Default bolt type**: simple-construction-bolt

### 004-quality-engineering

Owns browser-level regression confidence and frontend test execution efficiency.

- **Stories**: 2
- **Bolts**: 2
- **Depends on**: Existing test fixtures and production build commands
- **Default bolt type**: simple-construction-bolt

### 005-deployment-safety

Owns production configuration validation and actionable deployment failures.

- **Stories**: 1
- **Bolts**: 1
- **Depends on**: Vercel frontend/API topology and committed environment templates
- **Default bolt type**: simple-construction-bolt

## Unit Dependency Graph

```text
[004-quality-engineering: E2E baseline]
               |
               +------> [001-dependency-security: frontend upgrade]
               +------> [001-dependency-security: backend upgrade]
                                      |
                                      v
                         [001-dependency-security: policy gate]

[002-api-resilience]       [003-frontend-runtime]       [005-deployment-safety]
        independent               independent                    independent
```

## Team Assignment

| Slot | Member | Student ID | Bolt | Primary Focus |
|------|--------|------------|------|---------------|
| M1 | Sabih Uddin | 22k4347 | 001-quality-engineering | Browser E2E baseline |
| M2 | Shah Anas Khan | 23K-3028 | 002-dependency-security | Frontend dependency remediation |
| M3 | Syed Okasha | 23k-0850 | 003-dependency-security | Backend dependency remediation |
| M4 | Muhammad Shaheer Zafar | 22K5138 | 004-api-resilience | Distributed rate limiting |
| M5 | Burhan | 22k0591 | 005-frontend-runtime | Polling lifecycle |
| M6 | Khalil | k232007 | 006-frontend-runtime | Production mock isolation |
| M7 | Fozan Javid | 23K0605 | 007-quality-engineering | Vitest performance |
| M8 | Shahaan Khalid | 22K4442 | 008-deployment-safety | Production configuration validation |
| M9 | Muhammad Zain Abbas | 22k-5028 | 009-dependency-security | Lockfile and audit governance |

## Execution Order

1. Start Bolts 001, 004, 005, 006, 007, and 008 in parallel.
2. Start Bolts 002 and 003 after Bolt 001 establishes browser regression coverage.
3. Start Bolt 009 after Bolts 002 and 003 complete and the final patched dependency baseline is known.
