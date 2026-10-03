# Joining declaration readability and historical read views

## Scope

Follow-up to the Planning joining-form entry point, implemented as one change.
Implementation commit: `4f5c384995fd321ba07f17dd1b49bd1ef9d462ab`.

The protected submission `026068b1-a083-4f86-9bf0-166df6ba6f6a` is never
modified by this verification. Its starting-state database capture showed that
it had already been voided at `2026-10-03 06:11:42.714 UTC` and linked to a
replacement before this work began. Checks compare its full row against that
fresh starting state, not the older completed acceptance record.

## System-field audit

| Available System field | Future frozen display | Companion system value |
| --- | --- | --- |
| Seafarer name | Joined readable first/middle/family name | Same name |
| Rank | Base company-rank master name, e.g. Pumpman | Stored crew rank code, e.g. R017 |
| Nationality | Nationality master name, not its UUID | Same readable name |
| Vessel to join | Vessel master name, not its UUID | Same readable name |
| Sign-on date | dd-Mmm-yyyy | Original ISO calendar date |
| Date of declaration | dd-Mmm-yyyy, from the declaration context at first freeze | Original ISO calendar date |

These are all six available fields in the current subject registry. Missing
rank-master resolution fails explicitly rather than freezing an internal code
as readable text. The two date-field formatting paths and raw companions have
unit coverage. The released declaration pins name, rank and vessel; no released
definition was modified to add test-only date questions.

Migration 0230 only adds nullable capture columns. It does not backfill or
rewrite an existing snapshot. Existing frozen strings—including R017—remain
exactly as recorded. Legacy comparisons use raw values, so changing the future
display format alone does not produce a false source-change notice.

## Void identity and date

Future void operations capture the authenticated master user's name and
designation on the server inside the void transaction. Reads use that capture,
not a current-user lookup or body-supplied identity. Dates display as
`dd-Mmm-yyyy HH:mm:ss UTC`. Older void records without a captured designation
say “Designation not recorded”; no present-day designation is fabricated.

## Vessel-type control and historical sections

Previously the shared renderer displayed its Preview vessel-type selector on
live Company Form views. It could change the selected filter/label, but explicit
server applicability took precedence, so it did not reliably change the
sections shown. No submission write was associated with that selector.

The control is now Preview-only for Company Forms. It is absent from completed
and voided read views, and also from other live Company Form views.

New first-signature/first-submission transactions capture the applicable section
UUIDs alongside the whole-form System snapshot. Later reads use that captured
set, not the vessel's current type. Completed and voided views omit sections
outside the captured set. Historical records without this capture use recorded
section state/signature evidence and universal applicability; ambiguous
restricted historical sections fail explicitly rather than guessing from
current vessel data.

## History

History reads join the pinned version and subject-stage catalogue independently
of today's eligible forms. The display is:

> Version 02 · Released 02-Oct-2026
>
> Before joining

The version identity and internal stage key are not used as display labels.
Archived/out-of-catalogue history has unit coverage.

## Retained new fixture and browser evidence

| Record | UUID |
| --- | --- |
| Synthetic seafarer, TEST ONLY READABLE DECLARATION REGRESSION | `426f7335-4882-4984-859f-2c1013d2b3af` |
| Existing vessel 03, configured Pumpman R017 | `7440571a-841a-11ed-aa7c-7003bca91a86` |
| Normal Rotation draft | `9435e0fb-918b-4366-8607-f20f7d5bfe9b` |
| Rotation entry | `07b10740-73bb-4831-9cbd-645eb0243817` |
| New Planning row | `a7358272-29df-4274-ac28-9259824e2f5c` |
| Exact deployed assignment | `7521f648-7125-4855-a51c-22660a20bc0f` |
| New declaration, completed then voided for evidence | `da1cba4e-76b7-44a0-b03c-19b881dfdaae` |

The existing synthetic Office actor was reused without Forms authoring access.
Normal Rotation used an empty configured slot; all 85 pre-existing Planning
rows remained unchanged. No vessel, rank variant, released definition or
existing frozen value was changed.

Real-browser acceptance:

- Created the new declaration through Planning and selected released version 02.
- Drew the first witnessed signature and verified Pumpman/R017 were frozen,
  before any section Submit.
- Drew all four policy signatures, submitted both sections through confirmation
  dialogs and verified automatic completion.
- Reloaded the completed read view and verified no vessel-type selector.
- Voided only the new declaration through the browser; reloaded its history/read
  view and verified captured identity, designation, UTC date and no selector.
- Checked the protected submission's full row and all pre-existing snapshot-row
  fingerprints against the starting capture.

All 60 targeted tests passed. TypeScript remains at the existing 226 diagnostics,
with no diagnostics in the changed production files.

Versioned evidence is under `docs/verification/readable-joining-forms/`.
The first-signature and completed evidence retain their implementation-commit
chronology. A final read-only check is run after the closing documentation commit
and a newer backend start. Its current generated record is
`.local/verification/readability-voided-no-selector.json`; the harness records
HEAD, commit date, actual main-backend PID/start, actor identities and browser
check time, rejects a stale backend, preserves HEAD/PID, and forbids mutation
requests during the final read-only check.