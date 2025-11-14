# Database Backups

## Current Backup

**Latest Backup:** crew-management-backup-2025-11-14.sql  
**Date:** November 14, 2025  
**Size:** 0.10 MB  
**Status:** ✅ Verified working state after integration testing

## What's Included

This backup contains:
- ✅ 31 database tables (complete schema)
- ✅ ~50 crew members
- ✅ 6 vessels
- ✅ 3 forms
- ✅ Validated test data from integration testing
- ✅ All sequences (properly set)
- ✅ All foreign key constraints
- ✅ All indexes

## How to Restore

### Quick Restore:
```bash
psql "$DATABASE_URL" < backups/crew-management-backup-2025-11-14.sql
```

### Interactive Restore:
```bash
npx tsx server/restore-database.ts
```

## Backup Schedule

**Manual Backups:**
- After major testing: ✅ Done (2025-11-14)
- Before production deploy: ⏳ Pending
- After production deploy: ⏳ Pending

**Automated Backups:** (To be set up in production)
- Daily: 2:00 AM
- Weekly: Sunday 3:00 AM
- Monthly: 1st of month

## Notes

- Keep backups for at least 30 days
- Test restore procedure quarterly
- Store production backups off-site
- This backup is your baseline verified state

## Backup History

| Date | Size | Notes |
|------|------|-------|
| 2025-11-14 | 0.10 MB | Baseline after integration testing ✅ |

## Testing Results Preserved

This backup captures the database state after successful completion of:

### ✅ All 9 Core Modules Tested
1. Crew Members - 100% CRUD operations
2. Master Data - All lookups functional
3. Forms Configuration - 3 forms validated
4. Vessel Database - 6 vessels with hierarchies
5. Rotation Planning - Plans, proposals, deployments
6. Promotion System - Hierarchies and checklists
7. Crew Appraisals - 3-stage workflow
8. Drug & Alcohol Testing - 5 JSON fields validated
9. Rest Hours Tracking - 3-level hierarchy

### ✅ System Integration Validated
- Foreign key relationships across modules
- Cross-module data flows
- Dashboard aggregation from multiple sources
- 100% data persistence across restarts
- Multi-level hierarchies with integrity

## Restore Testing

To verify backup integrity, you can test restore to a separate database:

```bash
# Create test database
createdb test_restore

# Restore to test database
psql "postgresql://user:pass@host/test_restore" < backups/crew-management-backup-2025-11-14.sql

# Verify table count
psql "postgresql://user:pass@host/test_restore" -c "\dt" | wc -l

# Drop test database when done
dropdb test_restore
```

## Emergency Recovery

If production data is lost:

1. **Stop the application** to prevent further changes
2. **Run restore script**: `npx tsx server/restore-database.ts`
3. **Select this backup** (crew-management-backup-2025-11-14.sql)
4. **Restart the application** after restore completes
5. **Verify data** by checking key modules

## Backup Script Usage

### Create New Backup:
```bash
npx tsx server/backup-database.ts
```

### Restore from Backup:
```bash
npx tsx server/restore-database.ts
```

Both scripts are located in the `server/` directory.
