# Company Form version applicability foundation

This slice stores and freezes policy. It does **not** implement dimension
validation, a rule editor, requirement records, resolution, retrospective
declarations, stage gating, or changes to Standard Forms.

## Stored contract

Each Company version has exactly one policy:

- `manual_only`: no obligation or effective-date fields.
- `all`: mandatory/optional, with an automatic effective date.
- `conditional`: the same automatic fields plus generic condition sets.
  Conditions within a set are AND; sets are OR. The identifiers are stable on
  draft updates. New children and copied children get server-generated UUIDs.
  No dimension has its own column.

Automatic dates default to `on_release`. The database assigns the UTC release
timestamp and its calendar date. A `specific_date` must be on or after that
actual release date, not the author-entered version date. An earlier date is
refused at release with the non-retrospective reason. Resolved dates are not
copied into drafts.

All versions present at upgrade, including historical/deleted/archived
Company versions, received a physical `manual_only` row. No declaration or
requirement was created. Existing versions without historical release
comparisons show **Legacy — change history unavailable**; history is not
fabricated.

## Authoring API

Existing Forms Configuration permission guards remain in use:

- `GET /api/v2/admin/form-versions/:id/applicability`: Forms/view.
- `PUT /api/v2/admin/form-versions/:id/applicability`: Forms/edit, draft only.

Minimal write examples:

```json
{"mode":"manual_only"}
```

```json
{"mode":"all","obligation":"mandatory"}
```

```json
{"mode":"all","obligation":"optional","effectiveKind":"specific_date","specificDate":"2099-01-01"}
```

```json
{"mode":"conditional","obligation":"mandatory","sets":[{"conditions":[{"dimensionKey":"rank","operator":"in","value":["parent-master-uuid"]}]}]}
```

Conditional drafts are opaque stored data, **not validated rules**. Neither
the API nor SQL permits conditional release until the dimension slice supplies
trusted validation. A browser readiness flag cannot enable release.

Do not send the read DTO back wholesale: ownership, provenance and resolved
fields are server-managed. On updates, send existing set/condition UUIDs only
for their actual owning version/set; omit UUIDs for new children. Reusing a
draft through the existing create-version endpoint does not reset its policy.

Company release accepts an empty body. Actor, time, comparison flags and
previous-version provenance are derived by the server, under the form/version
locks. Policy writes and release serialize on the same locks. SQL guards also
protect frozen policy, release time and comparison records.

## Release comparison and display

Release compares against the previous released version of the same form.
Canonical content includes the real active parts, sections, questions,
option sets/options, configuration, shared configuration, layout, validation
and signing/responsibility settings. Internal clone UUIDs and audit/version
metadata are excluded from semantic differences. Canonical policy excludes
clone UUIDs and the server-resolved on-release date.

Company version-list labels distinguish initial release, no change,
content-only, applicability-only and both. Signing-only differences have the
explicit **Signing configuration changed** detail, not a wording-change label.
Signing projections are compared by stable paths, not JSON object traversal
order. Unchanged and applicability-only releases have no signing-change detail.
Released comparison snapshots are frozen; legacy comparison history stays
unknown until an actual new release supplies a comparison.

## Verification

- `tests/integration/api/company-form-applicability.test.ts` exercises stored
  defaults, strict writes, owner isolation, stable identifiers, independent
  copying, release/date refusals, SQL guards, all comparison cases, archive
  protection and release-versus-write concurrency.
- Conditional versions cannot be released yet. The released-source API copy
  test uses an automatic-all policy. The independent condition-identifier
  test invokes the **same copy routine on draft data**, without weakening the
  release guard or claiming a released conditional source exists.
- `node scripts/verify-company-forms-tests.mjs` discovers the complete Company
  Forms/submission area and fails on any skipped/pending/todo test.
- The complete repository run used
  `npx vitest run --no-file-parallelism`; every configured file ran. Serial
  execution avoids shared-database and resource-pressure interference.
- Acceptance results before the closing commit: Company area **391 passed,
  zero skipped**; full repository **161 failed / 1112 passed / 67 pending**;
  TypeScript **222 diagnostics**, with no increased file/error-code bucket.
  The full repository and compiler are **not green**; these are the agreed
  ceilings, not a claim that inherited failures were fixed.

## Closing main-preview protocol

Commit this collector, restart the existing **Start application** workflow,
then run `node scripts/verify-company-form-applicability.mjs`.

The collector refuses closing evidence if the backend started before HEAD,
uses the managed main preview rather than a duplicate server, and checks HEAD
and backend PID remained unchanged. It captures authenticated development API
responses, raw SQL and browser screenshots of the version list and existing
manual sign-off picker. It uses the existing development persona mechanism;
it neither changes authentication nor claims production-authentication proof.

Output is in ignored `.local/verification/company-applicability/`. The
collector never starts a declaration. Its separately labelled temporary
synthetic historical crew/assignment is removed after capture. No retained
assignment, declaration or signature is changed. Its definition fixture is
archived after closing capture so it does not remain in operational pickers.
The final report includes HEAD, commit time, backend PID/start time and the
closing API/SQL/UI checks.
