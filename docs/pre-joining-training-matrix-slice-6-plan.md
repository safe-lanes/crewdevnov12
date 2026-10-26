# Slice 6 — Training Needs suggestions

Approved build, four separately committed steps:

1. Durable assignment/required-master-course suggestion slot, immutable history,
   and pure eligibility/target/closure policy.
2. Transactional reconciliation and lifecycle hooks. The shared calculator stays
   read-only and unchanged. Missing-expiry/incomplete checks do not invent needs
   or close existing needs. Dismissal survives repeated checks. Deferral or
   cancellation withdraws active entries; replanning may reopen the same slot.
3. Scoped server-derived confirm/dismiss actions using the existing **Training**
   menu's create permission (Training & Ret. > Training); confirmed needs appear
   in Training Needs with source Pre-joining compliance. See Details shows status,
   target and actions. No permission grants added.
4. Isolated regression tests and registered main-preview fixture evidence, full
   suite / Company Forms / TypeScript gates, final commit then backend restart.

Only generated pre-joining suggestions are reconciled or automatically closed.
Manual and other-source needs are never touched. Automatic events use server
actor `system:pre-joining-compliance`; user actions use authenticated request ID,
never browser audit fields. Gap snapshots record calculation and matrix revision,
required course, evidence and dates. History retains every meaningful transition.

Expiry review before implementation: all 78 current master courses had Yes,
prefilled by migration 0263's conservative default, not a course-by-course
regulatory classification. No course expiry classifications changed in slice 6.
