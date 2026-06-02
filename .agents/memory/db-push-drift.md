---
name: db:push interactive drift
description: Why `npm run db:push` hangs on this repo and how to add columns safely
---

`npm run db:push` (drizzle-kit) on this repo drops into an interactive
"rename table?" prompt for many existing tables because the live DB has
drift from the drizzle schema. In the non-interactive agent shell this
means the push does NOT apply and can be dangerous (a blind force could
rename/drop tables = data loss).

**Rule:** For a simple additive change (e.g. adding one nullable/defaulted
column), apply it directly with idempotent SQL instead of `db:push`:
`ALTER TABLE <t> ADD COLUMN IF NOT EXISTS <col> <type> NOT NULL DEFAULT <v>;`
Keep the drizzle schema in `shared/v2/.../schema.ts` as the source of truth
(update it too) so the column matches what the ORM expects.

**Why:** db:push is unattended-unsafe here; direct ALTER is safe, idempotent,
and matches the schema without touching unrelated drifted tables.
