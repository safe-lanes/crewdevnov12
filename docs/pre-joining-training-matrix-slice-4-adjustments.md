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
