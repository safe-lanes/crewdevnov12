# OS-Specific Migration Instructions

This guide provides instructions for applying database migrations on different operating systems.

---

## 📋 Available Migration Scripts

We provide migration scripts for all major operating systems:

| OS | Script | Command |
|---|---|---|
| **Linux/Mac** | `apply_all_migrations.sh` | `./migrations/apply_all_migrations.sh` |
| **Windows (Batch)** | `apply_all_migrations.bat` | `migrations\apply_all_migrations.bat` |
| **Windows (PowerShell)** | `apply_all_migrations.ps1` | `.\migrations\apply_all_migrations.ps1` |

---

## 🐧 Linux / macOS

### Prerequisites
- PostgreSQL client tools installed (`psql` command available)
- `bash` shell

### Steps

```bash
# 1. Make script executable
chmod +x migrations/apply_all_migrations.sh

# 2. Set DATABASE_URL (if not already set)
export DATABASE_URL="postgresql://user:pass@host:port/database"

# 3. Run the script
./migrations/apply_all_migrations.sh
```

### Verification
```bash
psql $DATABASE_URL -c "\d recruitment_candidates"
```

---

## 🪟 Windows (Command Prompt / Batch)

### Prerequisites
- PostgreSQL client tools installed (`psql.exe` in PATH)
- Command Prompt or PowerShell

### Steps

```batch
REM 1. Set DATABASE_URL (if not already set)
set DATABASE_URL=postgresql://user:pass@host:port/database

REM 2. Navigate to project directory
cd C:\path\to\seafarer-management

REM 3. Run the batch script
migrations\apply_all_migrations.bat
```

### Verification
```batch
psql "%DATABASE_URL%" -c "\d recruitment_candidates"
```

---

## 🪟 Windows (PowerShell)

### Prerequisites
- PostgreSQL client tools installed (`psql.exe` in PATH)
- PowerShell 5.1 or later

### Steps

```powershell
# 1. Set DATABASE_URL (if not already set)
$env:DATABASE_URL = "postgresql://user:pass@host:port/database"

# 2. Navigate to project directory
cd C:\path\to\seafarer-management

# 3. Set execution policy (first time only)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# 4. Run the PowerShell script
.\migrations\apply_all_migrations.ps1
```

### Verification
```powershell
psql $env:DATABASE_URL -c "\d recruitment_candidates"
```

### Troubleshooting PowerShell Execution Policy

If you get an error about execution policy:

```powershell
# Option 1: Run with bypass (one-time)
PowerShell -ExecutionPolicy Bypass -File .\migrations\apply_all_migrations.ps1

# Option 2: Change policy for current user (permanent)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 🔧 Manual Migration (Any OS)

If scripts don't work or you prefer manual control:

### Using psql command line

**Linux/Mac:**
```bash
psql $DATABASE_URL -f migrations/0000_stiff_archangel.sql
psql $DATABASE_URL -f migrations/PHASE2_DATABASE_MIGRATION.sql
psql $DATABASE_URL -f migrations/0001_add_is_delete_to_recruitment_candidates.sql
```

**Windows (Command Prompt):**
```batch
psql "%DATABASE_URL%" -f migrations\0000_stiff_archangel.sql
psql "%DATABASE_URL%" -f migrations\PHASE2_DATABASE_MIGRATION.sql
psql "%DATABASE_URL%" -f migrations\0001_add_is_delete_to_recruitment_candidates.sql
```

**Windows (PowerShell):**
```powershell
psql $env:DATABASE_URL -f migrations\0000_stiff_archangel.sql
psql $env:DATABASE_URL -f migrations\PHASE2_DATABASE_MIGRATION.sql
psql $env:DATABASE_URL -f migrations\0001_add_is_delete_to_recruitment_candidates.sql
```

### Using PostgreSQL GUI Tools

**pgAdmin, DBeaver, or other GUI tools:**
1. Connect to your database
2. Open SQL editor
3. Copy content from migration file
4. Execute SQL
5. Repeat for each migration file in order

---

## 🌐 Cloud Environments

### Replit
```bash
# DATABASE_URL is automatically set
./migrations/apply_all_migrations.sh
```

### Heroku
```bash
# Use Heroku's DATABASE_URL
heroku run bash
./migrations/apply_all_migrations.sh
```

### Docker
```bash
# Inside container
docker exec -it container_name bash
./migrations/apply_all_migrations.sh
```

---

## 🔍 Verifying Installation

### Check if psql is installed

**Linux/Mac:**
```bash
which psql
psql --version
```

**Windows (Command Prompt):**
```batch
where psql
psql --version
```

**Windows (PowerShell):**
```powershell
Get-Command psql
psql --version
```

### Expected output:
```
psql (PostgreSQL) 14.x or higher
```

### If psql is not found:

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install postgresql-client
```

**macOS:**
```bash
brew install postgresql
```

**Windows:**
1. Download PostgreSQL from: https://www.postgresql.org/download/windows/
2. During installation, select "Command Line Tools"
3. Add to PATH: `C:\Program Files\PostgreSQL\15\bin`

---

## 📝 Environment Variable Setup

### Temporary (Current Session Only)

**Linux/Mac:**
```bash
export DATABASE_URL="postgresql://user:pass@host:port/database"
```

**Windows (Command Prompt):**
```batch
set DATABASE_URL=postgresql://user:pass@host:port/database
```

**Windows (PowerShell):**
```powershell
$env:DATABASE_URL = "postgresql://user:pass@host:port/database"
```

### Permanent (Persists Across Sessions)

**Linux/Mac:**
```bash
# Add to ~/.bashrc or ~/.zshrc
echo 'export DATABASE_URL="postgresql://user:pass@host:port/database"' >> ~/.bashrc
source ~/.bashrc
```

**Windows (System Environment Variable):**
1. Press `Win + R`, type `sysdm.cpl`, press Enter
2. Go to "Advanced" tab
3. Click "Environment Variables"
4. Under "User variables", click "New"
5. Variable name: `DATABASE_URL`
6. Variable value: `postgresql://user:pass@host:port/database`
7. Click OK

**Windows (PowerShell Profile):**
```powershell
# Add to PowerShell profile
notepad $PROFILE
# Add this line:
$env:DATABASE_URL = "postgresql://user:pass@host:port/database"
```

---

## ⚠️ Common Issues

### Issue: "psql: command not found" or "'psql' is not recognized"

**Solution:**
Install PostgreSQL client tools (see "If psql is not found" section above)

---

### Issue: "Permission denied" (Linux/Mac)

**Solution:**
```bash
chmod +x migrations/apply_all_migrations.sh
```

---

### Issue: "Execution Policy" error (Windows PowerShell)

**Solution:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

### Issue: Path separators (\\ vs /)

**Windows:** Use backslashes `\` in paths  
**Linux/Mac:** Use forward slashes `/` in paths

If script doesn't work, try the manual migration method above.

---

## 🎯 Quick Reference

### Linux/Mac
```bash
export DATABASE_URL="postgresql://user:pass@host:port/database"
chmod +x migrations/apply_all_migrations.sh
./migrations/apply_all_migrations.sh
```

### Windows (Batch)
```batch
set DATABASE_URL=postgresql://user:pass@host:port/database
migrations\apply_all_migrations.bat
```

### Windows (PowerShell)
```powershell
$env:DATABASE_URL = "postgresql://user:pass@host:port/database"
.\migrations\apply_all_migrations.ps1
```

---

## ✅ Success Indicators

After running the migration script, you should see:

```
==========================================
All migrations applied successfully!
==========================================

Verifying database state...

                Table "public.recruitment_candidates"
      Column      |            Type             | ...
------------------+-----------------------------+ ...
 id               | text                        | ...
 file_no          | text                        | ...
 ...
 is_delete        | boolean                     | ... ← Should exist
 ...

Migration complete!
```

---

## 📞 Still Having Issues?

1. **Check DATABASE_URL format:**
   ```
   postgresql://username:password@hostname:port/database_name
   ```

2. **Test database connection:**
   ```bash
   # Linux/Mac
   psql $DATABASE_URL -c "SELECT 1;"
   
   # Windows (Batch)
   psql "%DATABASE_URL%" -c "SELECT 1;"
   
   # Windows (PowerShell)
   psql $env:DATABASE_URL -c "SELECT 1;"
   ```

3. **Use manual migration** (see "Manual Migration" section above)

4. **Check PostgreSQL logs** for specific errors

5. **Refer to:** `DEVELOPER_MIGRATION_GUIDE.md` for detailed troubleshooting

---

**Last Updated:** November 19, 2025  
**Supported OS:** Linux, macOS, Windows (Batch + PowerShell)  
**All Scripts Tested:** ✅
