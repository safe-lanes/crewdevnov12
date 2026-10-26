# Pre-joining Training Matrix — approved slice 2 build plan

**Approved, including canonical inputs before equivalents.**

## Step 0 — canonical linked-assignment inputs

The exact-linked-assignment endpoint returns only the contract rank captured at
Deploy and the reliever's own planned joining date and contract range-end months.
Missing values are explicitly absent; no present-rank/name matching, shared
planning values or incumbent values may replace them. The popup uses those
canonical inputs. Regression evidence includes blank reliever values alongside
populated incumbent values. Commit and report HEAD before equivalents.

## Goal and boundary

Add identifier-based accepted equivalent courses to the existing Admin Training
Matrix policy. Retain the existing vessel/rank scope and Mandatory/Recommended
requirements. No course or rank is matched by display name.

This slice does not build the compliance calculator, change current Vessel dots,
add the Reliever Status compliance window, create Training Needs, freeze checklist
snapshots or enforce the checklist gate. Those remain later slices.
The separate **Override training compliance** permission remains default off and
will be implemented with the later checklist slice, not conflated with
**Override checklist**.

## Step 1 — policy data and compatibility

- Add an idempotent, additive migration for explicit links from a required
  master course to accepted alternative master courses.
- Scope these links to the relevant matrix policy; preserve them in its saved
  vessel revision so later edits cannot reinterpret an older revision.
- Retain existing vessel/rank requirements, statuses and revision identifiers.
  Existing revisions with no equivalents mean direct-course matching only.
- Do not relink free-text D3 entries, infer equivalence from names, copy real
  crew data or rewrite existing matrix history.
- Commit and report HEAD.

## Step 2 — server validation and permissions

- Read/save the policy through the existing matrix authoring boundary, tenant
  scope and server-derived audit identity.
- Accept only existing active master course identifiers. Reject self-links,
  duplicates and missing/deleted course references with plain explanations.
- Equivalence is explicit, directional and non-transitive: accepting B for A
  neither accepts A for B nor accepts C for A merely because B accepts C.
- Matrix edits belong to a draft/new revision; saved historical revisions retain
  the links they recorded.
- Commit and report HEAD.

## Step 3 — Admin authoring

- Add “Also satisfied by” beside the required course, selecting one or more
  courses from a searchable master list.
- Show course names to authors, but save master identifiers only; no free text.
- Preserve Mandatory/Recommended rank cells and the existing draft/revision
  workflow. View-only users can inspect but cannot alter equivalents.
- No changes to the approved Reliever Status mock-up in this slice.
- Commit and report HEAD.

## Step 4 — isolated verification

- Use only the registered test database for automated migration/API/UI tests.
- Prove save/reload and revision copying, independent tenant scope, denied
  writes without authoring rights, and rejected invalid references.
- Demonstrate A accepts B, while reverse and transitive relationships are absent
  unless explicitly configured. Prove an older revision remains unchanged.
- Main-preview demonstration reuses a registered fixture-only vessel/draft;
  no real vessel policy or seafarer certificate is changed. Register any
  deliberately added acceptance fixture and reuse it on reruns.
- Commit and report HEAD.

## Step 5 — closing evidence

- Show the Admin matrix rule saved and reopened, and an older revision retaining
  its original policy. Report the actual API and SQL evidence.
- Full suite: at most 162 failures and 67 pending; Company Forms: zero skipped;
  TypeScript: at most 222 diagnostics. Report actual results, not target numbers.
- Final main backend start must be later than the final commit.
- Commit and report HEAD, then stop before the next slice.

Build evidence: [slice 2 implementation and closing record](pre-joining-training-matrix-slice-2-evidence.md).
