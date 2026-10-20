# Revised Company Form PDF samples — awaiting layout approval

Real-form generation remains disabled. This revision is not rollout approval.

## Seven requested changes

1. Every page has a running header containing the frozen company name, form
   title, seafarer name and version. Long names wrap; they are not truncated.
2. Page 1 prints Crew ID and nationality captured with the other header facts
   at first signing. Missing values print “Not recorded”.
3. First signing reserves a tenant-unique immutable reference, frozen into the
   record. The reference appears on page 1 and every footer. It is never
   allocated from current data at download time.
4. PDF and screen share the same numbering function: parts `1`, sections `1.1`,
   answer points `1.1.1`. Content and System fields remain unnumbered, as on screen.
5. Generated dates use `01-Oct-2026`; timestamps use `20-Oct-2026 05:21 UTC`.
   Recorded free-text answers are not rewritten.
6. Every signer has an explicit Rank or Designation label; witnessed signing
   also labels the witness designation.
7. The footer label is **Record fingerprint (SHA-256)**. Its value is still the
   SHA-256 of the frozen record. Exact PDF-byte SHA-256 remains in the archive.

The renderer reads only frozen inputs and bundled fonts, never current crew,
nationality, form configuration or tenant branding.

## Downloadable samples

| Sample | Pages | Frozen document reference | Exact file SHA-256 |
|---|---:|---|---|
| Logo | 5 | CF-2026-000001 | `66c297bb3ce1a7047ee1bbdba895ce6c96970cfade124f449b2b328b2c934599` |
| Company-name fallback | 5 | CF-2026-000002 | `6c1f492cd4282e46213dff4126b235c89d5eeca45aff1081ed08ddc512117248` |

Delivered files: `generated-artifacts/company-pdf-layout/revised-sample-logo.pdf`
and `revised-sample-company-name.pdf`. Both remain registered, fixture-vessel-only
forms covering all three signature types, witnessing, missing rank and a long answer.
The fallback sample's nationality was absent at signing and correctly remains
“Not recorded”. The logo sample retains its fixture's recorded nationality.

The original two archived files and their complete frozen records were compared
before and after the revision and are unchanged. They are retained in the
manifest under `priorSamples`. The new completions reuse the same fixture crew,
vessel and assignments. Normal verification creates no new fixtures on each run.

These are deliberately new sample records because the originals did not freeze
the newly requested facts. No header backfill or archive overwrite was performed.

## Read-only answers

### Backlog while generation is disabled

At review there is **one completed form with a persisted PENDING preparation
request and a frozen snapshot, but no PDF**. Four other completed records have
PDFs: the original and revised fixture pairs.

Automatic generation for every disabled-period completion is **not yet
implemented/guaranteed**: the worker currently selects only registered samples,
and `prepareDocument` rejects real forms. Merely changing the disabled constant
would not implement a real-form backlog drain. A later approved rollout must
explicitly process eligible persisted requests, per tenant, using their frozen
snapshots and never live profile data.

The one older pending snapshot predates the new document-reference/header facts.
It has no newly frozen document reference. No new fact was inserted into it.
Records without authoritative frozen evidence cannot be reconstructed safely
from current data; rollout must state how those are handled.

### Excel-template test at the two final commits

- #411, final HEAD `62ad8e49`: the Excel-template generation test **passed in
  27,876 ms**. Full suite: 1,256 passed, 162 failed, 67 pending.
- #412, final HEAD `66ebc0c0`: the same test **timed out at 39,340 ms**, with
  the unchanged 30,000 ms limit. Full suite: 1,260 passed, 163 failed, 67 pending.
- Source of this read-only comparison:
  `test-logs/company-form-evidence-full-suite.log` and
  `test-logs/pdf-full-suite-final.log`. Neither the test source nor the production
  Excel-template generator changed between those two final commits.

## Verification

- Company Forms: **529 passed, zero skipped**, 89 files.
- TypeScript: **222 diagnostics**, within the approved limit.
- Full-suite result for this revision is recorded separately in
  `test-logs/pdf-layout-revision-full.log` and
  `generated-artifacts/company-pdf-layout/revised-full-suite.json`.
- API/SQL regression: Crew ID, nationality and reference are frozen at first
  signature, remain identical after the live crew ID/nationality changes, and are
  unchanged at completion; a separate form receives a different reference.
- `PYTHONPATH=generated-artifacts/pdf-tools python scripts/verify-company-pdf-layout-files.py`
  validates every page's running header, reference, fingerprint, page count,
  frozen first-page facts, numbering, signature labels, dates and logo/fallback.
  First, middle and signature pages are rendered for visual inspection.
- `node scripts/verify-company-pdf-layout-preview.mjs --closing` downloads the
  stored bytes through the actual screen and verifies Print copy and handover.
  It checks final commit/backend times and accepts only registered archive rows,
  including the retained original samples.

All generated outputs are outside Git and deployment packaging. No email code,
real-form generation switch or real-form backlog processing was added.
