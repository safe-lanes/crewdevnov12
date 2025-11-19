# Developer Migration Guide

## Overview

This guide explains the database migration system for the Seafarer Performance Management System and how to troubleshoot migration-related errors.

---

## Migration System Architecture

### Migration Files Location
```
migrations/
├── 0000_stiff_archangel.sql              # Initial schema (Drizzle auto-generated)
├── 0001_add_is_delete_to_recruitment_candidates.sql  # Soft delete feature
├── PHASE2_DATABASE_MIGRATION.sql         # Phase 2 tables
├── apply_all_migrations.sh               # Automated migration script
└── meta/                                 # Drizzle ORM metadata
```

### Migration Naming Convention
```
<sequence>_<description>.sql

Examples:
- 0000_stiff_archangel.sql (auto-generated)
- 0001_add_is_delete_to_recruitment_candidates.sql
- 0002_add_photo_storage.sql
```

### Migration Order
Migrations must be applied in sequence:
1. `0000_stiff_archangel.sql` - Base schema
2. `PHASE2_DATABASE_MIGRATION.sql` - Phase 2 additions
3. `0001_add_is_delete_to_recruitment_candidates.sql` - Soft delete

---

## Common Migration Errors

### 1. Error 500: Failed to fetch recruitment candidates

**Error Message:**
```
GET /api/recruitment-candidates 500 in 69ms :: {"error":"Failed to fetch recrui…"
```

**Root Cause:**
The `is_delete` column doesn't exist in the `recruitment_candidates` table.

**Server Log Will Show:**
```
column "is_delete" does not exist
```

**Solution:**
```bash
# Apply the missing migration
psql $DATABASE_URL -f migrations/0001_add_is_delete_to_recruitment_candidates.sql
```

**Why This Happens:**
- Database restored from backup before migration was added
- Fresh clone without applying migrations
- Different environment (local/staging/production) out of sync

---

### 2. Error: relation "recruitment_candidates" does not exist

**Root Cause:**
Fresh database without initial schema applied.

**Solution:**
```bash
# Apply all migrations in order
./migrations/apply_all_migrations.sh
```

---

### 3. Error: column "is_delete" already exists

**Root Cause:**
Migration applied multiple times without IF NOT EXISTS check.

**Solution:**
This shouldn't happen with our migrations (they're idempotent), but if it does:
```sql
-- Check if column exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'recruitment_candidates' 
AND column_name = 'is_delete';
```

---

### 4. Error: Entity Too Large (413)

**Root Cause:**
Base64 encoded photos exceed Express body size limit.

**Solution:**
Already fixed in `server/index.ts`:
```typescript
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));
```

**Not a migration issue** - this is a server configuration.

---

## Developer Workflow

### Setting Up New Development Environment

1. **Clone Repository**
   ```bash
   git clone <repo-url>
   cd seafarer-management
   ```

2. **Set Database Connection**
   ```bash
   # Replit: DATABASE_URL is automatic
   # Local: Set environment variable
   export DATABASE_URL="postgresql://user:pass@localhost:5432/dbname"
   ```

3. **Apply All Migrations**
   ```bash
   chmod +x migrations/apply_all_migrations.sh
   ./migrations/apply_all_migrations.sh
   ```

4. **Verify Database State**
   ```bash
   psql $DATABASE_URL -c "\d recruitment_candidates"
   ```

5. **Start Application**
   ```bash
   npm run dev
   ```

---

## Diagnostic Commands

### Check if Migration is Needed

```bash
# Check if is_delete column exists
psql $DATABASE_URL -c "
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_name = 'recruitment_candidates' 
  AND column_name = 'is_delete'
) AS has_is_delete_column;
"

# Expected output: t (true) if column exists
```

### Check Current Table Structure

```bash
psql $DATABASE_URL -c "\d recruitment_candidates"
```

**Expected columns:**
- id (text, primary key)
- file_no (text, unique)
- first_name, middle_name, family_name
- dob, nationality
- rank_applied_for, present_rank, vessel_type
- status, application_data
- created_at, updated_at
- **is_delete (boolean, default false)** ← Must exist

### Check Applied Indexes

```bash
psql $DATABASE_URL -c "
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'recruitment_candidates';
"
```

**Expected indexes:**
- recruitment_candidates_pkey (PRIMARY KEY)
- recruitment_candidates_file_no_unique (UNIQUE)
- **idx_recruitment_candidates_is_delete** ← Must exist

### Check Database Connection

```bash
# Quick connection test
psql $DATABASE_URL -c "SELECT version();"

# Check current database
psql $DATABASE_URL -c "SELECT current_database();"
```

---

## Manual Migration Application

### Apply Single Migration

```bash
# Dry run (see what would happen)
cat migrations/0001_add_is_delete_to_recruitment_candidates.sql

# Apply migration
psql $DATABASE_URL -f migrations/0001_add_is_delete_to_recruitment_candidates.sql
```

### Apply All Migrations

```bash
# Using automated script (recommended)
./migrations/apply_all_migrations.sh

# Or manually one by one
psql $DATABASE_URL -f migrations/0000_stiff_archangel.sql
psql $DATABASE_URL -f migrations/PHASE2_DATABASE_MIGRATION.sql
psql $DATABASE_URL -f migrations/0001_add_is_delete_to_recruitment_candidates.sql
```

---

## Troubleshooting Steps

### Step 1: Verify Database Connection

```bash
echo $DATABASE_URL
psql $DATABASE_URL -c "SELECT 1;"
```

If connection fails:
- Check DATABASE_URL is correct
- Verify database server is running
- Check network connectivity
- Verify credentials

### Step 2: Check Table Existence

```bash
psql $DATABASE_URL -c "\dt recruitment_candidates"
```

If table doesn't exist:
```bash
# Apply initial schema
psql $DATABASE_URL -f migrations/0000_stiff_archangel.sql
```

### Step 3: Check Column Existence

```bash
psql $DATABASE_URL -c "\d recruitment_candidates" | grep is_delete
```

If column missing:
```bash
# Apply soft delete migration
psql $DATABASE_URL -f migrations/0001_add_is_delete_to_recruitment_candidates.sql
```

### Step 4: Check Server Logs

```bash
# Look for PostgreSQL errors
grep -i "error" logs/*.log
grep -i "column" logs/*.log
grep -i "is_delete" logs/*.log
```

### Step 5: Restart Application

After applying migrations, restart the server:
- Replit: Workflow auto-restarts
- Local: `npm run dev`

---

## Migration Best Practices

### 1. Always Make Migrations Idempotent

```sql
-- GOOD: Safe to run multiple times
ALTER TABLE recruitment_candidates 
ADD COLUMN IF NOT EXISTS is_delete BOOLEAN DEFAULT false;

-- BAD: Will fail if column exists
ALTER TABLE recruitment_candidates 
ADD COLUMN is_delete BOOLEAN DEFAULT false;
```

### 2. Use Transactions for Complex Migrations

```sql
BEGIN;

ALTER TABLE recruitment_candidates ADD COLUMN new_field TEXT;
CREATE INDEX idx_new_field ON recruitment_candidates(new_field);

COMMIT;
```

### 3. Include Verification Queries

```sql
-- At end of migration file
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'recruitment_candidates' 
AND column_name = 'is_delete';
```

### 4. Document Migration Purpose

```sql
-- ============================================
-- MIGRATION: Add is_delete Column
-- ============================================
-- Date: 2025-11-19
-- Purpose: Enable soft delete functionality
-- Impact: All existing records will have is_delete = false
-- ============================================
```

### 5. Test Migration Before Applying to Production

```bash
# Test on development database first
psql $DEV_DATABASE_URL -f migrations/0001_new_migration.sql

# Verify results
psql $DEV_DATABASE_URL -c "\d table_name"

# Only then apply to production
psql $PROD_DATABASE_URL -f migrations/0001_new_migration.sql
```

---

## Environment-Specific Notes

### Replit Environment

- DATABASE_URL automatically set
- PostgreSQL managed by Replit
- Migrations must be manually applied
- No automatic migration on deploy

### Local Development

```bash
# Set up local PostgreSQL
export DATABASE_URL="postgresql://localhost:5432/crew_dev"

# Apply migrations
./migrations/apply_all_migrations.sh
```

### Production Deployment

```bash
# 1. BACKUP FIRST
pg_dump $PROD_DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Apply migrations
./migrations/apply_all_migrations.sh

# 3. Verify
psql $PROD_DATABASE_URL -c "\d recruitment_candidates"

# 4. Test API endpoints
curl https://production-url/api/recruitment-candidates
```

---

## Quick Reference Commands

### Check Migration Status
```bash
# Column exists?
psql $DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'recruitment_candidates' AND column_name = 'is_delete';"

# Index exists?
psql $DATABASE_URL -c "SELECT indexname FROM pg_indexes WHERE tablename = 'recruitment_candidates' AND indexname = 'idx_recruitment_candidates_is_delete';"
```

### Apply Missing Migration
```bash
psql $DATABASE_URL -f migrations/0001_add_is_delete_to_recruitment_candidates.sql
```

### Rollback (Emergency)
```bash
# Drop column (CAUTION: Loses data)
psql $DATABASE_URL -c "ALTER TABLE recruitment_candidates DROP COLUMN IF EXISTS is_delete;"

# Drop index
psql $DATABASE_URL -c "DROP INDEX IF EXISTS idx_recruitment_candidates_is_delete;"
```

### Reset Database (Nuclear Option)
```bash
# CAUTION: Deletes all data!
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
./migrations/apply_all_migrations.sh
```

---

## Creating New Migrations

### Step 1: Update Schema
Edit `shared/schema.ts` with new columns/tables.

### Step 2: Generate Migration SQL
```sql
-- Create new file: migrations/0002_description.sql
ALTER TABLE table_name 
ADD COLUMN IF NOT EXISTS new_column TYPE DEFAULT value;

CREATE INDEX IF NOT EXISTS idx_new_column 
ON table_name(new_column);
```

### Step 3: Test Migration
```bash
# Apply to dev database
psql $DEV_DATABASE_URL -f migrations/0002_description.sql

# Verify
psql $DEV_DATABASE_URL -c "\d table_name"
```

### Step 4: Update Documentation
- Add to `migrations/README.md`
- Update `MIGRATION_SUMMARY.md`
- Document in this guide if it's a common pattern

### Step 5: Commit and Deploy
```bash
git add migrations/0002_description.sql
git commit -m "Add migration: description"
git push
```

---

## Support and Resources

### Documentation Files
- `migrations/README.md` - Migration overview
- `migrations/QUICK_FIX_500_ERROR.md` - Quick troubleshooting
- `MIGRATION_SUMMARY.md` - Complete migration timeline

### Useful Links
- PostgreSQL Column Management: https://www.postgresql.org/docs/current/ddl-alter.html
- Drizzle ORM Migrations: https://orm.drizzle.team/docs/migrations
- Replit PostgreSQL: https://docs.replit.com/hosting/databases/postgresql

### Getting Help

1. Check server logs for specific error
2. Run diagnostic commands above
3. Review migration files in `migrations/`
4. Check this guide for common errors
5. Verify database state with `\d` commands

---

## Summary Checklist

**New Environment Setup:**
- [ ] Set DATABASE_URL
- [ ] Run `./migrations/apply_all_migrations.sh`
- [ ] Verify with `\d recruitment_candidates`
- [ ] Test API: `GET /api/recruitment-candidates`

**Troubleshooting 500 Errors:**
- [ ] Check server logs for error details
- [ ] Verify `is_delete` column exists
- [ ] Apply missing migration if needed
- [ ] Restart application
- [ ] Test endpoints

**Before Production Deploy:**
- [ ] Backup production database
- [ ] Test migrations on staging
- [ ] Review all migration files
- [ ] Plan rollback strategy
- [ ] Apply migrations during low-traffic window

---

**Last Updated:** November 19, 2025  
**Schema Version:** recruitment_candidates with is_delete column  
**Migration Files:** 0000, PHASE2, 0001
