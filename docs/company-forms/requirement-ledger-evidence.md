# Company Form requirement ledger — closing evidence

## Delivered boundary

- Resolution checks (including successful checks matching nothing and failed checks), pinned requirements, and append-only before/after transition history are persisted.
- The five statuses are OUTSTANDING, STARTED, COMPLETED, UNRESOLVED and WITHDRAWN. Only COMPLETED satisfies a requirement.
- A required start takes its form/version from the server-side requirement, under the assignment lock. It cannot replace its pin with a newer release or accept a browser-supplied actor or version.
- Manual forms remain MANUAL and never acquire a requirement link. There is still one non-voided form per form definition and assignment, not separate manual and required slots.
- Existing manual forms are retained when a test resolution subsequently requires that form. The UI explains the collision and opens the existing form; an authorised explicit void with a reason is needed before a required replacement.
- Completion, void and replacement update the requirement and append its history atomically. A voided required form never satisfies the requirement; replacement retains the original pin and requirement.
- Rechecking keeps started/completed pins, supports a resolved recheck of an unresolved same-version requirement, and records the deciding run. Withdrawal of an unstarted requirement retains its history.
- Cancelled assignments have no active outstanding requirements or start action; their stored requirements and form history remain readable.

## Verified current-contract backfill

The upgrade considered 115 current assignments with missing history flags. It filled **33 missing first-ever values** and **27 missing first-in-rank values**; **27 assignments had both missing values verified**. Eight first-ever values already captured were preserved, not counted as fills.

**88 assignments remained unresolved for at least one missing flag:** 74 had no exact current company-service row; 14 lacked a captured contract rank. The persistent upgrade report contains the per-assignment reasons.

Current company service is identified exclusively by the same seafarer, vessel, company-service marker and sign-on date, with exactly one matching row. Prior company service includes relief service; the current row is excluded. The verified-backfill provenance is separate from capture at sign-on. Original captures are not rewritten.

## Operational presentation

Requirements and their history appear in G3 and the existing stage popups. G3 uses captured **Contract rank**. **Form rule facts** require an explicit Forms/view authoring grant in both the UI and API; the UI does not expose internal keys, provenance JSON, kind fields, table names or identifiers.

Interface-owned Company Form copy says “form”, including date and reciprocal-history labels. Authored form names/content, stable API/database identifiers and Standard Forms are not renamed.

## Deferred work

No production stage trigger or matching engine is switched on here. Item 28's stage-readiness enforcement belongs to the trigger/go-live work; existing manual starts do not require a recorded stage run. Item 30 is recorded in the requirements document. The rule editor, Checklist gate and reports are not delivered by this ledger work.

Resolution evidence is created through the retained test harness, not through a new browser resolution-write route. Every new fixture is registered in `docs/company-form-regression-fixtures.md`; no fixture is hard-deleted.

## Reproducible proof

- Complete Company Forms gate: `node scripts/verify-company-forms-tests.mjs` — **70 suites / 424 tests passed / zero skipped**.
- Full serial suite — **1,147 passed / 161 failed / 67 pending / 1,375 total**, within the agreed failure and pending budgets; not a green full-suite claim.
- Final TypeScript check — **222 diagnostics**, within the agreed budget.
- Read-only closing facts collector: `node scripts/verify-company-form-dimensions.mjs`.
- Read-only closing ledger and pinned-form collector: `node scripts/verify-company-form-requirements.mjs`.
- Both closing collectors require unchanged HEAD/PID and a backend start strictly later than the final commit. They do not create fixtures or update the registry.
- Ignored receipts, raw SQL snapshots, API bodies and signed-in main-preview captures are retained under `.local/verification/`.
