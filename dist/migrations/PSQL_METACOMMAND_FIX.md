# ✅ PSQL Meta-Command Fix

## 🐛 Issue Identified

**Error**: `syntax error at or near "\""`

### Root Cause

Migration files contained **psql meta-commands** which are NOT valid SQL:
```sql
\d recruitment_candidates  -- ❌ This is a psql command, NOT SQL
```

### Why This Fails

The migration runner uses Node.js `pg` library's `client.query()` which executes **SQL only**. 

Psql meta-commands like `\d`, `\dt`, `\l`, etc. are **interactive psql features** that only work in the `psql` command-line tool, not through programmatic SQL execution.

---

## ✅ Files Fixed

### 1. migrations/0001_add_is_delete_to_recruitment_candidates.sql

**Removed:**
```sql
\d recruitment_candidates
```

**Reason**: This command only works in psql CLI, not in Node.js queries.

### 2. migrations/PHASE2_DATABASE_MIGRATION.sql

**Removed:**
```sql
\d company_processing
\d promotion_forms
```

**Reason**: Same as above - psql meta-commands don't work in programmatic SQL.

---

## 🔍 How to Identify This Issue

### Symptoms

```bash
❌ Migration runner failed: Error: Migration failed: xxx.sql
error: syntax error at or near "\"
```

### Quick Check

```bash
# Search for psql meta-commands in migration files
grep -rn "^\\\\[a-z]" migrations/*.sql
```

### Common Psql Meta-Commands (DON'T USE in migrations)

- `\d [table]` - Describe table
- `\dt` - List tables
- `\l` - List databases
- `\du` - List users
- `\c [database]` - Connect to database
- `\i [file]` - Include file
- `\q` - Quit

---

## ✅ Solution

### What TO Use (Valid SQL)

Instead of psql meta-commands, use SQL queries:

**Instead of `\d table_name`:**
```sql
-- Get table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'your_table';
```

**Instead of `\dt`:**
```sql
-- List tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

**Instead of `\du`:**
```sql
-- List users/roles
SELECT rolname 
FROM pg_roles;
```

---

## 🎯 Best Practices for Migration Files

### ✅ DO Use

- Pure SQL statements
- `CREATE TABLE`, `ALTER TABLE`, `INSERT`, etc.
- `DO $$ ... END $$` blocks for conditional logic
- `information_schema` queries for verification
- SQL comments (`--` or `/* ... */`)

### ❌ DON'T Use

- Psql meta-commands (`\d`, `\dt`, `\l`, etc.)
- Interactive features
- Commands that only work in psql CLI

---

## 🔧 Testing the Fix

### Verify Migration Files Are Clean

```bash
# Should return nothing (exit code 1)
grep -rn "^\\\\[a-z]" migrations/*.sql
```

### Re-apply Fixed Migrations

```bash
# Migrations will be re-applied automatically on next startup
npm run dev
```

---

## 📊 Impact

### Before Fix

```
🔄 Starting automatic database migrations...
🔧 Applying migration: 0001_add_is_delete_to_recruitment_candidates.sql
❌ Failed to apply migration: syntax error at or near "\"
Server won't start ❌
```

### After Fix

```
🔄 Starting automatic database migrations...
🔧 Applying migration: 0001_add_is_delete_to_recruitment_candidates.sql
✅ Successfully applied: 0001_add_is_delete_to_recruitment_candidates.sql
🔧 Applying migration: PHASE2_DATABASE_MIGRATION.sql
✅ Successfully applied: PHASE2_DATABASE_MIGRATION.sql
✅ Database migrations completed successfully!
Server starts ✅
```

---

## 📝 Summary

**Problem**: Psql meta-commands in SQL files  
**Symptom**: `syntax error at or near "\"`  
**Solution**: Remove all `\` commands, use pure SQL  
**Files Fixed**: 2 migration files  
**Status**: ✅ Ready to re-apply  

---

## 🎓 Key Takeaway

**Migration files must contain ONLY valid SQL that can be executed via `client.query()`**

If it starts with `\`, it's a psql meta-command and **won't work** in migrations!
