# Direct SQL Migration - Quick Guide

For developers who prefer to run SQL directly without scripts.

---

## 🎯 Simple Migration File

**File:** `add_is_delete_column.sql`

This file contains ONLY the essential migration to add the `is_delete` column.

---

## 🚀 How to Use

### Linux / macOS
```bash
psql $DATABASE_URL -f migrations/add_is_delete_column.sql
```

### Windows (Command Prompt)
```batch
psql "%DATABASE_URL%" -f migrations\add_is_delete_column.sql
```

### Windows (PowerShell)
```powershell
psql $env:DATABASE_URL -f migrations\add_is_delete_column.sql
```

### From psql Interactive Shell
```sql
-- Connect to database
psql $DATABASE_URL

-- Run the file
\i migrations/add_is_delete_column.sql
```

---

## ✅ What This Does

1. **Adds `is_delete` column** (BOOLEAN, DEFAULT false)
2. **Creates index** for query performance
3. **Verifies** column was added successfully
4. **Shows confirmation** message

**Safe to run multiple times** - it checks if column exists first.

---

## 📋 Expected Output

```
NOTICE:  Column is_delete added to recruitment_candidates
CREATE INDEX
 column_name | data_type | column_default | is_nullable 
-------------+-----------+----------------+-------------
 is_delete   | boolean   | false          | YES
(1 row)

NOTICE:  ✅ Migration complete! is_delete column is ready.
```

If column already exists:
```
NOTICE:  Column is_delete already exists, skipping...
CREATE INDEX
 column_name | data_type | column_default | is_nullable 
-------------+-----------+----------------+-------------
 is_delete   | boolean   | false          | YES
(1 row)

NOTICE:  ✅ Migration complete! is_delete column is ready.
```

---

## 🔍 Verify Manually

```sql
-- Check if column exists
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'recruitment_candidates' 
AND column_name = 'is_delete';

-- Check table structure
\d recruitment_candidates
```

---

## ⚡ One-Liner Commands

### Quick Fix (Copy-Paste)

**Linux/Mac:**
```bash
psql $DATABASE_URL -f migrations/add_is_delete_column.sql
```

**Windows (Batch):**
```batch
psql "%DATABASE_URL%" -f migrations\add_is_delete_column.sql
```

**Windows (PowerShell):**
```powershell
psql $env:DATABASE_URL -f migrations\add_is_delete_column.sql
```

---

## 🆚 Comparison with Other Migration Files

| File | Purpose | When to Use |
|------|---------|-------------|
| `add_is_delete_column.sql` | **Simple: Just is_delete column** | Quick fix for 500 error |
| `0001_add_is_delete_to_recruitment_candidates.sql` | Complete migration with docs | Production deployment |
| `apply_all_migrations.sh/.bat/.ps1` | All migrations in order | Fresh setup |

---

## 💡 Why Use This File?

**Advantages:**
- ✅ Simple and direct
- ✅ No scripts to run
- ✅ Works on all platforms
- ✅ Just pure SQL
- ✅ Easy to review
- ✅ Fast to execute

**Use when:**
- You just need to add the is_delete column
- You prefer SQL over scripts
- You want to see exactly what runs
- You're comfortable with psql command

---

**Quick Fix:** Just run the SQL file and you're done! 🎯
