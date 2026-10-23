# Company Forms: existing validation detail

## Scope

Presentation only. No server validator, schema, validation rule, error-collection
behaviour, migration or save/release transaction has changed.

Company Form draft saves and release refusals now use a persistent alert containing
one list item per returned problem. The toast points to that list rather than
being the only place to read the failure. Applicability saves use the same list.
Standard Forms retain their existing presentation.

## Coverage

| Category | Existing producer / previous loss | Presentation now |
| --- | --- | --- |
| Detail returned, then discarded | `formStructureController.ts` returns schema issues in `details`, including paths through parts, sections and points. `companyFormErrors.ts` previously selected an allowlisted code/message or its generic action fallback. | Every returned issue is retained, in server order. Paths become visible part/section/point labels, using the editor's numbering. Unnumbered System Fields and Content use those labels and their wording. |
| Detail returned, then discarded | Structure service/repository business refusals: unavailable references, duplicate entries, incompatible settings, safe content, draft-only editing and archived forms. | Known technical wording is translated; available references are resolved to visible entries. A reference that cannot be resolved directs the author to the form's structure/parts rather than exposing the identifier. New, readable plain-language explanations are not discarded merely because they are absent from an allowlist. |
| Detail returned, but joined | `formsService.ts` joins the already-collected `validateCompanyFormLifecycle` explanations into one `error` string. | Each `Section "..."` explanation gets its own list item. Corrective sentences belonging to that explanation stay together. Existing semicolon-separated explanations are also separated. |
| Detail never produced | `validatePersistedCompanyFormStructure` can return only `Invalid form structure`; it does not attach its schema issues. | This remains an honest generic fallback. No location or underlying problem is invented. |
| Detail never produced | Reference, uniqueness, content and applicability checks that throw on the first refusal; later checks never run. | Only what actually came back is shown. This change does not continue those validators, run extra checks, or manufacture the failures that might follow. |
| Detail never produced | Unexpected server exceptions, network failures or responses without an explanation. | The existing plain action-specific fallback remains. |

`companyFormValidation.ts` is a presentation adapter, not a validator. It translates
field names/type diagnostics, resolves references supplied by the caller, and splits
already-returned explanations. It does not inspect the draft to decide whether it
is valid.

## Remaining fallback and location limitations

- Save: “Form settings could not be saved. Check the draft and try again.”
- Release: “This form version could not be released. Review the draft requirements
  and try again.”
- These remain for unexpected HTTP 5xx failures, empty/unusable responses, network
  failures, `Invalid form structure` without issues, and technical diagnostics
  with no safely recoverable user-facing explanation.
- Authentication and permission failures retain their specific sign-in/permission
  guidance.
- A returned schema issue is shown even when its message is unfamiliar: its known
  position and readable field receive a review instruction rather than raw
  technical text.
- A release refusal without a position cannot honestly be assigned a particular
  point. An unknown reference cannot honestly be given a display name. The UI
  directs the author to the relevant form settings/structure; it never prints
  database columns, codes or raw UUIDs as a substitute.
- Raw SQL, constraints, stack traces and unknown internal diagnostics cannot be
  made into a reliable specific explanation using the information returned today.
  They are not echoed. Producing more precise server detail is outside this task.

## Evidence

`scripts/verify-company-form-validation.mjs` reuses registered PDF fixture form
5301/version 7457. It uses the Crewing Executive development persona and blocks
every API mutation. It presents the released fixture as a draft **in the browser
only**, then injects controlled refusal responses:

1. Failed save: the existing draft schema supplies three issues, all displayed
   separately with section/point/System Field locations.
2. Failed release: the existing lifecycle validator supplies two explanations,
   displayed separately with the section's name and number.
3. Fallback: a controlled HTTP 500 response displays the existing plain fallback.

This proves response presentation through the main-preview editor. It is not
evidence that the live released fixture was edited or released, and it does not
claim parent-authenticated production verification. There were no unexpected
browser errors or unhandled mutation attempts. Generic save/release wording is
absent in both detailed-refusal screenshots.

Outputs (ignored, outside tracked source):

- `.local/verification/company-form-validation/failed-save.jpg`
- `.local/verification/company-form-validation/failed-release.jpg`
- `.local/verification/company-form-validation/fallback.jpg`
- `.local/verification/company-form-validation/report.json`

Automated regression coverage includes preserving all issue details, readable
paths/references/type diagnostics, splitting joined lifecycle explanations,
retaining unfamiliar readable explanations, suppressing raw diagnostics,
fallbacks, and persistent editor lists for save/release/fallback responses.
