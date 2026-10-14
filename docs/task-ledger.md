# Task completion ledger

This ledger, not the task panel, is the authoritative record of completed work from task #344 onward.

## Repository test baseline — 2026-10-05

The closing regression ceiling for the stage-specific Company Forms popup
revision is **162 failed assertions and 67 pending tests**, measured at
`37967ecd1aa30f1e3000ccd4d3a951fcf5079130`: 115 test files, 1,254 tests,
1,025 passed. The run selected every repository Vitest test configured by
`vitest.config.ts`, serialized with `--no-file-parallelism`; configured E2E
exclusions were unchanged. Source revisions used isolated matching backends
and databases restored from one current development snapshot, not historical
database reconstruction. See `.local/verification/full-suite-attribution/`
for the retained results and attribution.

This baseline is not a passing suite. Closing must not exceed either ceiling.
The independently inventoried Company Forms/shared-consumer suite must pass
with **zero skipped, pending, missing or empty suites/tests**.

Append one row whenever a numbered task fully completes. Record its task number, title, completed implementation commit, and that commit's UTC date. Do not record plans, intermediate steps, or unverified completions. If the ledger update is committed separately, reference the implementation commit, not the later ledger-maintenance commit.

| Task | Title | Completion commit | Date (UTC) |
| --- | --- | --- | --- |
| #344 | Add Company Form Content points using proven Word paste code | `c64192a060266a7ab282ffadedbc955ef7836546` | 2026-09-29 |
| #348 | Add Company Form System Fields | `65584f0fd14a62e4cfcf08f2803fe737e524d6fb` | 2026-09-29 |
| #351 | Record Company Form entry decisions | `d62bbbc035c2a3ffb3996072d37ba5771c111712` | 2026-10-01 |
| #352 | Persist staged Company Form submissions | `91134424a949db46c53afce8bdb746afc88b5b3e` | 2026-10-01 |
| #360 | Link deployed relievers to assignments | `30a10a5a5885c2a774e5748dabd21695213be082` | 2026-09-30 |
| #361 | Remove obsolete Crew assignment paths | `55a71e1b40f6537b3e5e4001b7845b0f431f8524` | 2026-09-30 |
| #362 | Use assignment identity for sign-on and sign-off | `d7dbd0f1118e3c5c36a2308a08f3412d4be3c475` | 2026-09-30 |
| #365 | Let administrators safely clear unlinked relievers | `21cf7816cd0f2cb119ece1f22dba964efa1f06da` | 2026-09-30 |
| #368 | Prevent invalid assignment vessel IDs | `7228d8d0463db2421f062442bed10a5c959fb478` | 2026-09-30 |
| #354 | Start and edit Company Forms safely | `281f5640ca450d653d1260223e26915a605991ec` | 2026-10-01 |
| #355 | Complete and sign Company Forms | `4684b96a3bbf32bafa85769644c1fdc1d063f340` | 2026-10-02 |
| #356 | Open joining forms from Planning | `0cf92fceef8117be2d7bafe75710e0507b2f764f` | 2026-10-02 |
| #358 | Open sign-off forms from Planning; separate stage-scoped operational popups, G3 full history and UUID-free headings | `5817fd94fad9938bc0586502990e76c4a3e2db4f` | 2026-10-05 |

## Inventory audit — 2026-10-01

All ten verified completed tasks in the current project catalogue from #344
onward are recorded above. Each implementation hash is reachable from this branch, and
each date matches the implementation commit's UTC date. Tasks #351 and #352
remain recorded from their delivered commits even though the task panel has
not reflected their completion; the ledger remains the authority.

The current catalogue has no additional verified completions after #368.
Unimplemented plans and archived suggestions are not completion records.

Task #354's previous completion row was withdrawn after the client review of
`4b2f366e7961bf0dfd590bc4581dec4921cf984d` found two P2 defects. Both were
corrected in the implementation recorded above. The same independent client
reviewer approved that exact commit and independently passed 54/54 renderer
tests. There is exactly one completed row for #354. See
`docs/company-forms/submission-runtime-verification.md`.

## Browser/preview provenance audit — 2026-10-02

See [Backend restart evidence audit](backend-restart-evidence-audit.md) for the
historical completion rows covered by that audit. No historical server-task browser/preview claim in the
retained records establishes the required final-commit → backend-start →
browser-check ordering. Those claims are **NOT VERIFIED**, not retrospective
proof that every check failed or that the implementation was absent.
Completion rows remain unchanged; this audit qualifies their visual-verification
provenance rather than substituting new completion hashes.

The later #356 closing acceptance has separate live evidence in
[the retained fixture registry](company-form-regression-fixtures.md) and
`docs/verification/joining-forms/`. Its closing browser harness explicitly checks
latest commit → newer main-backend start → browser reload, preserves HEAD/PID,
and verifies the completed declaration and source-change notice. The #356 row
references its implementation commit, not the later evidence/ledger commit.