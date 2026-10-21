# Training compliance checklist gate — slice 5

## Scope and commit sequence

0. Company ID first in See Details (presentation only).
1. Independent default-deny permission, tenant-local setting, immutable evidence storage.
2. Shared training blocker/warning policy (calculator unchanged).
3. Combined checklist gate on the sole accepted Yes writer, snapshot and scoped history read.
4. Access Control settings, separate override reasons, acceptance warnings and saved history UI.
5. Regression and registered fixture browser evidence.
6. Closing full-suite, Company Forms, TypeScript and post-commit backend chronology.

## Storage and authority

Migration 0261 adds no allowed grants. `training_compliance/override` is independent
of `company_forms/override_checklist`; grant changes use the existing audited,
parent-role-UUID Access Control write path. The expiry setting is tenant-local,
default OFF, and saved through the same management authority/lock with server
identity and before/after audit. Strict input schemas reject browser audit fields.

Accepted snapshots are append-only and protected by database update/delete
triggers. Every acceptance will insert a fresh snapshot in the same transaction as
the Planning Yes write. This is not a retrospective recomputation of old checklists.
