# Training Matrix slice 2 — implementation and closing evidence

## Scope

Canonical linked-assignment inputs and accepted equivalent-course authoring only.
No compliance calculator, changes to Vessel matrix dots, Training Needs, checklist
gate, override permission or Reliever compliance window have been enabled.

## Canonical inputs

`GET /api/v2/vessel/planning/:planUuid/reliever-assignment/:assignUuid`
keeps the exact persisted planning/assignment/crew/vessel join. It returns:

- `contractRankUuid` and the captured label from the assignment's contract context;
  never `crew_members_v2.present_rank`, a display-name match or an inferred assignment.
- `plannedJoiningDate` from `reliever_sign_on_date` only.
- `contractRangeEndMonths` from `reliever_contract_end_range_end_months` only.
- Explicit `inputAvailability` values, including `absent`.

The popup no longer seeds its reliever date, contract period or range from shared
planning values. Missing contract rank displays **Not recorded**.

The existing occupied-position Deploy regression exercises the real endpoint:
the incumbent has `2030-03-01` and nine months, while the reliever's values are
NULL. The response keeps both reliever inputs NULL/`absent`. A different present
rank does not replace the captured contract rank. Raw source values and response
are printed by that regression in the test-database log.

Its older teardown still attempts to delete assignments before their captured
contract-context children. The focused canonical assertions pass, but that
existing suite-level foreign-key cleanup error is not described as a green run.

## Storage and publication

Migration `0260_training_matrix_equivalents.sql` adds draft/revision-owned,
master-UUID links and append-only events. It does not change old revisions or D3.
No links means direct-course-only policy. Links are directional; no reverse or
transitive links are inferred or written.

The active vessel is locked while editing/publishing. Revision creation, copying
independent frozen links and consuming the working draft share one transaction.
Both the Submit and generic Create Revision entry points freeze the links.
Normal Save Draft inherits a prior revision's alternatives. Database guards
refuse mutation/deletion of saved links or audit events; composite parent keys
refuse links assigned to another vessel's draft/revision.

The parent vessel master does not provide a unique `vessel_uuid` constraint.
Ownership therefore uses the matrix parent's composite key, with an explicit
single-active-vessel check, rather than adding a global constraint to parent data.

## Permissions and editor

- New equivalents read: **Admin Training Matrix View**.
- Equivalents and existing matrix write/publish paths: **Admin Training Matrix Edit**.
- Existing draft deletion: **Admin Training Matrix Delete**.
- Actor identity is derived from the authenticated request. Browser identity
  fields and unsupported body properties are refused.
- Existing Vessel matrix read paths are unchanged.

In **Admin → Training Matrix → Vessel**, select exactly one vessel. “New Revision”
opens draft editing; “Also satisfied by” selects master courses by name/code.
UUIDs, not names, are submitted. The same save includes the current applicable
course selection. Save/discard accepted-course changes before publishing,
cancelling or changing the selected vessel. Historical revisions are read-only.

## Automated evidence

All 14 new tests passed in the focused run:

- Ten isolated-database API/SQL cases: idempotent migration, identifier validation,
  explicit links, server audit identity, authoring refusal, current applicability
  preservation, independent copying, immutable history, both publication paths,
  stale publication epoch, cross-vessel parent and cross-tenant refusal.
- Four editor cases: searchable save/reload and cleared dirty state, historical
  read-only view, View-only controls and plain errors with Retry.

The API cases use signed JWTs with authentication bypass removed. Each database
namespace has its own search path and is dropped normally afterwards. They run
only in the identity-verified test database; no main-preview crew/certificates are
copied or changed.

## Commits

| Step | HEAD | UTC commit time |
|---|---|---|
| 0 — canonical inputs | `a96e167293ac6a6756336f9a60ed1b0e5bf92356` | 20-Oct-2026 16:24:07 |
| 1 — storage | `fa08604a6a1ca49c82333ac7a59faef91d449ce4` | 20-Oct-2026 16:29:21 |
| 2 — protected server/publication | `aa60516279bee02bb8c73acde517a6afe416c744` | 20-Oct-2026 16:40:58 |
| 3 — authoring UI | `3ac6c0df0ea1af2aa037c58beaa630d2e5a4481e` | 20-Oct-2026 16:46:56 |
| 4 — regression tests | `c84f5bbcf2ce38c18d4b2ee7996e2dbfa714dc68` | 20-Oct-2026 16:49:38 |
| 4 — exact route-inventory correction | `4ea9b84a9437c77bb534a8d7978f7610c0b7be14` | 20-Oct-2026 16:59:18 |

Generated logs, SQL fingerprints and screenshots live outside Git under
`generated-artifacts/training-slice2/`.

## Main-preview acceptance

The approved existing development persona was used through the real screen:
**Crewing Manager**, user 3, parent role
`408d9fe9-1d0f-11f1-925d-5419ffd80f01`. Its existing Admin Training Matrix View/Edit
grants are true. No grant was added. Requests pass through the same strict
role/grant middleware and matrix service as ordinary logins; no bypass is added
to the policy handlers. Normal parent sign-in remains a production verification
item, not something claimed by development-persona UI evidence.

On the registered fixture vessel **TEST ONLY PDF layout review**:

1. Checked two applicable courses, selected two directed accepted alternatives,
   then saved through the screen.
2. Published R0 (`9f2ae8cd-fcd2-4569-a2b1-b3b8632bd95c`) through Submit.
3. Created the next working draft and changed the alternative.
4. Selected R0 through the source selector: both original links remained and
   editing controls were absent.

The walkthrough captured 16 matrix requests, all successful, with no page errors.
Saved draft `ae8f8713-8c6f-47cb-ab64-b96d03afffa3` remains for reuse. The fixture
manifest and central register identify all retained records. Future normal
verification runs are read-only and refuse writes even on this fixture.

The first walkthrough caught the new panel squeezing the original matrix's
checkboxes behind another element. The final layout gives the original table a
bounded scroll pane and places both sections in a scrollable content region.
Normal Playwright checkbox clicks then succeeded; no forced clicks or DOM
substitution were used.

### Actual SQL evidence

`main-sql-evidence.json` records three retained equivalent rows:

- R0: A accepts B; B accepts C.
- R1 draft: A accepts C.

All three audit events identify server actor `3`. The new-draft event records the
two previous links and the one replacement link in its before/after values.
The published link rows have independent IDs from the draft's links.

Before/after SHA-256 content fingerprints and counts match for all protected
main data: 78 training masters, 75 company-training rows, 476 rank-requirement
rows, zero non-fixture working drafts and all eight non-fixture vessel revisions.
No real vessel policy, rank requirement or seafarer certificate was changed.

### Gate correction

The initial full run was 1,397 passed / 163 failed / 67 pending. The sole added
failure was the exact Admin permission-route inventory, which inspected the
entire router but still expected only the older Forms guards. Eight explicit
Training Matrix entries were added to that expected table. Exact equality and
all existing assertions remain; no route is excluded to make it pass.

## Final standing gates

The final unfiltered run reports **1,398 passed / 162 failed / 67 pending**,
1,627 tests total. All 14 new tests pass, and comparison against the preceding
full-suite report finds no newly failing assertions. The overall suite is
**not green**; its existing failures remain within the agreed limit.

Company Forms was checked as the complete discovered subset of that same
unfiltered report: **96 files, 648 passed, zero failed, zero skipped/pending and
zero todo**. The strict coverage/missing-suite checker reports no failures.
TypeScript reports **222 diagnostics**, within the stated limit.

After this closing commit the managed main workflow is restarted and the
read-only walkthrough is repeated without creating any fixture. Its actual
HEAD, backend PID/start time and capture time are saved to
`generated-artifacts/training-slice2/closing-main-preview.json`; screenshots and
UI-triggered response bodies are in `closing-preview.json` and
`closing-preview-historical-readonly.png`. The evidence recorder refuses a
backend start that is not later than the final commit.

No later slice has been built. Separate follow-ups cover the existing reliever
fixture cleanup and same-draft concurrent-edit conflict detection; neither
weakens or changes the frozen revision guarantees delivered here.
