# Company Form profile history acceptance

## Scope and placement

The Company Form home is **G3. Company Forms**, after G1 Briefing and G2
De briefing inside Part G of the existing crew profile. The Part G heading
becomes **Briefing, Debriefing & Other Forms**. Its stepper label remains
**Brief & Debrief**. This work does not execute another project task.

The profile groups every authorised submission across every assignment and
stage. Cancelled assignments, archived definitions and completed, in-progress
and voided submissions stay visible. Outstanding classification must never
filter the complete history.

## Step 1: confirmed baseline

The normal crew assignment history endpoint already returns Cancelled
assignments when `is_deleted=false`; it is reused, not replaced or broadened.
The existing submission home endpoint loads every historical crew-assignment
subject, including separately soft-deleted rows, then authorises each subject.
It already returns all stages. Its missing display metadata is added through
the subject adapter, not crew-specific behavior in the generic core.

Existing per-submission endpoints supply pinned definitions, assets and
readable reciprocal void/replacement labels. No Admin read is needed.
The profile remains a history home, not a new creation or voiding entry point.

Read-only inspection on 4 October 2026 verified the retained synthetic
seafarer `424584fc-dc59-4f85-aa14-30781eb8477e` and assignment
`10df4ffb-db61-46a9-ac7a-cc5e290b7376` already have:

| Record | Stage | Status | Submission |
| --- | --- | --- | --- |
| Original Pre-Employment Declaration | Before joining | Voided | `026068b1-a083-4f86-9bf0-166df6ba6f6a` |
| Replacement Pre-Employment Declaration | Before joining | Completed | `8de8fd4f-31f8-4a62-ba4b-7d2ba43715fd` |
| TEST ONLY ONBOARD DECLARATION original | On board | Voided | `285ee9f9-b2c3-484d-a738-ce2a3ed4a4c3` |
| TEST ONLY ONBOARD DECLARATION replacement | On board | Completed | `6b2d6d21-2f1f-4fe2-b674-7224ba368fe7` |
| TEST ONLY ONBOARD HANDOVER | On board | Voided | `fc16b1d1-711c-477c-981a-6531acc72002` |

The two before-joining records reference each other. Their original frozen
values and signatures must not be changed. The separate readability fixture
belongs to a different synthetic crew member and must not be substituted
for this acceptance journey.

## Required closing evidence

Commit after each of the six implementation steps and report HEAD. After the
final source/driver commit, start the managed backend and record its actual
PID/start time, later than the commit. Then an authorised retained Office
crewing actor without Forms authoring privileges opens the actual crew profile,
Part G/G3, expands the assignment and opens the original before-joining form,
its replacement and the completed on-board form. Click both directions of
the before-joining links and confirm exact targets, pinned versions, readable
labels, frozen content, preserved signatures and read-only completed/voided
behavior. Retain real screenshots, network evidence and protected comparisons.
HEAD and PID must remain unchanged during this closing journey.

This is a read-only journey. Existing bootstrap reference-data requests are
distinguished from form operations; Company Form reads must be submission-only.
No production authentication configuration is changed. Existing development
persona checks do not certify production identity-provider login.

## Preservation and test scope

Capture a fresh before/after baseline; previously voided records are compared
against their current starting state, never an older completed-state export.
Do not unarchive forms, create a vessel/rank variant, clear an occupied slot,
reset assignment status or mutate/re-sign protected declarations.

Run every Company Form/submission-area regression suite, including shared
authoring/renderer consumers. Skipped, missing and empty suites do not count
as passes. Compare TypeScript against HEAD; unrelated diagnostics must be
reported rather than presented as a clean build. If an unrelated task's
failure blocks certification, report it and ask rather than executing that task.

## Step 5 checks

The complete discovered Company Forms/submission inventory passed on
4 October 2026: **46 suites, 333 tests, zero skips**. The new service/UI tests
cover all stages and statuses, Cancelled and submitted soft-deleted history,
empty groups, authoritative permitted-subject grouping, wrong/unprovisioned
vessel and cross-crew refusal, exact row/relationship targets, explicit 403
handling and history navigation inside a disabled fieldset.

The read-only compiler-host comparison against the starting commit
`bbf84f6e4a0e638ad446c5f215fcb5e17506751c` found **226 existing diagnostics
before and after, no new diagnostics**. This is not a clean TypeScript build.
Full reports are retained under `.local/verification/`.

Assignment groups explicitly say **Not recorded on assignment** for rank:
the assignment model has no rank field. Today's crew rank must not be used to
manufacture a historical assignment rank. Saved declarations still open their
own original frozen System values.