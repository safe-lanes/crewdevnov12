# Training compliance calculation 1.1.0 — review revision

User decision: 21-Oct-2026. Server-only, read-only; no screens, routes,
enforcement or Training Needs introduced. Slice 4 remains stopped for review.

## Revised decisions

An incomplete check is reserved for missing or invalid information that could
hide a blocking gap, rather than warnings that do not prevent a decision.

1. **Contract end absent:** preserve joining-date state. The check completes
   with **Contract end not set: full-contract validity not checked**. A finite
   unexpired certificate is Valid at joining; this is not a claim that it lasts
   for the contract. `contractEnd` and `validThroughContract` remain null.
   Expired and Not held remain gaps; permanent certificates remain held.
2. **Invalid certificate dates:** set that certificate aside and flag
   **Certificate dates invalid: correct the record**, identifying its certificate
   UUID separately. Choose among the remaining eligible certificates, still
   using longest validity and the selected revision's explicit equivalents.
   If none remains and invalid matching records exist, the requirement is
   incomplete. An expired but otherwise correctly dated remaining certificate
   instead proves a gap. A genuinely empty certificate list remains Not held.
3. **Missing issue date:** treat the certificate as held and flag
   **Issue date not recorded**. Null/blank issue dates normalize to null, never
   joining date, today or another invented value. Expiry still determines the
   state. A nonempty malformed issue date is invalid, not missing. An invalid
   expiry cannot be rescued by a missing issue date.

Future-issued certificates remain excluded at joining. No reverse/transitive
equivalence, current-rank substitution or incumbent planning fallback is added.
Month-end clamping and inclusive expiry boundaries are unchanged.

## Result contract

Version **1.1.0** is returned on every calculation and course result.
`CheckIssue.blocking === false` identifies a warning; absent/true remains
blocking, preserving existing reader errors. Warnings do not make
`status`/course `complete` incomplete.

Known gaps take precedence over warning summary status. A valid course with a
data warning has a warning summary, not an unqualified valid summary. Consumers
must not infer incompleteness from the mere presence/length of `issues`.
The calculator remains a result provider, not permission or deployment policy.

## Executable review table

`npx tsx scripts/report-training-compliance-cases.ts` reruns and asserts all
**37 cases**, writing Markdown and raw JSON outside Git under
`generated-artifacts/training-slice3-v1.1/case-table.*`.

- Original rows 1–16, 18–22 and 24: unchanged, rerun.
- Row 17: **Changed**, joining-date Valid plus missing-end warning.
- Row 23: **Changed** handling; still incomplete because its only matching
  certificate has invalid expiry, now explicitly set aside and flagged.
- Rows 25–37: **Added**, covering missing-end gaps/permanent certificates,
  valid direct/equivalent/expired certificates alongside invalid ones, missing
  issue dates with finite/permanent/expired certificates, malformed issue dates,
  combined warnings and longest validity when an issue date is absent.

The 37 review rows are unit tests, not merely hand-written expected output.
Database tests additionally prove actual D3 null issue dates and malformed
expiry data are handled without writing corrections or modifying fingerprints.
No main-preview fixtures are created. Automated private schemas are removed
normally in the identity-verified isolated test database.

## Commits and gates

Step 1: `c73ec1fc43046564d380b0e878f0da0b9f20164f`,
21-Oct-2026 04:04:51 UTC — calculator, version and kernel/database regressions.
**66 passed**; TypeScript **222**, no new compliance-module diagnostic.

Step 2: commit containing this initial review document — case table and
37 executable cases, all passing.

Final unfiltered standing gates and backend process evidence follow at closure.
