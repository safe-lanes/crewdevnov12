# Company Form void-copy verification

## Delivered policy

Voiding preserves the canonical PDF and signed frozen evidence. Database
triggers capture an immutable notice in the void transaction, using recorded
voiding identity, designation, time and reason, not today's user details.
Historical missing values remain “Not recorded”. Replacement linking appends a
new revision. If the original PDF was not ready at voiding, preparation still
uses the completion snapshot; its eventual file hash is recorded in a further
notice revision before an annotated file is published.

Normal authorized downloads and printing serialize with void/replacement using
assignment-first then submission locks. A voided form serves its stored
annotated derivative with `Cache-Control: private, no-store`, never the
unannotated original. Rendering is lazy; ordinary startup loads no PDF renderer.
Publication is atomic and idempotent per notice revision. Original and
annotated byte hashes are independently checked and labelled.

Original and void-notice physical handovers have separate immutable records.
Fill in is checked again under the assignment lock; actor, role and time come
from the server. The request accepts only the expected current fingerprint.
An original or superseded derivative cannot be recorded as the current notice
handover. A later replacement revision does not inherit an earlier handover.

## Registered main-preview evidence

See `docs/company-form-regression-fixtures.md` and
`docs/company-forms/pdf-rollout-fixtures.json`, `voidCopyEvidence`.

* Crew Pool → existing fixture seafarer with employee ID
  **TEST-JOINING-DECL-REGRESSION** → G3 forms → the assignment on
  **TEST ONLY PDF layout review** → **TEST ONLY Approved PDF automatic rollout**.
* Document reference **CF-2026-000005**.
* Through the screen: recorded original-copy handover, entered a written reason
  and voided the form, saw the outstanding-notice reminder, then clicked
  **Void notice handed to seafarer** and confirmed. Server responses were
  201, 204 and 201 respectively.
* No role initially held Void completed. The existing preview role received a
  temporary grant through the normal audited Access Control API. Its prior
  false value was restored before notice handover; that action used Fill in.
  No grant, actor identity, timestamp or form status was manufactured by SQL.
* Original file SHA-256:
  `c83da9129897cbdafe4aff53d3a2b212cb52b09a4a4fc62bbbb51a072cac77eb`.
* Annotated file SHA-256:
  `c6fac05a7c4e5351322aa260fc02e0d3bace3dc469ddf1d1a36c074f08b67f3a`.
* Void-notice handover: **Jeevan Naik**, **20-Oct-2026 10:36 UTC**,
  exact annotated file fingerprint above. Both the open form and G3 display it.
* Original file row/bytes and full completion snapshot compared unchanged.
  Original page text and rendered pixels also compared equal with PyMuPDF.
  Notice page visually checked; it states “No replacement yet”.
* Download clicked and bytes compared with the annotated archive; Print clicked
  and opened those stored bytes. No PDF retry/preparation API was used to
  manufacture this browser result.

The first browser pass found cached PDF status after voiding. The lifecycle
refresh now invalidates PDF status and G3 after lifecycle writes; handover
invalidates G3 too. Later script passes corrected selectors to the actual
**Print void notice copy** and **Void notice copy handed to seafarer** labels;
they did not create another fixture or handover. Initial evidence retains the
earlier attempts honestly.

## Repeatable verification and evidence

`node scripts/verify-company-void-copy.mjs` reuses the registered fixture,
does not create definitions or crew, and refuses a different database identity.
`--closing` performs only read/download/print checks and requires the main
backend process start to be later than HEAD. Both modes preserve HEAD and the
main PID throughout the browser pass.

Ignored generated evidence:
`generated-artifacts/company-void-copy/initial-evidence.json`,
`closing-evidence.json`, `reminder-before-handover.jpg`,
`handover-recorded.jpg`, `closing-void-copy-controls.jpg`,
`closing-g3-handover.jpg`, and `fixture-void-copy.pdf`.
The anonymous screenshot cannot authenticate; authenticated browser automation,
not that screenshot, verifies the signed-in screen.

Automated coverage lives in the isolated registered test database:

* `company-form-document-void-copy.test.ts`: void/download race, repeated and
  concurrent preparation, exact stored bytes, unchanged original/snapshot,
  later required replacement, preserved previous notice/file, current-notice
  handover invalidation, void-before-PDF, raw SQL immutability, forged browser
  audit identity refusal, stale fingerprint refusal, View without Fill in,
  and out-of-vessel refusals.
* `company-form-document-void-renderer.test.ts`: long multi-page notices,
  missing historical facts and unchanged input bytes.
* `company-form-void-handover-presentation.test.tsx`: exact reminder, confirm
  and cancel, permission visibility, annotated fingerprint only, cleared
  reminder after current handover.
* Existing renderer contract and PDF integration assertions remain intact.

Gate results are recorded in the final completion report and raw
`generated-artifacts/company-void-copy/full-suite.json`,
`company-forms-gate.json`, plus `test-logs/company-void-copy-typescript.log`.
No assertion, existing timeout or failure threshold was weakened.

## Email boundary

`docs/company-forms/email-specification.md` is the parent-developer handover
only. Email is not implemented or enabled. It includes the separate void-notice
delivery case and explicitly forbids treating email delivery as physical handover.
