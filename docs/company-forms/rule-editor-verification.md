# Company Form rule editor verification

## Scope

Applicability belongs beside the version's stage selector, under explicit Forms
authoring rights. Each version exposes the three policy modes. Automatic modes
state mandatory/optional and on-release/specific-date timing. AND condition cards
are joined by OR; their summary states obligation, timing and who applies.
Owner and flag remain unavailable until parent master data exists.

Assignment trials evaluate the displayed, potentially unsaved policy against
trusted, scoped facts. They do not save policies, capture facts, create runs,
requirements or operational forms, or open stages. A condition match is explicitly
hypothetical, not permission to apply a new rule retrospectively. Missing on-board
joining-history captures remain unresolved.

Released controls are frozen. Release is blocked while policy or stage saves are
pending or policy is dirty. Save-and-continue saves content and policy and stops
on failure. Backend release validates current master eligibility and actual
release-date bounds; refusals contain plain explanations, not internal IDs.

No stage triggers, go-live enforcement, import repairs or Checklist changes were
introduced. Standard Forms are unchanged.

## Standing gates

- Company Forms area: **75 suites, 453 tests passed, zero skipped**.
- Full serial suite: **1,176 passed, 161 failed, 67 pending; 1,404 total**.
  This meets the accepted ceilings; the full suite is **not green**.
- TypeScript: **222 diagnostics**, within the accepted ceiling; not zero errors.
- Frontend production build passed.

Reports live under `.local/verification/`. The Company Forms gate records its
discovered inventory and rejects skipped/pending tests. The full-suite JSON is
`company-rule-editor-full.json`; compiler output is
`company-rule-editor-typescript.txt`.

## Browser, API and SQL evidence

The initial main-preview browser journey built two cards through the screen,
saved the rule, read its complete summary, tried retained seafarers with different
outcomes, released it and inspected read-only controls. SQL confirmed conditional,
mandatory, on-release policy with two sets. Trial snapshots show unchanged run,
requirement, transition-history and operational-form counts.

API tests cover unsaved trials, missing facts, strict rejection of browser-supplied
facts/identity, unavailable dimensions and values, date refusal, released-policy
write refusal, independent copy identities, and explicit authoring authorization.
Scope tests cover trusted Office, assigned vessel and linked-seafarer narrowing.

Run `node scripts/verify-company-form-rule-editor.mjs --initial` only for approved
fixture preparation; it registers retained identities and prepares a copied draft.
The closing run without that flag uses those already-registered identities,
edits their values through the screen, trials both seafarers and releases the rule.
It creates no new fixture identities and never edits the registry or source.
It requires backend start **strictly later than HEAD's commit**, then verifies
unchanged HEAD and backend PID across the journey. Its output and screenshots are
stored in `.local/verification/company-form-rule-editor/closing.json` and
`closing-*.jpg`.

All fixtures, including interrupted setup and copied question/condition identities,
are retained in `docs/company-form-regression-fixtures.md`. Neither harness
hard-deletes crew, assignments, history or definitions.
