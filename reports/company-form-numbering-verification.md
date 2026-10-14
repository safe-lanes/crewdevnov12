# Company Form display-numbering verification — 28 September 2026

## Browser evidence

Browser navigation used an Office test actor in the development app. Screenshots:

- [Test Form, first part before reorder](../screenshots/task338-company-before-part1.png): navigation and heading show `1 · MISSION STATEMENT Acknowledgement`, second navigation entry `2 · SEAFARERS’ PRE-EMPLOYMENT DECLARATION - POLICIES`.
- [Test Form, second part before reorder](../screenshots/task338-company-before-part2.png): second part heading and navigation.
- [Test Form after moving first part down](../screenshots/task338-company-after-reorder.png): navigation and heading change to `1 · SEAFARERS’ PRE-EMPLOYMENT DECLARATION - POLICIES`, `2 · MISSION STATEMENT Acknowledgement`.
- [Preview after reorder](../screenshots/task338-company-preview.png): the same new part numbering appears in Preview.
- [Standard Form editor](../screenshots/task338-standard.png): Crew Interview Form, Deck Officers, retains `B · Interview`, `B1`, and `B1.1`.
- The browser reorder was reversed after capture; the original sort order was restored.

**NOT VERIFIED — Test Form section and point numbering in the browser:** The existing Test Form draft has **zero saved sections and zero points** in both parts (confirmed by raw SQL). There are no existing section/point labels to screenshot. The list and matrix numbering, descendant changes after reorder, and preview/live parity are exercised by unit tests with populated structures instead.

**NOT VERIFIED — both Akash Bisht submissions render in the browser:** Development SQL finds three briefing submission records (two completed, one in progress) and one completed debriefing submission for that crew member. These records exist, but no submission-rendering browser check was completed; database presence must not be treated as a rendering pass.

## Raw SQL evidence

Query used before reorder and after restoring the original order:

```sql
SELECT p.part_code, s.section_code
FROM frm_form_parts p
LEFT JOIN frm_sections s ON s.form_part_uuid = p.form_part_uuid AND NOT s.is_deleted
WHERE p.form_version_uuid = '92205f08-31f8-42f4-bff7-13ea8d1b9247'
  AND NOT p.is_deleted
ORDER BY p.sort_order, s.sort_order;
```

Before:

```text
MAIN|
P49912b44e5b54974bbd55eb685753|
```

Immediately after reorder:

```text
P49912b44e5b54974bbd55eb685753|
MAIN|
```

After restoring:

```text
MAIN|
P49912b44e5b54974bbd55eb685753|
```

The empty `section_code` field is a LEFT JOIN null: there are no Test Form sections. The stored `part_code` values remained `MAIN` and `P49912b44e5b54974bbd55eb685753` throughout; only `sort_order` changed during the browser reorder.

## Automated checks

- `npx vitest run tests/unit/configured-form-renderer.test.tsx`: 31 passed (including Company Form list/matrix, preview/live, reorder, inactive nodes, and Standard Form lettering).
- `npx vitest run tests/integration/api/form-part-edit.test.ts`: 7 passed (including code preservation through the part-reorder API).
- `npx tsc --noEmit --pretty false`: **227 errors in 41 files**, unchanged from the supplied baseline at `ee1a48cb`; no errors in the changed files.

Commit HEAD: recorded in the task completion message after commit.