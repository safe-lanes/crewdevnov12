# Automatic Database Migrations

## ✅ How It Works

When you run `npm run dev`, migrations are applied **automatically** before the server starts.

### Migration Process

1. **Startup**: Application starts with `npm run dev`
2. **Check**: System reads all `.sql` files from `migrations/` folder
3. **Track**: Compares with `schema_migrations` table in database
4. **Apply**: Runs only new migrations that haven't been applied
5. **Skip**: Ignores already-applied migrations
6. **Start**: Server starts after successful migrations

---

## 🎯 Zero Manual Steps Required

**Old Way (Manual):**
```bash
# DON'T do this anymore!
psql $DATABASE_URL -f migrations/new_migration.sql
```

**New Way (Automatic):**
```bash
# Just start the app - migrations run automatically!
npm run dev
```

---

## 📝 Adding a New Migration

### Step 1: Create SQL File

Create a new `.sql` file in the `migrations/` folder:

```bash
# File: migrations/0002_add_new_column.sql
```

**File Naming Convention:**
- Use sequential numbers: `0001_`, `0002_`, `0003_`, etc.
- Use descriptive names: `add_user_preferences`, `create_audit_table`
- Example: `0002_add_user_preferences.sql`

### Step 2: Write Your Migration

```sql
-- migrations/0002_add_user_preferences.sql
ALTER TABLE users 
ADD COLUMN preferences JSONB DEFAULT '{}'::jsonb;

CREATE INDEX idx_users_preferences ON users USING GIN (preferences);
```

### Step 3: Restart Application

```bash
# Stop current server (Ctrl+C if running locally)
# Restart with:
npm run dev
```

**That's it!** The migration will be applied automatically.

---

## 🔍 Verifying Migrations

### Check Applied Migrations

```sql
SELECT filename, applied_at 
FROM schema_migrations 
ORDER BY applied_at;
```

### View Startup Logs

When you run `npm run dev`, you'll see:

```
🔄 Starting automatic database migrations...
🔧 Applying migration: 0002_add_new_column.sql
✅ Successfully applied: 0002_add_new_column.sql

📊 Migration Summary:
   ✅ Applied: 1
   ⏭️  Skipped: 4
   📁 Total: 5
✅ Database migrations completed successfully!
```

---

## 🛡️ Safety Features

### Idempotent (Safe to Run Multiple Times)

```bash
# First run
npm run dev
# Output: Applied: 1

# Second run
npm run dev
# Output: Skipped: 5 (already applied)
```

### Transaction Protection

Each migration runs in a transaction:
- ✅ **Success**: Changes are committed
- ❌ **Failure**: Changes are rolled back
- 🛡️ **Safety**: Database stays consistent

### Error Handling

If a migration fails:
```
❌ Failed to apply migration 0002_bad_migration.sql
Migration runner failed: Error: ...
```

**Server won't start** - preventing broken state.

---

## 📁 Migration Files Tracked

Current migrations in system:

| Filename | Status | Purpose |
|----------|--------|---------|
| `0000_stiff_archangel.sql` | ✅ Applied | Initial schema (Drizzle generated) |
| `PHASE2_DATABASE_MIGRATION.sql` | ✅ Applied | Phase 2 tables |
| `0001_add_is_delete_to_recruitment_candidates.sql` | ✅ Applied | Soft delete column |
| `add_is_delete_column.sql` | ✅ Applied | Simple soft delete (redundant) |

---

## 🚫 What NOT to Do

### ❌ Don't Run Migrations Manually

```bash
# DON'T DO THIS (migrations are automatic now!)
psql $DATABASE_URL -f migrations/0002_new_migration.sql
```

**Why?** The migration tracker won't know it was applied.

### ❌ Don't Modify Applied Migrations

Once a migration is applied (listed in `schema_migrations`), **never modify it**.

**Instead:** Create a new migration to make changes.

```sql
-- WRONG: Editing migrations/0001_add_column.sql after it's applied
-- RIGHT: Create migrations/0003_modify_column.sql
```

### ❌ Don't Delete Migration Files

Even after applied, keep the files for:
- Version control history
- Team member onboarding
- Production deployments

---

## 👥 Team Workflow

### Developer A Creates Migration

1. Creates `migrations/0002_add_feature.sql`
2. Commits to Git
3. Pushes to repository

### Developer B Pulls Changes

1. Pulls from Git (gets new migration file)
2. Runs `npm run dev`
3. Migration applies automatically ✅

**No manual steps required!**

---

## 🏭 Production Deployment

### Deployment Process

```bash
# Pull latest code
git pull origin main

# Start application (migrations run automatically)
npm run dev
# or
npm start
```

Migrations will:
1. Check which are already applied in production DB
2. Apply only new migrations
3. Start server after successful migration

### Backup Before Deployment

```bash
# Always backup production before deployment
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

---

## 🔧 Advanced: Manual Migration Control

### Check Migration Status

```sql
-- See all applied migrations
SELECT * FROM schema_migrations ORDER BY applied_at DESC;
```

### Manually Mark Migration as Applied

If you manually ran a migration and need to mark it:

```sql
INSERT INTO schema_migrations (filename) 
VALUES ('0002_manual_migration.sql');
```

### Remove Migration Record (Dangerous!)

```sql
-- Only do this if you know what you're doing!
DELETE FROM schema_migrations WHERE filename = '0002_bad_migration.sql';
```

Then the migration will run again on next startup.

---

## 🎓 Best Practices

### 1. Sequential Naming

```
migrations/
├── 0000_initial_schema.sql
├── 0001_add_feature_a.sql
├── 0002_add_feature_b.sql
├── 0003_modify_feature_a.sql
└── 0004_create_index.sql
```

### 2. Descriptive Names

✅ Good:
- `0002_add_is_delete_to_users.sql`
- `0003_create_audit_log_table.sql`
- `0004_add_email_verification.sql`

❌ Bad:
- `migration.sql`
- `fix.sql`
- `update.sql`

### 3. One Purpose Per Migration

```sql
-- GOOD: Single focused change
-- migrations/0002_add_user_avatar.sql
ALTER TABLE users ADD COLUMN avatar_url TEXT;
```

```sql
-- BAD: Multiple unrelated changes
-- migrations/0002_various_changes.sql
ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE products ADD COLUMN discount DECIMAL;
CREATE TABLE logs (...);
```

### 4. Include Rollback Comments

```sql
-- Migration: Add user preferences
-- Rollback: ALTER TABLE users DROP COLUMN preferences;

ALTER TABLE users ADD COLUMN preferences JSONB DEFAULT '{}'::jsonb;
```

---

## 📊 Migration Summary

**Total Migrations:** 4 applied  
**System Status:** ✅ Fully automatic  
**Manual Steps:** 0 required  

**Workflow:**
1. Create `.sql` file in `migrations/`
2. Run `npm run dev`
3. ✅ Done!

---

## 🎉 Success!

You now have a fully automatic migration system:
- ✅ Runs on application startup
- ✅ Tracks applied migrations
- ✅ Skips already-applied migrations
- ✅ Zero manual intervention needed
- ✅ Safe and idempotent
- ✅ Transaction-protected

**Just create migration files and restart the app!** 🚀
