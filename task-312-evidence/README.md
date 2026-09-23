# Reliever unassign verification

## Automated coverage

`npx vitest run tests/integration/api/reliever-unassign-assignment.test.ts`

- 5 tests passed.
- Covers exactly one match, no match, ambiguous matches, repeated stale unassign,
  other-state and other-vessel preservation, authenticated audit identity, rollback,
  and a forced deploy/unassign interleaving.
- The concurrency case pauses deployment while it holds the planning-row lock,
  confirms unassign is blocked, then verifies unassign cancels the committed
  Planned assignment after deployment finishes.

## Browser lifecycle

The existing UI was used without direct API calls:

1. Created and proposed a new vessel 04 / 2nd Officer rotation plan for IRWAN SUBEKTI.
2. Selected and deployed that exact approval entry.
3. Opened the reliever unassign confirmation in two browser tabs.
4. Confirmed the first unassign (`PATCH` 200).
5. Confirmed the second already-open stale popup (`PATCH` 200).

The dev workflow runs with `AUTH_BYPASS=true` and no authenticated request UUID, so
the live browser row has a server-derived null `updated_by_uuid`. The real-auth
integration test sends actor `990312`, attempts to spoof the body actor, and verifies
that both planning and assignment store `990312`.

## Database result

Fresh assignment `e9fa5deb-2faa-40be-bd11-4c741f116f32`:

- `assignment_type = 'Cancelled'`
- `is_current = false`
- `reason = 'Unassigned before joining'`
- `is_deleted = false`
- Full assignment row unchanged after the second stale-popup unassign

Planning row `f42844f3-1451-4650-856c-f44af484be57` has all reliever fields cleared.

Protected historic assignment `cc173268-2d72-4434-8549-4daab7e29fb9` remained
`Planned`, non-current, non-deleted, with its original timestamps and audit fields.

## Files

- `fresh-deploy-before-unassign.txt` — full pre-unassign planning and assignment rows
- `after-first-unassign.json` — full rows after the first browser unassign
- `after-second-unassign.json` — full rows after the repeated stale-popup unassign
- `final-sql-evidence.txt` — final full SQL rows, including the protected historic row
- `fresh-plan-irwan-vessel04-selected.png` — fresh vessel 04 plan selection
- `fresh-irwan-selected-for-deploy.png` — exact approval entry selected
- `fresh-irwan-after-deploy.png` — browser deployment success
- `stale-popup-ready-before-first-unassign.png` — second tab ready before first submit
- `first-browser-unassign-success.png` — first browser success
- `second-stale-browser-unassign-success.png` — repeated stale-popup success