# Training attachment references on save

Training create, update and reconciliation saves assign a reference only when
the persisted `crew_training_courses.attachment_ref` is SQL NULL:

```text
suffix = trimmed nonblank abbr, otherwise trimmed trainingCourse
attachment_ref = {crew_members_v2.emp_no}-T_{suffix}
```

There is no sort order in the reference. Once non-null, the reference is kept
exactly, including an empty string. Training updates cannot clear or replace it
through the incoming payload. A supplied non-null reference on creation is kept.

The ordinary save commits first. `ensureTrainingAttachmentReference` then uses
the same tenant database in a separate transaction to:

1. Serialize allocations for the same crew with a transaction advisory lock.
2. Lock and read the current training record, including persisted partial edits.
3. Retrieve the crew's employee number and construct a folder-safe candidate.
4. Check active records across all ten sections handled by the legacy importer,
   using its trimmed, case-insensitive comparison.
5. Assign only if the stored reference is still NULL.

The existing `crew_dev` save transaction still validates certificate ownership,
locks crew suggestion assignments, and reconciles training suggestions before
committing. Suggestion or attachment failures still roll back the ordinary save;
reference allocation runs only after that transaction succeeds. Bulk updates
continue through the training repository so ownership checks are preserved.

Missing values, unsafe names, conflicts and allocation failures leave the
reference null and produce a `[training-attachment-ref]` server warning. They do
not undo training data or attachment saves. The next save retries allocation.
Lock waits are limited to two seconds and allocation statements to five seconds.
Other database writes that bypass these paths do not participate in the advisory
lock; this is not a new database-wide uniqueness constraint.

The frontend response shape and the existing attachment converter/importer are
unchanged. The converter still matches training by abbreviation only; using
the training name as a reference suffix does not add name matching to it.
Records with missing references continue to be excluded by the converter.

## Existing-data migration

`0202_backfill_training_attachment_ref.sql` retains the separately requested
`{crew_uuid}-T_{training_course}` backfill, for NULL references only. It does not
apply the save-time conflict checks or validate folder names. Null course names
stay null; duplicate crew/course names can create duplicate references. Review
those cases before deploying the migration, which the existing runner discovers
automatically. Existing backfilled values are preserved by later training saves.

## Verification

Unit tests cover the allocator and all three service save paths. The opt-in
PostgreSQL tests initialize their own temporary cluster and never use `.env` or
`DATABASE_URL`. They stop the cluster and remove its temporary files afterward.

```powershell
$env:TRAINING_REF_PG_BIN = 'C:\Program Files\PostgreSQL\18\bin'
npx.cmd vitest run tests/integration/training-attachment-reference.test.ts --reporter=dot
```
