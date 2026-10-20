# Approved stored-PDF rollout — 20-Oct-2026

The user approved the final-glance layout and real-form PDF generation.
The server-owned generation policy is enabled; branding/status and preparation
use the same policy. The existing per-tenant background queue and completion
requests prepare copies from immutable snapshots. No real-time crew lookup is
used to render a queued document; canonical evidence and earlier archives are
never overwritten. Failures remain recorded and Fill in-authorized Retry is
available. No email code or void-notice implementation is included.

## Main-preview evidence

One disabled-period completed request existed at the start:
`0b4e24e7-c0e4-46b6-b158-950cd3d6df0b`.
Its frozen-record SHA-256 remains
`305e6da2cfdfc271b47bddbced760a3f85725a1b00b5e517c56cc3ffb090353f`.
It predates the short-reference/header additions. Its original missing facts
remain missing; the reference derives only from the frozen completion year and
the complete frozen record UUID:
`CF-2026-0b4e24e7-c0e4-46b6-b158-950cd3d6df0b`.
This is a legacy reference, not a retrospectively inserted signing-time fact.
The original frozen JSON and hash are compared against the pre-rollout capture.

A deliberately registered new fixture reuses the existing fixture-only vessel,
crew and assignment; see `pdf-rollout-fixtures.json` and the fixture register.
Its conditional rule is restricted to that vessel in every condition set.
It is NOT entered in `frm_document_samples`. Two signatures and Submit were
clicked through the main preview; the ordinary worker prepared its stored copy
without an API retry: `CF-2026-000005`.

`scripts/verify-company-pdf-rollout.mjs` reuses both records, verifies browser
Download matches the exact archived SHA-256, and verifies Print copy opens the
stored blob. It also checks that the queue is empty and the queued frozen
record has not changed. `--closing` additionally requires the backend start to
be later than HEAD. Artifacts and screenshots are outside Git under
`generated-artifacts/company-pdf-rollout/`.

## Excel compatibility

The optimized generator makes **SAIL_Crew_Import_Template.xlsx**, downloaded
from **Admin → Rank Administration → Vessel → Import Crew → Template**
(the dialog is titled **Import Crew Members**). It is the general crew
migration workbook, not **Vessel_Crew_Import_Template.xlsx**.

The original template timing test and its timeout remain unchanged.
`tests/integration/crew-template-import-roundtrip.test.ts` generates the full
30,000-row workbook, opens it, replaces the illustrative rows with one
synthetic crew member, preserves the attachment formulas, and runs the actual
`validateImportData` and `executeImport` services. It asserts validation,
successful import and the stored crew name in the identity-guarded test
database, then cleans up that crew record there. Its separate 120-second
budget covers generation, ExcelJS round-trip and both importer passes; it
does not change the existing 30-second generation regression gate.

## Next slice

The void-notice slice remains unbuilt and requires separate plan approval.
Its closing full-suite ceiling is now 162 failures and 67 pending, not the
older 163 in the original draft. Company Forms zero skipped, TypeScript at
most 222, and main backend newer than final commit remain required.
