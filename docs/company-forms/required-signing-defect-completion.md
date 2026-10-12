# Required Company Form signing defect

## Investigation before production changes

The reported SL01 Pre-Joining Declaration v01 was released, mandatory, applies to
all, before joining. Its affected form remained REQUIRED / in progress, with the
Company Representative signature present. Investigation did not edit that form,
its released definition, its requirement, or its assignment.

The original request's stack trace had aged out of the main workflow's retained
scrollback. The available captured log began after that request and explicitly
reported truncation. The historical trace cannot be reported as recovered.

A read-only invocation of the same seafarer identity resolver against that
assignment reproduced this trace on the pre-fix source:

```text
Error: The readable rank name cannot be resolved uniquely.
    at resolveCrewSystemField (server/v2/company-forms/subjects/crewAssignmentSubject.ts:232:37)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async Promise.all (index 1)
    at async Object.resolveIdentity (server/v2/company-forms/subjects/crewAssignmentSubject.ts:513:32)
```

Those line numbers refer to the pre-fix source, not the longer corrected file.
The affected crew record stored the valid master display label `Pumpman`. The
old query compared it only with company rank IDs, found zero rows, and threw an
unexpected Error. The Company Representative uses the authenticated staff
identity, whereas a witnessed seafarer signature resolves the represented
seafarer's name and rank. This explains why the first signature could succeed
and the witnessed signature fail.

The reported original Submit 500 cannot independently be attributed to a
historical stack that is no longer retained. The corrected, exact released
SL01 definition was exercised through both signatures, draft flushes and Submit
in the main preview; all those writes succeeded and the requirement completed.

## Correction and regression coverage

- Rank display/signing resolves eligible company IDs/UUIDs and eligible base
  master IDs/UUIDs or imported labels. Missing or ambiguous matches are refused,
  never guessed or echoed as a signature identity.
- An unresolved rank produces HTTP 400 with server code `RANK_NOT_ELIGIBLE` and
  administrator guidance, not an unexpected server error.
- The required-form API regression starts its pinned requirement, saves the
  Company Representative first, saves the witnessed seafarer second, submits,
  and checks both the form and requirement completion.
- A second API regression verifies an unknown rank returns actionable validation
  and does not satisfy the requirement or persist a seafarer signature.
- Readable-rank tests cover IDs, imported labels, base UUIDs and ambiguity.
- Company Forms errors pass through safe, action-specific presentation.
  Unknown HTTP bodies, SQL text, stacks, identifiers and untrusted messages
  are not displayed. Known permission, rank, applicability/date and fact
  refusals use allowlisted plain guidance. Standard Forms retain their behavior.
- Existing UI regression assertions were changed from requiring raw HTTP/errors
  to requiring actionable sentences and explicitly excluding raw strings.
  Draft ordering, signature failure state, void/replacement and retry-permission
  assertions remain in place.

## Why the previous stage-closing evidence missed this

The stage evidence checked deployment/sign-on/relief/sign-off resolution and
operational requirement presentation. It did not click through a REQUIRED
form's representative → witnessed seafarer → Submit journey. Existing lifecycle
signing fixtures deliberately used normalized rank IDs; they did not exercise
the supported imported label stored in this crew record. A green area suite
therefore did not cover this combination. The new regression fills that gap.

## Main-preview evidence and retained fixtures

The successful screen journey used test-owned synthetic subjects and the actual
released SL01 v01 definition, without changing it. Both signatures and Submit
were clicked through the screen, not performed by an API script. The browser
record includes the resulting HTTP 201/201/200 responses, draft flushes, saved
signature evidence, and the visible Completed requirement. SQL independently
confirmed the exact requirement/submission link, both persisted signatures and
the authenticated witness.

All test roots and descendants, including failed verification attempts, remain
in place and are registered in `docs/company-form-regression-fixtures.md`.
New automated signing-rule fixtures are limited to their test-owned vessel;
they do not introduce another rule applying to ordinary crews.

Evidence is retained under `.local/verification/required-signing/`:

- `initial-evidence.json`: clicked-through signing and submission.
- `closing-evidence.json`: final HEAD, commit time, backend PID/start time,
  completed requirement and both signatures reopened through the screen.
- `full-suite-certified.json` and `gates-final.json`: full and complete Company
  Forms-area results, with skipped/missing Company Forms cases rejected.
- `typescript-final.log` and `build-final.log`: final compiler/build checks.
- `officer-saved.jpg`, `seafarer-saved.jpg`, `submitted.jpg`,
  `closing-completed.jpg`, `closing-signed-form.jpg`: screen captures.

Closing verification requires the backend start to be later than the final
commit, and requires HEAD and backend PID to remain stable during the browser
check. The original seafarer's form remains available for the user to finish;
the agent did not sign or submit it on their behalf.

## Standing gates

The certified full-project run includes the entire discovered Company Forms
area, not a selected subset:

- Company Forms: **79 suites, 484 passed, zero failed, zero skipped**; no
  missing or empty suites.
- Full project: **1,207 passed, 161 failed, 67 pending** out of 1,435 tests.
  The non-Company failures/pending cases remain within the agreed ceiling;
  this is not a claim that the entire project is green.
- TypeScript: **222 diagnostics**, within the agreed ceiling.
- Production build: **passed**.

Earlier failed validation attempts are retained separately. Obsolete assertions
expecting raw errors were corrected; the final certified run was then executed
against the settled source. Exact final commit and backend times are reported
by the closing evidence, after commit and restart.
