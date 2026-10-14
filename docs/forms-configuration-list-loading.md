# Forms Configuration: truthful, isolated, batched version loading

## Contract

- The UI requests `GET /api/v2/admin/forms?includeSummary=true` once.
- Every form carries a `versionSummary`, normalized rank groups and the same
  version-independent editor-part metadata formerly fetched individually.
- The server uses a fixed four reads: the form inventory, versions, rank groups
  and parts. It does not invoke the per-form versions endpoint or applicability
  enrichment for each form.
- A successful empty version list means **No versions**. An unavailable or invalid
  summary means **Could not load**, with **Retry**. Neither case reads version
  numbers or dates from the legacy form mirror or generates a Draft status.
- Standard rows display the latest stored released version for their exact rank
  group; where no release exists, they display an actual saved draft. Its badge
  and date belong to that actual version.
- Company rows display their actual latest version. Failed rows do not display a
  release status or date.
- Retry requests `GET /api/v2/admin/forms/:id?includeSummary=true` and replaces
  only that form's cached summary. Healthy forms remain visible and usable.
- The original endpoints without `includeSummary=true` retain their response
  contract. Permissions, release policy, form content and saving rules are not
  changed.

## Automated evidence

`node scripts/verify-forms-list-test-preview.mjs` first verifies the independently
registered test database identity, starts its own backend on port 5100, and
creates disposable synthetic forms there. It never writes to the main preview.
The 500 Standard and 500 Company forms deliberately have legacy mirror values
different from their actual saved versions.

Measured with system Chromium on 13 October 2026:

| Measurement | Result |
|---|---:|
| Synthetic forms | 1,000 |
| Total forms including existing test baseline | 1,005 |
| Initial form-list requests | 1 |
| Per-form initial version/parts requests | 0 |
| Summary request, browser network timing | 74 ms |
| Cold navigation through Standard list ready | 10.741 s |
| Cold navigation through both tabs verified | 11.380 s |
| Normal-load browser resource errors | 0 |
| Normal-load API errors | 0 |

Controlled network-fault injection makes one summary unavailable in each tab.
Only that tab's selected row shows **Could not load**. A deliberately failed
single-row Retry receives HTTP 503; its internal error text never appears in the
screen. A subsequent real server request recovers the row's actual v02.

Screenshots and machine-readable evidence are in the ignored
`generated-artifacts/forms-list-test-preview/` directory. All 1,000 temporary
forms and their versions were removed through normal isolated-test teardown.
They are not retained main-preview acceptance fixtures.

## Closing gates

- Full suite: **1,245 passed, 163 failed, 67 pending**. It meets the approved
  ceiling but is not fully green.
- Company Forms discovery gate: **86 files, 514 passed, zero failed or skipped**.
- TypeScript: **222 diagnostics**.
- Twelve new list-state, summary and API regressions pass.

`node scripts/verify-cleaned-forms-preview.mjs` is the read-only closing
main-preview check. It requires the backend start to be later than final HEAD,
reuses the existing parent Office/Admin account, verifies the six original
Standard Forms and specifically checks Cadets v02, Promotion to Master v09 and
Promotion to Chief Officer v10. It creates no development fixtures. Its current
closing result and screenshots are written to the ignored
`generated-artifacts/cleanup-preview/` directory.
