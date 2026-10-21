# Slice 4 — presentation adjustments for review

## Scope and steps

Calculation remains **1.2.0**. No changes to matching, states, dates,
selection, permissions, saved facts or enforcement.

1. Add display-only matrix category/order metadata to the authorized read API.
   Test the result against the unchanged calculation, including compliant rows
   and before/after database fingerprints.
2. Adjust the details presentation and add UI regression coverage.
3. Reuse the registered fixture for the four clicked main-preview cases;
   register the scenarios and verification tooling.
4. Run the standing gates, commit the closing report, restart the main backend
   after that commit, and repeat the closing browser evidence.

Each step is committed separately and its HEAD reported.

## Comparison with the supplied mock-up

The previous component mapped **all** returned calculation courses; there was
no problems-only filter. The fixture's rank had only two requirements, which
made the previous evidence inadequate for reviewing a fuller matrix.
Category headings were missing and ordering followed company-row database IDs:
both are corrected here. Compliant rows are explicitly covered by tests and
browser evidence, not assumed from the implementation.

Other visible differences, retained and disclosed for review:

- The window has a fixed title plus an assignment context block instead of
  only the mock-up's seafarer/rank heading. It includes the captured rank,
  own planned joining/contract end, vessel and matrix revision, to explain
  exactly what is being checked.
- Status uses written, coloured badges rather than dots alone. This makes
  Not held and incomplete checks explicit and does not rely on colour.
- A certificate's name/number and whether it is an equivalent appear beneath
  Status. The Rank requirement column states Mandatory or Recommended.
- The mock-up's separate company course-code column is absent; the approved
  six columns remain Course, Rank requirement, Status, Issued, Expiry and
  Attachment. Course names are shown. This omission is disclosed, not
  presented as matching the mock-up.
- Attachments are filename buttons opened through the authenticated serving
  route, rather than a bare attachment icon. Missing files are not invented.
- Assignment/calculation notes, missing-fact explanations and Retry are
  explicit. A calculation-version and saved-date note appears below the table.
- Expandable evidence shows candidate certificates, the selection explanation,
  equivalents and correction flags. Arrows are now limited to rows with
  additional evidence; the expanded content does not repeat the course status.
- The action-only switch is a new user-requested addition, OFF by default.

Removed differences: missing category headings, database-ID ordering,
duplicated Mandatory/Recommended labels beneath course names, unconditional
expand arrows, repeated Not held text in empty expanded rows, and
misleading All clear (0) for complete checks with no courses in that group.

## Step 1 verification

The endpoint supplies category headings from the existing company training
group code/label and order from the same group-code/course-sort order used by
Vessel > Training Matrix. Only courses applicable in the selected saved
revision and the captured rank are considered for layout metadata. Courses
without a group use the matrix's **Unassigned** heading.

The calculator, reader, calculation inputs and version are unchanged.
The integration regression strips only display metadata and certificate
evidence from the API result and compares the remaining result with the
unchanged calculation. It also verifies compliant and noncompliant rows and
unchanged table fingerprints. **32 tests passed.**

## Step 2 verification

The action-only switch is OFF each time Details opens. When ON it retains
gaps, during-contract expiry warnings, incomplete courses and certificate
correction flags; a valid equivalent by itself does not need action.
Category headings remain in matrix order and empty categories disappear
only from the filtered view. No filter causes an API write or recalculation.

Every base row keeps its course, single Rank requirement label, state,
chosen certificate, issue/expiry dates and attachment. Expansion is limited
to multiple certificates, a selected equivalent, or correction flags.
It explains selection and excluded candidates without repeating course status.
A complete zero-count group says **None required for this rank**; incomplete
results do not claim that no courses are required.

**17 focused UI tests passed**, including the original five-state, failed
request, missing-fact and stale-cache regressions.

## Step 3 — registered browser evidence

`node scripts/verify-training-compliance-presentation.mjs` uses the existing
Crewing Manager development persona and exact registered fixture from
[the manifest](training-compliance-slice-4-fixtures.json). No records, matrix
rules or grants are added. It clicks the real main-preview Planning screen;
no compliance API calls or supplied response data substitute for the UI.
Only PATCHes to the one registered fixture plan are allowed.

Four screenshots:

1. **All course states compliant**: joining 01-Jan-2028 / 6 months. Both
   requirements appear under **A. Statutory**, in the same order as the matrix,
   with the filter OFF. Both are Valid, no expiry. The older malformed-issue
   certificate's correction flag remains disclosed; this is not a claim that
   every historical certificate is free of corrections.
2. **Mixed / expandable**: joining 01-May-2027 / 6 months. AFF is Valid,
   chemical tanker is Not held. AFF expansion shows the chosen longer
   certificate, shorter alternative and future-issued equivalent, with the
   selection explanation and correction flag, without duplicating status.
3. **Switch ON**: in the all-compliant-state scenario the unflagged
   chemical-tanker row is hidden; AFF remains because of its correction flag.
   This proves filtering actually changes the list, not merely the switch.
4. **No recommended courses**: the rank has two mandatory requirements and
   zero recommended ones; Reliever Status uses the exact requested sentence.

The retained fixture is restored to **01-May-2027 / 6 months**. The first
draft replay caught a verification selector matching the closing Details
dialog as well as the summary line. Waiting for the close animation and
scoping the selector fixed the verifier, not the application. The successful
replay produced all four cases with no page errors.

`--draft` is explicitly non-closing evidence. The final run without that flag
requires a backend newer than HEAD and unchanged HEAD/listening PID throughout.
`node scripts/build-training-compliance-presentation-gallery.mjs` refuses to
deliver a gallery from a draft or failed run.
