# Audit Crew Assignment Integrity

## What & Why
Run a read-only integrity audit of `crew_assignments` against `vessel_planning_v2`, `crew_sea_service`, crew master data, and vessel master data. The audit must establish whether the intended Planned → OnBoard → signed-off lifecycle holds in the development database and distinguish application-created inconsistencies from seeded, migrated, or directly inserted test data.

## Done looks like
- The report contains numbered answers 0–10 from the supplied investigation prompt
- Every database check includes the exact read-only SQL executed and its raw output
- The report lists every SQL statement executed during the task and confirms that each statement begins with `SELECT` or `WITH`
- Counts and examples cover duplicate Planned assignments, multiple current assignments, sign-on/sign-off mismatches, unassign ghosts, missing sea service, and all five internal contradictions
- The known crew/vessel record is dumped from all three lifecycle tables with all columns and classified against checks 1–7
- Database provenance is assessed from current seed files, migrations, application write paths, and available row metadata without unsupported inference
- Every code path that inserts, updates, or selects from `crew_assignments` is listed with file, line number, lookup strategy, and quoted `WHERE` clause; each SELECT is classified by whether it can return more than one row
- The denominator queries from step 1 are re-run as the final database action and their closing counts match the opening counts exactly
- The report ends with the unchanged `git status` output and current HEAD
- All permitted task changes are committed before completion, and the report includes the resulting HEAD hash

## Out of scope
- Any `INSERT`, `UPDATE`, `DELETE`, schema change, migration, code edit, or data repair
- Fixing inconsistencies found by the audit
- Production-database queries
- Inferring facts that cannot be established from current code or read-only development data; those must be labeled `UNKNOWN`

## Steps
1. **Establish denominators** -- Run read-only counts for the three lifecycle tables and break `crew_assignments` down by assignment type and current state.
2. **Run integrity checks** -- Execute checks 1–7 exactly as specified, returning group/row counts and bounded raw examples with the requested identifiers and timestamps.
3. **Inspect the known record** -- Dump all non-deleted lifecycle rows for the supplied crew and vessel UUIDs, then classify the assignment row against checks 1–7.
4. **Determine data provenance** -- Inspect seeds, migrations, fixtures, and application paths to state what can and cannot be established about how development data was created.
5. **Inventory all read and write paths** -- Search the entire codebase for every insert, update, or select involving `crew_assignments`, recording exact locations, inserted/updated/selected columns, lookup strategy, and quoted predicates. For every SELECT, state whether the query can return more than one row.
6. **Close and deliver the evidence report** -- Re-run the step 1 denominator queries as the final database action and verify that the closing counts exactly match the opening counts. Present numbered answers with every executed SQL statement, confirmation that each begins with `SELECT` or `WITH`, raw output, short plain interpretations, `UNKNOWN` where evidence is insufficient, and final Git status/HEAD verification; commit all permitted changes and report the resulting HEAD before marking the task complete.

## Relevant files
- `attached_assets/Pasted-TASK-INVESTIGATION-ONLY-crew-assignments-data-integrity_1790084362716.txt`
- `shared/v2/crew-pool/schema.ts:74-94,350-372`
- `shared/v2/vessel/schema.ts:14-52`
- `server/v2/rotation/services/rotationDeployService.ts:90-210`
- `server/v2/vessel/services/vesselPlanningService.ts:990-1102,1243-1565`
- `server/v2/vessel/repositories/vesselPlanningRepository.ts:101-136`