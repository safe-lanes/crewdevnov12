# Quick Fix: 500 Error on /api/recruitment-candidates

## Problem

If you see this error:
```
GET /api/recruitment-candidates 500 in 69ms :: {"error":"Failed to fetch recrui…"
```

**Root Cause:** The `is_delete` column doesn't exist in your database.

---

## Solution: Apply the Migration

### Option 1: Quick Fix (Single Command)

```bash
# Apply just the missing column
psql $DATABASE_URL -f migrations/0001_add_is_delete_to_recruitment_candidates.sql
```

**This is safe to run even if the column already exists** - it will skip gracefully.

---

### Option 2: Apply All Migrations (Recommended)

```bash
# Make script executable
chmod +x migrations/apply_all_migrations.sh

# Run all migrations
./migrations/apply_all_migrations.sh
```

---

### Option 3: Manual PostgreSQL Commands

```sql
-- Connect to your database
psql $DATABASE_URL

-- Add the missing column
ALTER TABLE recruitment_candidates 
ADD COLUMN IF NOT EXISTS is_delete BOOLEAN DEFAULT false;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_recruitment_candidates_is_delete 
ON recruitment_candidates(is_delete);

-- Verify
\d recruitment_candidates
```

---

## Verify the Fix

After applying the migration, check the table structure:

```bash
psql $DATABASE_URL -c "\d recruitment_candidates"
```

You should see:
```
...
is_delete        | boolean   | YES  | false
...

Indexes:
    ...
    "idx_recruitment_candidates_is_delete" btree (is_delete)
```

---

## Then Restart Your Application

The Replit workflow will auto-restart after migration, or you can manually restart the workflow.

---

## Why This Happens

The `is_delete` column was added after the initial schema was created. If you:
- Cloned the repo to a new environment
- Used an old database backup
- Didn't apply the migration

...then your database is missing the column, causing 500 errors.

---

## Prevention

Always apply migrations when setting up a new environment:

```bash
# For fresh setup
./migrations/apply_all_migrations.sh

# Or manually in order:
psql $DATABASE_URL -f migrations/0000_stiff_archangel.sql
psql $DATABASE_URL -f migrations/PHASE2_DATABASE_MIGRATION.sql
psql $DATABASE_URL -f migrations/0001_add_is_delete_to_recruitment_candidates.sql
```

---

## Still Getting Errors?

1. **Check DATABASE_URL is correct:**
   ```bash
   echo $DATABASE_URL
   ```

2. **Verify database connection:**
   ```bash
   psql $DATABASE_URL -c "SELECT 1;"
   ```

3. **Check server logs for specific error:**
   - Look for PostgreSQL errors mentioning "is_delete"
   - Check for "column does not exist" errors

4. **Nuclear option - restart from scratch:**
   ```bash
   # CAUTION: This deletes all data!
   psql $DATABASE_URL -c "DROP TABLE IF EXISTS recruitment_candidates CASCADE;"
   ./migrations/apply_all_migrations.sh
   ```
