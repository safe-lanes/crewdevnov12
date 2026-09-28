# Company Form part editing — verification

## Browser evidence

Captured against the running development app on 28 September 2026:

- `screenshots/335-before-rename.png` — active draft with original Main Form.
- `screenshots/335-renamed.png` — part title changed to Operations Main.
- `screenshots/335-added.png` — Supporting Notes created without a client-supplied part code.
- `screenshots/335-reordered.png` — Supporting Notes moved ahead of Operations Main.
- `screenshots/335-remove-blocked-section.png` — removing Operations Main reports `Cannot delete part: 1 active section reference it`.
- `screenshots/335-removed-second.png` — Supporting Notes removed; Operations Main remains.
- `screenshots/335-standard-draft-no-controls.png` — Crew Briefing Form draft retains letter codes and has no Company part controls.
- `screenshots/335-released-company-no-controls.png` — released Company version has no part controls.
- `screenshots/335-akash-briefing-live.png` and `screenshots/335-akash-debriefing-live.png` — existing live submissions still render.

The unsaved-section guard was also checked in the browser: editing the existing section title, then clicking Add part left the draft text intact, did not open the add dialog, and displayed `Save or discard unsaved section changes before editing parts.`

## Raw SQL evidence

The active Company Form was `55b7e21b-a859-4e89-a378-92a57b4fb72d`; its draft version was `da7904ee-a120-4a45-8b8f-825e0a33cd6a`. The starting active row was `b29ccd5a-b2c2-4a9f-a180-bad38fb51b91`, `MAIN`, `Main Form`, `configurable`, order 0, with one active section.

Query used at each stage:

```sql
SELECT form_part_uuid, part_code, part_title, part_type, sort_order, is_deleted
FROM frm_form_parts
WHERE form_version_uuid = 'da7904ee-a120-4a45-8b8f-825e0a33cd6a'
ORDER BY sort_order, id;
```

After rename, add, and reorder:

| part UUID | code | title | type | order | deleted |
| --- | --- | --- | --- | ---: | --- |
| `db2f1dd1-dfae-4b8b-a30b-44c8241c6b3e` | `Pc231bf35f24e41c1b529053efdbec` | Supporting Notes | configurable | 0 | false |
| `b29ccd5a-b2c2-4a9f-a180-bad38fb51b91` | `MAIN` | Operations Main | configurable | 1 | false |

After removing Supporting Notes, both rows remain in SQL: its `is_deleted` is true and order remains 0; Operations Main is active with order 1. No duplicate code was returned by `GROUP BY part_code HAVING count(*) > 1` for this version (including soft-deleted rows).

The protected Company Form `637b0d04-e6f1-4961-8fc4-e74009b56000` remained unchanged: draft `1c82c755-9f96-429f-af87-4ce33363370c` and released `3a0ded43-41a4-4460-a6b1-2cc59b0409ba` each have active configurable A / Company Overview at order 0 and B / Company Acknowledgement at order 1.

## Checks

- `npx vitest run tests/integration/api/form-part-edit.test.ts --reporter=dot`: 7/7 passed, including omitted-code create, uniqueness, duplicate explicit-code rejection, fixed-type rejection, and existing guards.
- `npx tsc --noEmit --pretty false`: 227 errors across 41 files. Baseline at `ee1a48cb`: 227 errors across 41 files. No new errors were reported in the files changed for this task.
- Workflow restarted and served requests successfully after changes.