# Crew Match (read-only)

## Use

In Admin > Rank Admin > Vessel, alongside Attachment Convertor, select **Crew Match**.
The desktop/mobile actions require explicit **view** permissions for both **Crew Database**
and **Terminated**. The API independently verifies the authenticated user's stored role in
the current tenant. Anonymous requests are denied except in the application's explicitly
configured local-development mode: `NODE_ENV=development`, `AUTH_BYPASS=true`, and no
`JWT_SECRET`. This exception applies only when no user is supplied; tenant resolution still
applies. Supplied users still require both permissions. Production never uses this exception.

1. Download the template and enter names under `Crew Name` (header in row 1).
2. Upload a standard, unencrypted, macro-free `.xlsx` workbook.
3. Select the worksheet if more than one contains the header.
4. Generate the report, then download Excel. No result table appears in the dialog.

The upload is parsed in memory, never retained. No crew, attachment, training, reference,
or filesystem data is changed. No migration is needed. Existing import/converter behavior
is untouched. Only upload the small name workbook, not the 70 GB attachment folder.

## Matching and scope

Rule version 1.0.0 matches `first + middle + family`, `family + first + middle`, and—only
when both separate middle/family fields are blank—the complete `first_name` field in its stored
or complete token-reversed order. The final cases support legacy records where a full name was
stored in `first_name`; they are never partial or fuzzy first-name matches and do not infer which
tokens are surnames. All checks run together and candidates still deduplicate by crew UUID.
Names are NFC/case/whitespace normalized, but original inputs are retained. No fuzzy match,
punctuation/diacritic stripping, arbitrary word sorting, or omission of populated middle
names. Candidates deduplicate by crew UUID, never employee number or name. The report's
Employee ID comes from `crew_members_v2.emp_no`, not `employee_id`.

One tenant-scoped SELECT fetches the necessary fields once per report. Records with
`is_deleted=false` are eligible, including archived records. Archived matches require review
and remain candidates for ambiguity. Soft-deleted/null-deletion-flag records are excluded.
Insufficient permissions or database errors reject the whole request; they never create a
partial dataset or misleading Not Found results.

Unique name match is **not independently verified identity**. Review before renaming folders.
Not Found means **no match under these rules and scope**, not proof of absence from SAIL.

## Status classification

- Known termination labels: `Terminated`, `Terminated - NFR`, `Terminated Employment`,
  `Terminated Employment - NFR`. These take precedence over a contradictory active flag,
  which is disclosed in the reason. Labels are compared case/whitespace-insensitively.
- `Active`, `On Board`, `On Leave` with `is_active=true`: Active.
- Inactive, unsupported/null status, contradictory or missing active flag, archived record,
  or missing `emp_no`: Review Required. No catch-all "not terminated means active".
- Current stored state is used; old termination history does not override reactivation.
- Multiple crew candidates always go to Ambiguous, regardless of their statuses.

Raw SAIL status/flags are exported, not changed. This reports a snapshot of stored crew
state, not a historical/as-of employment calculation or a live vessel-assignment report.

## Workbook

Summary; Active; Terminated; Not Found; Review Required; Ambiguous; Ambiguous Candidates.
Each input data row belongs to exactly one of the five outcome sheets. Candidate detail rows
are extra, not additional inputs. Source filename, worksheet, row, original name, rule version,
read-start timestamp and generation timestamp (UTC) are included.

Repeated rows are retained and flagged. Multiple source rows resolving to the same employee
are flagged as folder-renaming collision risks. Invalid name cells (formulas, numbers, dates,
errors, hyperlinks, >250-character names) require review. Blank rows inside the data range
are retained; trailing formatting-only rows are ignored. Rich text is treated as literal text.
Additional input columns are not copied to the report and never used for matching.

Ambiguous summaries align ID/name/status lists. If lists exceed Excel summary-cell limits,
all three refer to the full candidate-detail sheet instead of silently truncating. No selected
employee ID is assigned for ambiguity. Strings are written as literal XLSX cells, not formulas.

## Limits and deployment

- `CREW_MATCH_MAX_ROWS`: default 10,000; configurable 1–20,000.
- `CREW_MATCH_MAX_BYTES`: default 5 MiB; configurable up to 10 MiB.
- Fixed safety caps: 50 MiB expanded ZIP content, 500 ZIP entries, 50 worksheets,
  100,000 candidate rows. Exceeding caps fails explicitly, never generates partial output.
- Feature-only limit: 10 requests/minute per IP; two processing requests per server process.
  For multi-instance deployments, an ingress/shared limiter may also be needed.
- Existing ExcelJS/JSZip dependencies are reused. Expanded-data checking uses JSZip 3.x's
  ZipObject internalStream (present at runtime, missing from its bundled TypeScript interface);
  compressed-workbook safety tests must be rerun on dependency upgrades.
- Responses use `Cache-Control: no-store`. Uploaded data is not included in error logs.

Routes under `/api/v2/crew-pool/crew-name-match`: GET `/template`, POST `/inspect`,
POST `/report?sheet=...&filename=...`. POST body: raw XLSX bytes with
`Content-Type: application/octet-stream`. Existing authenticated tenant headers apply.

Pilot with a known, authorized name list and compare all statuses before full rollout.
Production data was not queried or migrated during implementation. Rollback is removal/
disablement of this feature's route and UI entry points; no data rollback is needed.

## Tests

`npx vitest run tests/unit/crew-name-match.test.ts tests/unit/crew-name-match-workbook.test.ts tests/unit/crew-name-match-controller.test.ts tests/unit/crew-name-match-dialog.test.tsx --reporter=dot`

Tests cover normalization, conflicts across statuses, unsafe inputs, limits, workbook round trips,
row reconciliation, authorization, scoped datasets, database failures, and the upload dialog.
Run converter/import/training regression tests as well. Live user-role/tenant verification and
production performance should be checked in staging; tests do not open a production connection.
