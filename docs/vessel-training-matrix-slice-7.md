# Vessel Training Matrix — slice 7

## Build steps

1. Shared server calculation: add an explicit planned-relief end date to the
   existing kernel (version 1.5.0), exact captured-rank/on-board-assignment
   readers, a read-only scoped batch endpoint and shared details decoration.
   Test inclusive boundaries, month-end fallback, equivalents, longest valid
   certificate, incomplete data and parity.
2. Replace the old client dot/rank-name calculation with server results.
   Assignment-specific columns, dot-only cells, hover/tap meanings, eight-state
   legend, and the existing See Details window with today/planned-relief dates.
   No enforcement or training-suggestion writes from the on-board view.
3. Signed-JWT scope tests, UI regression tests, registered-fixture main-preview
   evidence and standing gates. Commit tooling/evidence, restart the main backend
   after the final commit, then take the closing evidence.

## Interpretation

- Today is the server's UTC civil date; date validity includes expiry day.
- Planned relief is `vessel_planning_v2.sign_off_date`, only on an active,
  non-archived row whose `crew_assign_uuid`, crew and vessel exactly match the
  on-board assignment. Never Relief Due, reliever dates or another assignment.
- Several matching active planning rows are incomplete, not a guessed date.
- Without planned relief, a known expiry through today plus two calendar months
  (inclusive, clamped to month-end) warns. A before-relief expiry also reports
  that two-month reason when applicable, as requested. An expiry on/after a known
  relief date stays Valid, even if it is within two months.
- No captured contract rank means Incomplete, never current-rank/name matching.
  Same-rank crew members have separate assignment columns and results.
- Historic check snapshots retain their recorded calculation versions.
