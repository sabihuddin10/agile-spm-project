---
id: 008-deployment-safety
unit: 005-deployment-safety
intent: 001-repository-hardening
type: simple-construction-bolt
status: planned
stories:
  - 001-validate-production-configuration
created: 2026-11-17T04:35:54Z
started: null
completed: null
current_stage: null
stages_completed: []
owner:
  member: Shahaan Khalid
  student_id: 22K4442
  group_slot: M8
  role: Release Engineer
requires_bolts: []
enables_bolts: []
requires_units: []
blocks: false
complexity:
  avg_complexity: 2
  avg_uncertainty: 1
  max_dependencies: 2
  testing_scope: 2
---

# Bolt: 008-deployment-safety

## Overview

Add a tested environment contract that fails production builds/starts before a broken deployment is published.

## Objective

Reject missing, malformed, or localhost production API origins and preserve/extend the API's production secret checks.

## Owner

**Shahaan Khalid (22K4442, M8) — Release Engineer**

## Stories Included

- [ ] **001-validate-production-configuration**: Validate production configuration (Must)

## Expected Outputs

- Shared frontend configuration validation used by rewrites and health proxy.
- Server production configuration checks/tests.
- Updated `.env.example`, README, and deployment verification.

## Bolt Type

**Type**: Simple Construction Bolt

## Stages

- [ ] **1. Plan**: Define environment-specific required/allowed values.
- [ ] **2. Implement**: Add validation and align consumers/docs.
- [ ] **3. Test**: Exercise valid local/preview/prod and invalid prod matrices.

## Dependencies

### Requires

- None.

### Enables

- Deterministic safe releases.

## Success Criteria

- [ ] Production cannot fall back to localhost.
- [ ] Errors are actionable and never reveal secret values.
- [ ] Local developer defaults remain convenient.
