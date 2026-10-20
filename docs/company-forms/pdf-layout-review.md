# Company Form PDF layout review — 20 October 2026

## Approval status

**Real-form PDF generation remains disabled. Layout approval has not been given.**
Only the two registered acceptance samples can be prepared. Downloading, printing
or handing over either sample does not enable generation for any other form.
Each later slice still requires its plan to be shown before implementation.

## Samples supplied for review

Both PDFs are four pages. The with-logo sample covers before-joining Company
Representative signing and a witnessed seafarer signature. The company-name
fallback sample covers on-board Vessel Management signing and a witnessed
seafarer signature. Together they contain all three signature types, frozen
names/designations/dates, “Not recorded” in the signature and rank System field,
a long answer spanning pages, recorded comments, page numbers and the explicitly
labelled frozen-record SHA-256 footer.

| Sample | Stored file SHA-256 | Frozen-record SHA-256 |
|---|---|---|
| With sample logo | `a4f298a0a57caaa143c839796d308ee1e9f81b606a7bb010b171ff916cfbc67c` | `d50365e39e62a48478718060fbfd092840627cf8e8001123d4b87896c6a3ae4e` |
| Company-name fallback | `cad9902b1600c52e28d0e37d9201254cde85f4b351974d69d82b9a24b7e52429` | `f3d7b7156cfed92366b41db01d1ce0e2331418bad7f91e8a99141fa223c2fa1c` |

The fixture logo is explicitly a sample, never the SAIL application logo.
Sample branding is registered separately from real tenant settings and never
becomes the default branding of real forms. The archive entries are unchanged
originals, not freshly rendered copies for each download.

Files delivered from `generated-artifacts/company-pdf-layout/`:
`sample-logo.pdf` and `sample-company-name.pdf`.
This directory is outside Git and deployment packaging.

## Main preview locations

- **Logo setting:** Admin → Access Control → **Company PDF branding**. Also
  available at the top of Forms Configuration to permitted managers. Uploading
  or reading the setting requires an **explicit** Access Control management
  grant, not a role name or bootstrap recovery access.
- The current original preview Admin has bootstrap recovery access but no
  explicit management grant. The dialog therefore explains the required access.
  Real grants were deliberately not changed for sample preparation. A synthetic
  non-Admin management role successfully exercised versioned logo saving and
  no-logo saving in the isolated test database.
- **Print copy:** open either completed sample from Crew Pool → seafarer →
  G3 Company Forms → the appropriate assignment → Open form.
- **Copy handed to seafarer:** beside Download and Print copy for a user with
  assignment-scoped Fill in. The recorded identity, time and exact file
  fingerprint appear in the form and its G3 entry.
- Sample names: **SAMPLE PDF layout review — logo** and
  **SAMPLE PDF layout review — company-name**.
- The logo sample reuses the retained TEST ONLY joining-regression seafarer;
  his protected vessel-02 assignment and rotation records were not changed.
  The on-board sample uses **TEST ONLY PDF Layout Seafarer**, on the dedicated
  **TEST ONLY PDF layout review** vessel.

All deliberate fixture identifiers, including an unused retained preparation
assignment/version, are registered in
`docs/company-form-regression-fixtures.md` and
`docs/company-forms/pdf-layout-fixtures.json`.
Both released sample policies restrict every condition set to that fixture-only
vessel; neither can match real crew. No Standard Form was changed.

## Verification and remaining gate blocker

- Company Forms: **89 files, 529 passed, zero skipped**.
  Evidence: `test-logs/pdf-company-forms-final.log` and its referenced area report.
- TypeScript: **222 diagnostics**, within the approved ceiling.
  Evidence: `test-logs/pdf-typescript-final.log`.
- Full suite: **1,260 passed, 163 failed, 67 pending**, **not** within the
  approved failure ceiling of 162.
  Evidence: `test-logs/pdf-full-suite-final.log`.
- Relative to the prior 162-failure run, the extra failure is
  `tests/unit/modules/crew-pool/crew-import.test.ts`, “should successfully
  generate a styled multi-sheet Excel template buffer”: it exceeds the existing
  30-second timeout. The previous baseline completed that test in 27,876 ms.
  It timed out in the ordinary full run, a full run with 4 GB Node heap, and a
  focused run. Its assertions, timeout and unrelated implementation were not
  changed to force a passing count. This gate remains explicitly blocked.
- API/SQL regressions prove explicit non-Admin management authority, strict
  rejection of browser audit identity, immutable branding versions, frozen
  logo selection across a subsequent no-logo change, completed required-form
  publication, concurrent preparation producing one archive, repeated identical
  file bytes, immutable archives and handovers, and rejected fingerprint/actor
  spoofing. Existing scoped-read and tenant-isolation tests remain green.
- Real main-preview clicks verified both samples' Download and Print copy,
  plus handover and G3 visibility. Browser-downloaded SHA-256 values match raw
  SQL. There are exactly two archived files, both registered samples.
- The closing browser report records final HEAD, commit timestamp, backend PID
  and start time and refuses to run unless the backend started after the commit.
  Evidence: `generated-artifacts/company-pdf-layout/main-preview-evidence.json`.

## Reusing the evidence

`node scripts/verify-company-pdf-layout-preview.mjs --closing` reuses the registered
fixtures, stored PDFs and existing handover records. It creates no replacement
crew, assignments or forms. The separate explicit provisioning command is not an
automated test and exits without creating anything once the manifest is complete.

The sample worker and archive use private tenant PostgreSQL bytes, with atomic
publication rather than workspace uploads. See `pdf-archive-storage.md`.
No email sending or real-form rollout was built.
