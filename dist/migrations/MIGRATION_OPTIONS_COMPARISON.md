# Migration Options - Choose Your Method

This guide helps you choose the right migration method for your situation.

---

## 🎯 Quick Comparison

| Method | Speed | Complexity | When to Use |
|--------|-------|------------|-------------|
| **Simple SQL** | ⚡⚡⚡ Fastest | ⭐ Easiest | Quick 500 error fix |
| **Bash/Batch Scripts** | ⚡⚡ Fast | ⭐⭐ Easy | Fresh setup, all migrations |
| **Full Migration** | ⚡ Normal | ⭐⭐⭐ Detailed | Production deployment |
| **Manual SQL** | ⚡⚡ Fast | ⭐⭐ Moderate | Learning/troubleshooting |

---

## 1️⃣ Simple SQL File (Recommended for Quick Fix)

**File:** `add_is_delete_column.sql`

### When to Use
- ✅ Just need to fix 500 error
- ✅ Only missing is_delete column
- ✅ Want the fastest solution
- ✅ Prefer direct SQL execution

### How to Use
```bash
# Linux/Mac
psql $DATABASE_URL -f migrations/add_is_delete_column.sql

# Windows
psql "%DATABASE_URL%" -f migrations\add_is_delete_column.sql
```

### What It Does
- Adds `is_delete` column (if missing)
- Creates performance index
- Shows verification output
- ✅ **Idempotent** (safe to run multiple times)

### Advantages
- ⚡ **Fastest** option
- 📄 Pure SQL, no scripts
- 🔍 Easy to review
- 🌐 Works on all platforms
- ✅ Simple and direct

---

## 2️⃣ Automated Scripts (Recommended for Fresh Setup)

**Files:** `apply_all_migrations.sh`, `apply_all_migrations.bat`, `apply_all_migrations.ps1`

### When to Use
- ✅ Setting up new environment
- ✅ Want all migrations applied
- ✅ Prefer automated process
- ✅ Need verification built-in

### How to Use

**Linux/Mac:**
```bash
chmod +x migrations/apply_all_migrations.sh
./migrations/apply_all_migrations.sh
```

**Windows (Batch):**
```batch
migrations\apply_all_migrations.bat
```

**Windows (PowerShell):**
```powershell
.\migrations\apply_all_migrations.ps1
```

### What It Does
- Checks DATABASE_URL is set
- Applies all migrations in order
- Shows progress for each step
- Verifies final database state
- ✅ **Comprehensive** setup

### Advantages
- 🤖 Fully automated
- 📋 Applies all migrations
- ✅ Built-in verification
- 🎨 Colored output (PowerShell)
- 🛡️ Error handling

---

## 3️⃣ Full Migration File (Recommended for Production)

**File:** `0001_add_is_delete_to_recruitment_candidates.sql`

### When to Use
- ✅ Production deployment
- ✅ Need complete documentation
- ✅ Want detailed verification
- ✅ Prefer well-documented migrations

### How to Use
```bash
# Linux/Mac
psql $DATABASE_URL -f migrations/0001_add_is_delete_to_recruitment_candidates.sql

# Windows
psql "%DATABASE_URL%" -f migrations\0001_add_is_delete_to_recruitment_candidates.sql
```

### What It Does
- Adds `is_delete` column with full docs
- Creates index with explanation
- Runs extensive verification queries
- Shows table structure
- ✅ **Production-ready**

### Advantages
- 📚 Well documented
- 🔍 Extensive verification
- ✅ Complete audit trail
- 📝 Production standards

---

## 4️⃣ Manual SQL Commands (For Learning/Troubleshooting)

### When to Use
- ✅ Learning how migrations work
- ✅ Troubleshooting specific issues
- ✅ Need fine-grained control
- ✅ Using GUI tools (pgAdmin, DBeaver)

### How to Use
```sql
-- Connect to database
psql $DATABASE_URL

-- Add column
ALTER TABLE recruitment_candidates 
ADD COLUMN IF NOT EXISTS is_delete BOOLEAN DEFAULT false;

-- Create index
CREATE INDEX IF NOT EXISTS idx_recruitment_candidates_is_delete 
ON recruitment_candidates(is_delete);

-- Verify
\d recruitment_candidates
```

### Advantages
- 🎓 Educational
- 🔧 Full control
- 🖥️ Works with GUI tools
- 🔍 Step-by-step execution

---

## 💡 Decision Tree

```
Do you have a 500 error on /api/recruitment-candidates?
├─ Yes → Use Simple SQL (add_is_delete_column.sql) ⚡
└─ No
   │
   └─ Setting up fresh environment?
      ├─ Yes → Use Automated Scripts 🤖
      └─ No
         │
         └─ Deploying to production?
            ├─ Yes → Use Full Migration File 📚
            └─ No → Learning/troubleshooting?
               └─ Yes → Use Manual SQL Commands 🎓
```

---

## 📊 Feature Comparison

| Feature | Simple SQL | Scripts | Full Migration | Manual |
|---------|-----------|---------|----------------|--------|
| Speed | ⚡⚡⚡ | ⚡⚡ | ⚡ | ⚡⚡ |
| Ease of use | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐ |
| Documentation | Basic | Good | Extensive | None |
| Verification | Yes | Yes | Extensive | Manual |
| Idempotent | ✅ | ✅ | ✅ | ✅ |
| Cross-platform | ✅ | ✅ | ✅ | ✅ |
| All migrations | ❌ | ✅ | ❌ | ❌ |
| Production ready | ✅ | ✅ | ✅ | ⚠️ |

---

## 🎯 Common Scenarios

### Scenario 1: "I just got a 500 error"
**Solution:** Simple SQL ⚡
```bash
psql $DATABASE_URL -f migrations/add_is_delete_column.sql
```

### Scenario 2: "I'm setting up a new development environment"
**Solution:** Automated Scripts 🤖
```bash
./migrations/apply_all_migrations.sh  # Linux/Mac
migrations\apply_all_migrations.bat   # Windows
```

### Scenario 3: "I'm deploying to production"
**Solution:** Full Migration File 📚
```bash
# 1. Backup first!
pg_dump $DATABASE_URL > backup.sql

# 2. Apply migration
psql $DATABASE_URL -f migrations/0001_add_is_delete_to_recruitment_candidates.sql

# 3. Verify
psql $DATABASE_URL -c "\d recruitment_candidates"
```

### Scenario 4: "I want to understand what's happening"
**Solution:** Manual SQL 🎓
```sql
-- Copy commands from migration file and run one by one
```

---

## ✅ Recommendation by Experience Level

### Beginners
→ Use **Simple SQL** for quick fixes  
→ Use **Automated Scripts** for setup

### Intermediate
→ Use **Simple SQL** or **Scripts** based on need  
→ Review **Full Migration** for learning

### Advanced
→ Any method based on situation  
→ **Manual SQL** for custom scenarios  
→ **Full Migration** for production

---

## 📚 Documentation for Each Method

| Method | Read This |
|--------|-----------|
| Simple SQL | `DIRECT_SQL_USAGE.md` |
| Scripts | `OS_SPECIFIC_INSTRUCTIONS.md` |
| Full Migration | `DEVELOPER_MIGRATION_GUIDE.md` |
| Manual SQL | `README.md` |

---

**Bottom Line:** Most developers should use **Simple SQL** for quick fixes and **Automated Scripts** for fresh setups. 🎯
