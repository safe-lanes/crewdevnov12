# Ship-Shore Sync — Simplified Technical Guide

> **Audience:** Junior developers  
> **Stack:** React (frontend) + Node.js/Express (backend) + PostgreSQL (database)  
> **Goal:** Understand the sync system and replicate it in a new project

---

## Table of Contents

1. [What Is This Sync?](#1-what-is-this-sync)
2. [The Big Picture (Flow Diagram)](#2-the-big-picture)
3. [How Sync Works — Step by Step](#3-how-sync-works--step-by-step)
4. [Key Components (Files, Functions, Tables)](#4-key-components)
5. [Database Tables You Need](#5-database-tables-you-need)
6. [Code Snippets for Every Part](#6-code-snippets-for-every-part)
7. [How to Replicate This in a New Project](#7-how-to-replicate-this-in-a-new-project)
8. [Gotchas, Edge Cases & Things to Watch Out For](#8-gotchas-edge-cases--things-to-watch-out-for)
9. [Deep Dive: How Field Change Tracking Works](#9-deep-dive-how-field-change-tracking-works)
10. [Deep Dive: File Transfer with Real Example](#10-deep-dive-file-transfer-with-real-example)
11. [Glossary](#11-glossary)

---

## 1. What Is This Sync?

Imagine two computers that need to share data:

- **Shore Server** = The office computer (manages the entire fleet of ships)
- **Ship Server** = A ship's onboard computer (operates offline at sea)

Ships go out to sea and lose internet. While offline, both the ship crew AND the office staff make changes to the same data (work orders, defects, spare parts, etc.). When the ship gets internet again, the **sync system** merges all changes from both sides.

### Three Types of Data

| Type | Direction | Example | How it works |
|------|-----------|---------|--------------|
| **ONE_WAY** (Shore → Ship) | Office sends, ship receives | Component definitions, job templates | Ship gets overwritten — office is always right |
| **BOTH_EDITABLE** | Both sides can edit | Work orders, defects, spare stock | Field-by-field merge with conflict detection |
| **SHIP_ONLY** (Ship → Shore) | Ship sends, office receives | Noon reports | Office gets overwritten — ship is always right |

### The Core Idea

Instead of syncing entire database rows, the system tracks **individual field changes**. When you update a work order's `remarks` field, only that one field change is recorded and synced — not the whole row. This is called **field-level delta sync**.

---

## 2. The Big Picture

### End-to-End Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        SHORE SERVER (Office)                      │
│                                                                    │
│   React Frontend ──→ Express API ──→ PostgreSQL Database           │
│   (SyncDashboard)    (sync routes)   (all fleet data)              │
│                          ↕                                         │
│                     SyncEngine ←──── shared/syncConfig.ts           │
│                     SyncService      (table classifications)       │
│                     Repository                                     │
└──────────────────────────────────────────────────────────────────┘
                              ↕
                    HTTP/JSON over internet
                    (5 API endpoints)
                              ↕
┌──────────────────────────────────────────────────────────────────┐
│                        SHIP SERVER (Vessel)                       │
│                                                                    │
│   React Frontend ──→ Express API ──→ PostgreSQL Database           │
│   (SyncDashboard)    (sync routes)   (this vessel's data)          │
│                          ↕                                         │
│                     SyncEngine ←──── shared/syncConfig.ts           │
│                     SyncService      (same config file!)           │
│                     Repository                                     │
└──────────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Same codebase runs on both sides.** The only difference is the `SYNC_INSTANCE_ID` environment variable: `SHORE-PROD` vs `SHIP-VESSEL01`. The code checks this prefix to know which role it plays.

### Sync Cycle Flow (What Happens When You Press "Sync Now")

```
  SHIP SERVER                                    SHORE SERVER
      │                                              │
      │  ① POST /sync/initiate ──────────────────►   │
      │     "Hey, I want to sync"                     │
      │  ◄── { batchUuid: "abc-123" } ───────────    │
      │                                              │
      │  ② POST /sync/push ──────────────────────►   │
      │     "Here are MY changes"                     │
      │     (ship-only rows + field logs)             │
      │  ◄── { received: 42 } ───────────────────    │
      │                                              │
      │  ③ POST /sync/pull ──────────────────────►   │
      │     "Give me YOUR changes"                    │
      │  ◄── { oneWayRows, fieldLogs, conflicts } ─  │
      │                                              │
      │  ④ POST /sync/complete ──────────────────►   │
      │     "All done, advance checkpoint"            │
      │  ◄── { newCheckpoint: "2026-06-15T..." } ──  │
      │                                              │
      │  ⑤ POST /sync/file/upload-chunk ─────────►   │
      │     (binary files, if any)                    │
      │                                              │
```

---

## 3. How Sync Works — Step by Step

### Step 1: INITIATE — "Start a sync session"

**What happens:**
1. The ship's `SyncEngine` sends its `instanceId`, `vesselId`, and `lastCheckpoint` (timestamp of last successful sync) to shore
2. Shore creates a row in the `sync_batches` table with status `in_progress`
3. Shore returns a unique `batchUuid` that identifies this sync session

**Why it matters:** The `batchUuid` ties all subsequent steps together. If anything fails, the batch is marked `failed` and you can retry.

### Step 2: PUSH — "Send my changes to shore"

**What happens:**
1. Ship gathers **SHIP_ONLY rows** (e.g., noon reports) changed since last checkpoint
2. Ship gathers **BOTH_EDITABLE field logs** — these are individual field changes (e.g., "work_orders row ABC, field 'remarks', changed from 'old text' to 'new text'")
3. Ship sends everything to shore in chunks of 200 records
4. Shore stores the field logs and applies SHIP_ONLY rows (overwrite)

**The field log is the secret sauce.** Every time someone edits a BOTH_EDITABLE table, the `fieldLogger.ts` writes one entry per changed field to the `sync_field_log` table.

### Step 3: PULL — "Get shore's changes"

**What happens:**
1. Ship asks shore for all changes since the last checkpoint
2. Shore gathers:
   - **ONE_WAY rows** — full snapshots of shore-managed tables that changed
   - **Shore's field logs** — field changes shore made to BOTH_EDITABLE tables
   - **Conflicts** — fields that BOTH sides changed between syncs
3. Ship applies the changes:
   - ONE_WAY rows: overwrite local data (shore is boss)
   - Field logs with new rows: INSERT the new row
   - Field logs with existing rows: UPDATE only the specific fields that changed
   - Conflicts: store for manual resolution

### Step 4: COMPLETE — "Mark sync as done"

**What happens:**
1. All field logs involved in this sync get marked as `is_synced = true`
2. The checkpoint timestamp advances to "now" so next sync only grabs newer changes
3. The batch status changes from `in_progress` to `completed`

### Step 5: FILE SYNC — "Transfer binary files"

**What happens (after field data is synced):**
1. Any binary files (work order documents, component documents) queued in `sync_file_queue` get transferred
2. Files are chunked into 256KB pieces, base64-encoded, with SHA-256 hash verification
3. File sync failure is **non-fatal** — the field data is already safe

---

## 4. Key Components

### Backend Files (all under `server/modules/sync/`)

| File | What It Does | Think of it as... |
|------|-------------|-------------------|
| [syncEngine.ts](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/server/modules/sync/syncEngine.ts) | **The conductor.** Runs the full INITIATE→PUSH→PULL→COMPLETE cycle | The main loop |
| [service.ts](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/server/modules/sync/service.ts) | **The brain.** Business logic for each sync step (how to merge, detect conflicts) | The logic layer |
| [repository.ts](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/server/modules/sync/repository.ts) | **The memory.** Database queries for sync infrastructure tables | The data layer |
| [controller.ts](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/server/modules/sync/controller.ts) | **The receptionist.** Express request handlers for all 33 API endpoints | HTTP handlers |
| [routes.ts](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/server/modules/sync/routes.ts) | **The directory.** Maps URL paths to controller functions | Route config |
| [fieldLogger.ts](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/server/modules/sync/fieldLogger.ts) | **The spy.** Logs every field change on BOTH_EDITABLE tables | Change tracker |
| [oneWayApplier.ts](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/server/modules/sync/oneWayApplier.ts) | **The overwriter.** Applies one-way rows (upsert by UUID) and INSERT from field logs | Data applier |
| [fileSyncProcessor.ts](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/server/modules/sync/fileSyncProcessor.ts) | **The courier.** Handles chunked binary file transfer | File transfer |
| [healthMonitor.ts](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/server/modules/sync/healthMonitor.ts) | **The doctor.** Detects stale syncs, stuck files, overflow | Health checks |
| [pruningService.ts](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/server/modules/sync/pruningService.ts) | **The janitor.** Cleans up old sync logs, batches, conflicts | Cleanup service |
| [provisioningService.ts](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/server/modules/sync/provisioningService.ts) | **The starter kit.** Generates/imports initial data bundles for new ships | Initial setup |

### Shared Configuration

| File | What It Does |
|------|-------------|
| [shared/syncConfig.ts](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/shared/syncConfig.ts) | **The rulebook.** Classifies every database table into ONE_WAY / BOTH_EDITABLE / SHIP_ONLY / NO_SYNC. This is THE source of truth. |

### Frontend Components

| File | Route | What It Does |
|------|-------|-------------|
| [SyncDashboard.tsx](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/client/src/pages/admin/SyncDashboard.tsx) | `/admin/sync-dashboard` | Manual sync trigger, batch history, conflict viewer |
| [SyncProvisioning.tsx](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/client/src/pages/admin/SyncProvisioning.tsx) | `/admin/sync-provisioning` | Generate/import data bundles for ships |
| [SyncFleetOverview.tsx](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/client/src/pages/admin/SyncFleetOverview.tsx) | `/admin/sync-fleet` | Shore-only fleet monitoring + settings |
| [SyncConflictReview.tsx](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/client/src/pages/admin/SyncConflictReview.tsx) | `/admin/sync-conflicts` | Conflict review: apply/dismiss, bulk actions |
| [useSyncInstanceInfo.ts](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/client/src/hooks/useSyncInstanceInfo.ts) | — | React hook: detects if this is a ship or shore instance |

### Key API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/sync/initiate` | POST | Start a sync batch |
| `/sync/push` | POST | Ship pushes its changes |
| `/sync/pull` | POST | Ship pulls shore's changes |
| `/sync/complete` | POST | Finish batch, advance checkpoint |
| `/sync/trigger` | POST | Manually trigger a sync cycle |
| `/sync/instance-info` | GET | Am I a ship or shore? |
| `/sync/health` | GET | Is sync healthy? |
| `/sync/settings` | GET/PUT | Read/update sync settings |
| `/sync/file/upload-chunk` | POST | Upload a file chunk |

---

## 5. Database Tables You Need

### Sync Infrastructure Tables (the sync engine's own data)

#### `sync_field_log` — The Heart of the System

This table records **every individual field change** on BOTH_EDITABLE tables.

```sql
CREATE TABLE sync_field_log (
  id            SERIAL PRIMARY KEY,
  sfl_uuid      UUID DEFAULT gen_random_uuid(),
  table_name    TEXT NOT NULL,          -- e.g., 'work_orders'
  row_uuid      TEXT NOT NULL,          -- UUID of the row that changed
  field_name    TEXT NOT NULL,          -- e.g., 'remarks'
  old_value     TEXT,                   -- previous value (NULL for INSERT)
  new_value     TEXT,                   -- new value
  vessel_id     TEXT,                   -- which vessel this belongs to
  changed_at    TIMESTAMPTZ NOT NULL,   -- when the change happened
  changed_by_user_id TEXT,             -- who made the change
  instance_id   TEXT NOT NULL,          -- e.g., 'SHIP-VESSEL01' or 'SHORE-PROD'
  is_synced     BOOLEAN DEFAULT false,  -- flipped to TRUE after successful sync
  synced_batch_uuid TEXT,              -- which batch synced this entry
  is_deleted    BOOLEAN DEFAULT false
);

-- Essential indexes
CREATE INDEX idx_sfl_unsynced ON sync_field_log (instance_id, vessel_id)
  WHERE is_synced = false;
CREATE INDEX idx_sfl_checkpoint ON sync_field_log (changed_at, vessel_id)
  WHERE is_synced = false;
```

#### `sync_batches` — Sync History

```sql
CREATE TABLE sync_batches (
  id                    SERIAL PRIMARY KEY,
  batch_uuid            UUID DEFAULT gen_random_uuid() UNIQUE,
  initiated_by_instance TEXT NOT NULL,
  vessel_id             TEXT,
  status                TEXT DEFAULT 'in_progress', -- 'in_progress', 'completed', 'failed'
  started_at            TIMESTAMPTZ DEFAULT NOW(),
  completed_at          TIMESTAMPTZ,
  checkpoint_before     TIMESTAMPTZ,
  checkpoint_after      TIMESTAMPTZ,
  records_sent          INTEGER DEFAULT 0,
  records_received      INTEGER DEFAULT 0,
  conflicts_found       INTEGER DEFAULT 0,
  conflicts_resolved    INTEGER DEFAULT 0,
  duration_ms           INTEGER,
  error_message         TEXT,
  is_deleted            BOOLEAN DEFAULT false
);
```

#### `sync_metadata` — Where Are We?

```sql
CREATE TABLE sync_metadata (
  id                    SERIAL PRIMARY KEY,
  instance_id           TEXT UNIQUE NOT NULL,
  vessel_id             TEXT,
  last_sync_at          TIMESTAMPTZ,
  last_sync_status      TEXT,  -- 'success', 'failed', 'in_progress'
  last_sync_checkpoint  TIMESTAMPTZ,  -- data synced UP TO this point
  sync_direction        TEXT DEFAULT 'bidirectional',
  is_deleted            BOOLEAN DEFAULT false
);
```

#### `sync_conflicts` — Disagreements

```sql
CREATE TABLE sync_conflicts (
  id               SERIAL PRIMARY KEY,
  conflict_uuid    UUID DEFAULT gen_random_uuid(),
  table_name       TEXT NOT NULL,
  row_uuid         TEXT NOT NULL,
  field_name       TEXT NOT NULL,
  ship_value       TEXT,
  ship_changed_at  TIMESTAMPTZ,
  ship_changed_by  TEXT,
  shore_value      TEXT,
  shore_changed_at TIMESTAMPTZ,
  shore_changed_by TEXT,
  resolution       TEXT,     -- NULL, 'ship_wins', 'shore_wins', 'manual', 'auto_same_value'
  resolved_value   TEXT,
  resolved_at      TIMESTAMPTZ,
  resolved_by      TEXT,
  vessel_id        TEXT,
  sync_batch_id    TEXT,
  is_deleted       BOOLEAN DEFAULT false
);
```

#### `sync_settings` — Configuration

```sql
CREATE TABLE sync_settings (
  id            SERIAL PRIMARY KEY,
  ssuuid        UUID DEFAULT gen_random_uuid(),
  setting_key   TEXT UNIQUE NOT NULL,
  setting_value TEXT,
  setting_type  TEXT DEFAULT 'string',  -- 'string', 'number', 'boolean'
  description   TEXT,
  is_editable   BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  is_deleted    BOOLEAN DEFAULT false
);

-- Seed default settings
INSERT INTO sync_settings (setting_key, setting_value, setting_type, description) VALUES
  ('shore_url',              '',      'string',  'Shore server base URL'),
  ('instance_id',            'SHORE-DEV', 'string', 'This instance unique ID'),
  ('sync_interval_minutes',  '60',    'number',  'Auto-sync interval'),
  ('auto_sync_enabled',      'false', 'boolean', 'Enable automatic sync'),
  ('local_mode',             'true',  'boolean', 'Direct function calls (no HTTP)'),
  ('max_retries',            '3',     'number',  'Max retry attempts'),
  ('chunk_size',             '200',   'number',  'Records per sync chunk'),
  ('request_timeout_seconds','30',    'number',  'HTTP request timeout'),
  ('field_log_retention_days','90',   'number',  'Pruning: field log retention'),
  ('batch_retention_days',   '365',   'number',  'Pruning: batch retention');
```

### Required Trigger — Bypass for Sync

Every table needs an `updated_at` trigger for change detection, but sync needs to bypass it:

```sql
-- The trigger function (applied to ALL your data tables)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    -- When sync is applying changes, skip the automatic timestamp
    -- so the original changedAt is preserved
    IF current_setting('sync.bypass_trigger', true) = 'true' THEN
        RETURN NEW;
    END IF;
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to each data table:
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- Repeat for ALL synced tables...
```

---

## 6. Code Snippets for Every Part

### 6.1 Table Classification Config (`shared/syncConfig.ts`)

This is the central registry. Every table must be classified here:

```typescript
// shared/syncConfig.ts

export type SyncCategory =
  | 'ONE_WAY_SHORE_TO_SHIP'
  | 'BOTH_EDITABLE'
  | 'SHIP_ONLY'
  | 'NO_SYNC';

export interface TableSyncConfig {
  tableName: string;
  category: SyncCategory;
  identityColumn: string | null;      // UUID column for cross-instance identity
  vesselScopeColumn: string | null;    // Column to filter by vessel
  isGlobal: boolean;                   // true = not vessel-specific
  businessRules: string | null;        // e.g., "only shore can verify"
}

export const SYNC_CONFIG: Record<string, TableSyncConfig> = {
  // ONE_WAY: Shore is boss
  components: {
    tableName: 'components',
    category: 'ONE_WAY_SHORE_TO_SHIP',
    identityColumn: 'cuuid',
    vesselScopeColumn: 'vessel_id',
    isGlobal: false,
    businessRules: null,
  },

  // BOTH_EDITABLE: Both sides can edit
  work_orders: {
    tableName: 'work_orders',
    category: 'BOTH_EDITABLE',
    identityColumn: 'wouuid',
    vesselScopeColumn: 'vessel_id',
    isGlobal: false,
    businessRules: null,
  },

  defects: {
    tableName: 'defects',
    category: 'BOTH_EDITABLE',
    identityColumn: 'duuid',
    vesselScopeColumn: 'vessel_id',
    isGlobal: false,
    businessRules: 'Only shore can set status=verified',
  },

  // SHIP_ONLY: Ship is boss
  nr_noon_reports: {
    tableName: 'nr_noon_reports',
    category: 'SHIP_ONLY',
    identityColumn: 'nruuid',
    vesselScopeColumn: 'vessel_id',
    isGlobal: false,
    businessRules: null,
  },

  // NO_SYNC: Never synced
  users: {
    tableName: 'users',
    category: 'NO_SYNC',
    identityColumn: null,
    vesselScopeColumn: null,
    isGlobal: true,
    businessRules: null,
  },
};

// ── Helper functions ──

export function getTablesByCategory(category: SyncCategory): TableSyncConfig[] {
  return Object.values(SYNC_CONFIG).filter(t => t.category === category);
}

export function getTableSyncConfig(tableName: string): TableSyncConfig | undefined {
  return SYNC_CONFIG[tableName];
}

export function requiresFieldLogging(tableName: string): boolean {
  return SYNC_CONFIG[tableName]?.category === 'BOTH_EDITABLE';
}

export function getIdentityColumn(tableName: string): string | null {
  return SYNC_CONFIG[tableName]?.identityColumn ?? null;
}
```

### 6.2 Field Logger (`server/modules/sync/fieldLogger.ts`)

This is called by your service layer **every time** you INSERT or UPDATE a BOTH_EDITABLE table:

```typescript
// server/modules/sync/fieldLogger.ts

import { requiresFieldLogging } from '../../shared/syncConfig';
import { pool } from '../db'; // your PostgreSQL pool

const SKIP_FIELDS = new Set([
  'updated_at', 'created_at', 'is_sync',
]);

// Serialize values safely (handles JSON objects, dates, etc.)
function serializeValue(value: any): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Log field-level changes for sync.
 *
 * Call AFTER every INSERT, UPDATE, or soft-DELETE on BOTH_EDITABLE tables.
 *
 * @param tableName  - e.g., 'work_orders'
 * @param rowUuid    - UUID identifying this row across instances
 * @param vesselId   - vessel scope (null for global tables)
 * @param oldRow     - previous row state (null for INSERT)
 * @param newRow     - new row state
 * @param userId     - who made the change
 */
export async function logFieldChanges(
  tableName: string,
  rowUuid: string,
  vesselId: string | null,
  oldRow: Record<string, any> | null,
  newRow: Record<string, any> | null,
  userId: string | null
): Promise<number> {
  // Only log for BOTH_EDITABLE tables
  if (!requiresFieldLogging(tableName)) return 0;
  if (!rowUuid) return 0;

  const instanceId = process.env.SYNC_INSTANCE_ID || 'UNKNOWN';
  const changedAt = new Date();
  let logCount = 0;

  if (oldRow === null && newRow !== null) {
    // ── INSERT: log all non-null fields ──
    for (const [fieldName, newValue] of Object.entries(newRow)) {
      if (SKIP_FIELDS.has(fieldName) || newValue == null) continue;

      await pool.query(
        `INSERT INTO sync_field_log
         (table_name, row_uuid, field_name, old_value, new_value,
          vessel_id, changed_at, changed_by_user_id, instance_id, is_synced)
         VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8, false)`,
        [tableName, rowUuid, fieldName, serializeValue(newValue),
         vesselId, changedAt, userId, instanceId]
      );
      logCount++;
    }
  } else if (oldRow !== null && newRow !== null) {
    // ── UPDATE: log only changed fields ──
    const allKeys = new Set([...Object.keys(oldRow), ...Object.keys(newRow)]);

    for (const key of allKeys) {
      if (SKIP_FIELDS.has(key)) continue;

      const oldStr = serializeValue(oldRow[key]);
      const newStr = serializeValue(newRow[key]);
      if (oldStr === newStr) continue; // No change

      await pool.query(
        `INSERT INTO sync_field_log
         (table_name, row_uuid, field_name, old_value, new_value,
          vessel_id, changed_at, changed_by_user_id, instance_id, is_synced)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)`,
        [tableName, rowUuid, key, oldStr, newStr,
         vesselId, changedAt, userId, instanceId]
      );
      logCount++;
    }
  }

  return logCount;
}

// Convenience: log a soft-delete
export async function logSoftDelete(
  tableName: string, rowUuid: string,
  vesselId: string | null, userId: string | null
): Promise<void> {
  await logFieldChanges(
    tableName, rowUuid, vesselId,
    { is_deleted: false },
    { is_deleted: true },
    userId
  );
}
```

### 6.3 How to Wire Field Logging (in your service layer)

```typescript
// server/services/workOrderService.ts

import { logFieldChanges } from '../modules/sync/fieldLogger';

// ── After INSERT ──
async function createWorkOrder(data: any, vesselId: string, userId: string) {
  const newRow = await db.insert(workOrders).values(data).returning();
  // 👇 Log all fields (oldRow = null means INSERT)
  await logFieldChanges('work_orders', newRow.wouuid, vesselId, null, newRow, userId);
  return newRow;
}

// ── After UPDATE ──
async function updateWorkOrder(id: string, updates: any, vesselId: string, userId: string) {
  // 1. Fetch the BEFORE state
  const oldRow = await db.select().from(workOrders).where(eq(workOrders.wouuid, id));
  // 2. Apply the update
  const newRow = await db.update(workOrders).set(updates).where(eq(workOrders.wouuid, id)).returning();
  // 3. 👇 Log only the fields that actually changed
  await logFieldChanges('work_orders', id, vesselId, oldRow, newRow, userId);
  return newRow;
}

// ── After soft-DELETE ──
async function deleteWorkOrder(id: string, vesselId: string, userId: string) {
  await db.update(workOrders).set({ is_deleted: true }).where(eq(workOrders.wouuid, id));
  await logSoftDelete('work_orders', id, vesselId, userId);
}
```

### 6.4 Sync Engine — The Main Orchestrator

```typescript
// server/modules/sync/syncEngine.ts (simplified)

export class SyncEngine {
  private instanceId: string;
  private shoreBaseUrl: string;

  constructor() {
    this.instanceId = process.env.SYNC_INSTANCE_ID || 'UNKNOWN';
    this.shoreBaseUrl = process.env.SYNC_SHORE_URL || '';
  }

  async runSync(vesselId: string): Promise<SyncResult> {
    const startTime = Date.now();
    let batchUuid: string | null = null;

    try {
      // ① INITIATE
      const initResult = await this.callApi('POST', '/sync/initiate', {
        instanceId: this.instanceId,
        vesselId,
        lastCheckpoint: await this.getLastCheckpoint(),
      });
      batchUuid = initResult.batchUuid;

      // ② PUSH — send our changes
      const pushResult = await this.executePush(batchUuid, vesselId);

      // ③ PULL — get their changes
      const pullResult = await this.executePull(batchUuid, vesselId);

      // ④ COMPLETE — advance checkpoint
      const completeResult = await this.callApi('POST', '/sync/complete', {
        batchUuid, vesselId, instanceId: this.instanceId,
      });

      // ⑤ Mark our pushed logs as synced locally
      await this.markLocalLogsSynced(pushResult.logUuids, batchUuid);

      // ⑥ File sync (non-fatal)
      try {
        await this.processFileQueue(vesselId, batchUuid);
      } catch { /* file sync failure is OK */ }

      return { success: true, /* ... counts ... */ };
    } catch (error) {
      if (batchUuid) await this.markBatchFailed(batchUuid, error);
      return { success: false, error: error.message };
    }
  }
}
```

### 6.5 Sync API Endpoints (Express Routes)

```typescript
// server/modules/sync/routes.ts

import { Router } from 'express';
import * as ctrl from './controller';

const router = Router();

// Core sync protocol (5 endpoints)
router.post('/sync/initiate', ctrl.initiateSyncHandler);
router.post('/sync/push',     ctrl.pushHandler);
router.post('/sync/pull',     ctrl.pullHandler);
router.post('/sync/complete', ctrl.completeSyncHandler);

// Manual trigger
router.post('/sync/trigger',  ctrl.triggerSyncHandler);

// Admin info
router.get('/sync/instance-info', ctrl.instanceInfoHandler);
router.get('/sync/health',        ctrl.healthCheckHandler);
router.get('/sync/status',        ctrl.statusHandler);
router.get('/sync/batches',       ctrl.recentBatchesHandler);

// Settings
router.get('/sync/settings',  ctrl.getSettingsHandler);
router.put('/sync/settings',  ctrl.updateSettingsHandler);

export default router;
```

### 6.6 Controller — Trigger Sync Handler

```typescript
// server/modules/sync/controller.ts (simplified)

import { SyncEngine } from './syncEngine';

const engine = new SyncEngine();

export async function triggerSyncHandler(req, res) {
  const { vesselId } = req.body;

  if (!vesselId) {
    return res.status(400).json({ error: 'vesselId is required' });
  }

  const result = await engine.runSync(vesselId);

  res.json({
    success: result.success,
    batchUuid: result.batchUuid,
    recordsPushed: result.recordsPushed,
    recordsPulled: result.recordsPulled,
    conflictsFound: result.conflictsFound,
    durationMs: result.durationMs,
    error: result.error,
  });
}

export async function instanceInfoHandler(req, res) {
  const instanceId = process.env.SYNC_INSTANCE_ID || 'UNKNOWN';
  const isShip = instanceId.startsWith('SHIP-');
  const isShore = instanceId.startsWith('SHORE-');

  res.json({
    instanceId,
    isShip,
    isShore,
    instanceType: isShip ? 'ship' : 'shore',
  });
}
```

### 6.7 Frontend — Sync Dashboard (React)

```tsx
// client/src/pages/admin/SyncDashboard.tsx (simplified)

import { useSyncInstanceInfo } from '@/hooks/useSyncInstanceInfo';

export default function SyncDashboard() {
  const { instanceId, isShip, isShore } = useSyncInstanceInfo();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);

  const triggerSync = async (vesselId: string) => {
    setSyncing(true);
    try {
      const res = await fetch('/technical/api/sync/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vesselId }),
      });
      const data = await res.json();
      setResult(data);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <h1>Sync Dashboard</h1>
      <p>Instance: {instanceId} ({isShip ? 'Ship' : 'Shore'})</p>

      <button onClick={() => triggerSync('YOUR_VESSEL_UUID')} disabled={syncing}>
        {syncing ? 'Syncing...' : 'Sync Now'}
      </button>

      {result && (
        <div>
          <p>Status: {result.success ? '✅ Success' : '❌ Failed'}</p>
          <p>Pushed: {result.recordsPushed} | Pulled: {result.recordsPulled}</p>
          <p>Conflicts: {result.conflictsFound}</p>
        </div>
      )}
    </div>
  );
}
```

### 6.8 Frontend — Ship/Shore Detection Hook

```tsx
// client/src/hooks/useSyncInstanceInfo.ts

import { useQuery } from '@tanstack/react-query';

export function useSyncInstanceInfo() {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/sync/instance-info'],
    queryFn: async () => {
      const res = await fetch('/api/sync/instance-info');
      return res.json();
    },
    staleTime: Infinity, // Never refetch — instance type doesn't change
  });

  return {
    isShip: data?.isShip ?? false,
    isShore: data?.isShore ?? true,
    instanceId: data?.instanceId ?? 'UNKNOWN',
    isLoading,
  };
}
```

### 6.9 Trigger Bypass Pattern (used during sync apply)

When sync applies field logs to your data tables, you need to preserve the original `changedAt` timestamp instead of letting the `updated_at` trigger overwrite it:

```typescript
// Inside syncEngine.ts executePull() or service.ts receivePushData()

const pool = await getPool();
const client = await pool.connect();  // Get a dedicated connection
try {
  await client.query('BEGIN');
  // ⚡ Tell the trigger to stand down for THIS transaction only
  await client.query("SET LOCAL sync.bypass_trigger = 'true'");

  // Phase 1: INSERT new rows from field logs
  for (const log of insertLogs) {
    await client.query(
      `INSERT INTO "${log.tableName}" (${columns}) VALUES (${values})`,
      params
    );
  }

  // Phase 2: UPDATE existing rows with field changes
  for (const log of updateLogs) {
    await client.query(
      `UPDATE "${log.tableName}"
       SET "${log.fieldName}" = $1, updated_at = $3
       WHERE "${identityCol}" = $2`,
      [log.newValue, log.rowUuid, log.changedAt]
    );
  }

  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();  // Return connection to pool
}
```

> [!IMPORTANT]
> `SET LOCAL` only affects the current transaction. It automatically goes away on COMMIT or ROLLBACK. Other database connections are never affected.

---

## 7. How to Replicate This in a New Project

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | v22+ |
| PostgreSQL | 14+ |
| React | 18+ with React Query |

### Step-by-Step Setup

#### Step 1: Create the Sync Infrastructure Tables

Run the SQL from [Section 5](#5-database-tables-you-need) to create:
- `sync_field_log`
- `sync_batches`
- `sync_metadata`
- `sync_conflicts`
- `sync_settings`

Add the `set_updated_at()` trigger function and apply it to **every table** you want to sync.

#### Step 2: Create the Table Classification Config

Create `shared/syncConfig.ts` (see [Section 6.1](#61-table-classification-config-sharedsyncconfigs)).

For each of your application's tables, decide:
- **ONE_WAY:** Only one side controls this data
- **BOTH_EDITABLE:** Both sides can edit it
- **SHIP_ONLY:** Only the remote side controls this
- **NO_SYNC:** Local-only data

#### Step 3: Create the Field Logger

Create `server/modules/sync/fieldLogger.ts` (see [Section 6.2](#62-field-logger-servermodulessyncfieldloggerts)).

#### Step 4: Wire Field Logging to Every Write Path

For **every** INSERT, UPDATE, and DELETE on BOTH_EDITABLE tables, add `logFieldChanges()` calls.

**This is the most tedious but most critical step.** If you miss a write path, those changes will never sync.

```
Rule: If it writes to a BOTH_EDITABLE table, it MUST call logFieldChanges().
```

#### Step 5: Create the Sync Engine

Create `server/modules/sync/syncEngine.ts` (see [Section 6.4](#64-sync-engine--the-main-orchestrator)).

#### Step 6: Create the Service Layer

This handles the business logic for each sync step:

```typescript
// server/modules/sync/service.ts (key functions)

// Called by shore when ship POSTs /sync/initiate
export async function initiateSyncSession(instanceId, vesselId, lastCheckpoint) {
  // 1. Auto-register this ship if not yet known
  await upsertInstanceMetadata(instanceId, vesselId);
  // 2. Create a new batch
  const batchUuid = crypto.randomUUID();
  await pool.query(
    `INSERT INTO sync_batches (batch_uuid, initiated_by_instance, vessel_id, status)
     VALUES ($1, $2, $3, 'in_progress')`,
    [batchUuid, instanceId, vesselId]
  );
  return { batchUuid };
}

// Called by shore when ship POSTs /sync/push
export async function receivePushData(batchUuid, vesselId, payload) {
  // 1. Apply SHIP_ONLY rows (overwrite)
  for (const tableData of payload.oneWayRows) {
    await applyOneWayRows(tableData.tableName, tableData.rows);
  }
  // 2. Store + apply BOTH_EDITABLE field logs
  for (const log of payload.fieldLogs) {
    await storeFieldLog(log);       // save to sync_field_log
    await applyFieldLogToTable(log); // update the actual data table
  }
  return { received: payload.fieldLogs.length };
}

// Called by shore when ship POSTs /sync/pull
export async function preparePullData(batchUuid, vesselId, instanceId, lastCheckpoint) {
  // 1. Gather ONE_WAY rows changed since checkpoint
  const oneWayRows = await gatherOneWayShoreRows(vesselId, lastCheckpoint);
  // 2. Gather shore's own field logs (exclude ship's logs — ship already has those)
  const shoreFieldLogs = await getFieldLogsSinceCheckpoint(vesselId, lastCheckpoint);
  const filtered = shoreFieldLogs.filter(l => l.instanceId !== instanceId);
  // 3. Detect conflicts (same table + row + field changed on both sides)
  const { nonConflicting, conflicts } = detectConflicts(filtered, payload.fieldLogs);
  return { oneWayRows, fieldLogs: nonConflicting, conflicts };
}

// Called by shore when ship POSTs /sync/complete
export async function completeSyncSession(batchUuid, vesselId, instanceId) {
  // 1. Mark all transferred field logs as synced
  await markFieldLogsSynced(batchUuid);
  // 2. Advance the checkpoint
  const newCheckpoint = new Date();
  await upsertInstanceMetadata(instanceId, vesselId, newCheckpoint);
  // 3. Update batch status
  await pool.query(
    `UPDATE sync_batches SET status = 'completed', completed_at = NOW(),
     checkpoint_after = $2 WHERE batch_uuid = $1`,
    [batchUuid, newCheckpoint]
  );
  return { newCheckpoint: newCheckpoint.toISOString() };
}
```

#### Step 7: Create API Routes

Wire the routes as shown in [Section 6.5](#65-sync-api-endpoints-express-routes).

#### Step 8: Create the Frontend

Build a Sync Dashboard with:
- "Sync Now" button that calls `POST /sync/trigger`
- Batch history table
- Conflict viewer
- Ship/shore detection via `useSyncInstanceInfo` hook

#### Step 9: Set Environment Variables

**Shore Server (.env):**
```bash
SYNC_INSTANCE_ID=SHORE-PROD
SYNC_LOCAL_MODE=false
SYNC_API_KEY=your-strong-random-key
DATABASE_URL=postgres://user:pass@localhost:5432/pms_shore
```

**Ship Server (.env):**
```bash
SYNC_INSTANCE_ID=SHIP-VESSEL01
SYNC_SHORE_URL=https://your-shore-server.com/api
SYNC_LOCAL_MODE=false
SYNC_API_KEY=your-strong-random-key
DATABASE_URL=postgres://user:pass@localhost:5432/pms_ship
```

#### Step 10: Test Locally with Two Databases

```bash
# Create two databases
psql -c "CREATE DATABASE pms_shore;"
psql -c "CREATE DATABASE pms_ship;"

# Terminal 1 (Shore): PORT=5000
DATABASE_URL="postgres://...pms_shore" SYNC_INSTANCE_ID="SHORE-DEV" PORT=5000 npm run dev

# Terminal 2 (Ship): PORT=5001
DATABASE_URL="postgres://...pms_ship" SYNC_INSTANCE_ID="SHIP-TEST" \
  SYNC_SHORE_URL="http://localhost:5000/api" PORT=5001 npm run dev
```

---

## 8. Gotchas, Edge Cases & Things to Watch Out For

### 🔴 Critical Gotchas

| # | Gotcha | Why It Matters | How to Avoid |
|---|--------|---------------|--------------|
| 1 | **Missing `logFieldChanges` calls** | If a write path doesn't call `logFieldChanges`, those changes are invisible to sync — they will NEVER sync | Audit every INSERT/UPDATE/DELETE on BOTH_EDITABLE tables. Search your codebase for `db.update(`, `db.insert(` etc. and verify each one has a logging call |
| 2 | **Wrong `instance_id`** | If two ships share the same instance ID (e.g., both use the template `SHIP-VESSELNAME`), their field logs will collide | Always set a unique `SYNC_INSTANCE_ID` per server. Never use placeholders |
| 3 | **Forgetting trigger bypass** | Without `SET LOCAL sync.bypass_trigger = 'true'`, the `set_updated_at` trigger overrides `changedAt` with `NOW()`. This breaks the stale-skip guard and causes multi-field UPDATE batches to silently drop fields | Always wrap sync apply operations in a bypass transaction |
| 4 | **`vesselId` missing from field logs** | If field logs don't include `vesselId`, sync queries (`WHERE vessel_id = ...`) return 0 results | Always pass `vesselId` when calling `logFieldChanges` |

### 🟡 Important Edge Cases

| # | Edge Case | What Happens | Solution |
|---|-----------|-------------|----------|
| 5 | Both sides change the **same field** on the **same row** | A **conflict** is created in `sync_conflicts` | Show conflicts to users, let them pick `ship_wins` / `shore_wins` / `manual` |
| 6 | Both sides change to the **same value** | Auto-resolved as `auto_same_value` (no user action needed) | The engine handles this automatically |
| 7 | Ship is offline for months | `sync_field_log` accumulates thousands of entries | The health monitor warns at 100K entries. The pruning service cleans up old synced entries |
| 8 | Sync fails mid-cycle | Batch status = `failed`, checkpoint not advanced | Next sync retries from the same checkpoint. No data loss. |
| 9 | JSON/JSONB columns | `String({})` produces `[object Object]` — corrupts data | The field logger uses `JSON.stringify()` for objects (see `serializeValue()`) |
| 10 | Serial/auto-increment `id` columns | Ship's `id = 5` ≠ Shore's `id = 5` — they're different rows | Use UUID columns (`wouuid`, `duuid`, etc.) for cross-instance identity, never auto-increment `id` |
| 11 | Tables with text PK `id` (e.g., `D019-26-0023`) | The `id` field carries semantic meaning and MUST be synced | Don't skip `id` in field logging if it's a text PK. Only skip serial integer `id` |
| 12 | Large payloads (\>10MB) | Express default body limit rejects with HTTP 413 | Set `express.json({ limit: '50mb' })` |

### 🟢 Best Practices

| # | Practice | Why |
|---|----------|-----|
| 1 | Every UUID should be generated at creation time, not by the database sequence | UUIDs are the universal identity — they must be unique across all instances |
| 2 | Use `is_deleted` (soft delete) instead of `DELETE FROM` | Hard deletes can't be synced. Soft deletes log `is_deleted: true → false` as a field change |
| 3 | Keep `sync_field_log` indexed on `(instance_id, vessel_id) WHERE is_synced = false` | This is the hot query — the engine reads it on every sync |
| 4 | Test with two local databases before deploying | Run shore on port 5000, ship on port 5001, same machine |
| 5 | Log diagnostic output to files, not just console | Ship servers may be physically inaccessible — you need persistent logs |
| 6 | Make file sync non-fatal | Binary files are large and transfers can fail. Field data should sync regardless |

---

## 9. Deep Dive: How Field Change Tracking Works

### Does It Use Database Triggers? — NO

The system does **NOT** use PostgreSQL triggers to record field changes. It uses **application-level logging** — manual function calls in the Node.js service layer.

There is only **one** database trigger involved: the `set_updated_at()` trigger that auto-stamps `updated_at = NOW()` on every UPDATE. But that trigger does the *opposite* job — it's for change detection, not change recording. The sync engine actually needs to **bypass** it during sync apply.

### The Mechanism: `logFieldChanges()` in [fieldLogger.ts](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/server/modules/sync/fieldLogger.ts)

Developers **manually call** `logFieldChanges()` after every INSERT, UPDATE, or soft-DELETE on BOTH_EDITABLE tables.

### Real-World Example: Updating a Work Order

```
User clicks "Save" on a work order (changes remarks + status)
        ↓
React frontend:  POST /api/work-orders/:id  { remarks: "new text", status: "completed" }
        ↓
Express controller → workOrderService.ts
        ↓
Service layer does 3 things:
   1️⃣  Fetch the OLD row:  SELECT * FROM work_orders WHERE wouuid = 'abc-123'
   2️⃣  Apply the UPDATE:   UPDATE work_orders SET remarks = '...', status = '...' WHERE wouuid = 'abc-123'
   3️⃣  Call logFieldChanges('work_orders', 'abc-123', vesselId, oldRow, newRow, userId)
        ↓
logFieldChanges() compares oldRow vs newRow, field by field:
   - remarks:    "old text"  →  "new text"    ← CHANGED → log it
   - status:     "pending"   →  "completed"   ← CHANGED → log it
   - priority:   "high"      →  "high"        ← SAME → skip
   - assignee:   "user1"     →  "user1"       ← SAME → skip
   - updated_at: (skip — in SKIP_FIELDS set)
   - created_at: (skip — in SKIP_FIELDS set)
        ↓
INSERTs 2 rows into sync_field_log:
```

| table_name | row_uuid | field_name | old_value | new_value | instance_id | is_synced |
|---|---|---|---|---|---|---|
| work_orders | abc-123 | remarks | "old text" | "new text" | SHIP-VESSEL01 | false |
| work_orders | abc-123 | status | "pending" | "completed" | SHIP-VESSEL01 | false |

### How It Handles Different Operations

#### INSERT (new row)

```typescript
// oldRow = null tells the logger "this is a new row"
await logFieldChanges('work_orders', newRow.wouuid, vesselId, null, newRow, userId);
```

When `oldRow` is `null`, the logger records **every non-null field** with `old_value = NULL`. This is critical because the other side needs all field values to reconstruct the entire row.

#### UPDATE (existing row)

```typescript
const oldRow = await db.select().from(workOrders).where(eq(workOrders.wouuid, id));
const newRow = await db.update(workOrders).set(updates).where(...).returning();
await logFieldChanges('work_orders', id, vesselId, oldRow, newRow, userId);
```

The logger compares `serializeValue(old[key])` vs `serializeValue(new[key])` for every field. Only **actually changed** fields get logged.

#### Soft DELETE

```typescript
await logSoftDelete('work_orders', rowUuid, vesselId, userId);
// This is a shortcut for:
await logFieldChanges('work_orders', rowUuid, vesselId,
  { is_deleted: false },
  { is_deleted: true },
  userId
);
```

A soft delete is just another field change: `is_deleted: false → true`.

### The `serializeValue()` Function — Why It Matters

All field values are stored as **text** in `sync_field_log`. The serializer handles type conversion safely:

```typescript
function serializeValue(value: any): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();         // Date → "2026-06-15T10:00:00.000Z"
  if (typeof value === 'object') return JSON.stringify(value);   // Object/Array → JSON string
  return String(value);                                          // Everything else → string
}
```

> [!WARNING]
> Without the `JSON.stringify()` check, JavaScript's `String({})` produces `"[object Object]"` — which would corrupt your data permanently.

### Fields That Are Always Skipped

```typescript
const SKIP_FIELDS = new Set([
  'updated_at', 'updatedAt',   // Managed by DB trigger, not user data
  'created_at', 'createdAt',   // Set once on INSERT, never changes
  'is_sync', 'isSync',         // Internal sync flag
]);
```

Additionally, if a table has a **serial/auto-increment** `id` column (e.g., `id SERIAL PRIMARY KEY`), that `id` is also skipped because ship's `id = 5` and shore's `id = 5` are different rows — they use UUID columns for identity instead.

### User ID Resolution — AsyncLocalStorage Fallback

Many legacy callers pass `'system'` as the userId. The field logger has a smart fallback ([fieldLogger.ts:169-184](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/server/modules/sync/fieldLogger.ts#L169-L184)):

```
1. Use the explicitly passed userId (if not 'system' or 'admin')
2. Fall back to AsyncLocalStorage request context (captures real authenticated user)
3. Last resort: use 'system' (for cron jobs, startup tasks)
```

This was added so the team didn't have to modify 65+ callers — the middleware automatically captures the real user.

### Why NOT Database Triggers?

| Reason | Explanation |
|--------|-------------|
| **Can't know "old row" for INSERTs** | The app passes `oldRow = null` for INSERTs, telling the logger to record all fields. A trigger only sees `NEW`, not the concept of "this is a brand new row" |
| **Can't easily get `userId`** | The app has the HTTP request context with the authenticated user. A trigger would need `SET LOCAL` session variables |
| **Can't enforce business rules** | Like "only shore can set defect status to verified". The app-level logger can check `instanceId` |
| **Triggers fire during sync apply too** | Which would create duplicate field logs. The app only calls `logFieldChanges()` on *user-initiated* writes, not during sync apply |

### Batch Logger for High-Volume Operations

For bulk operations (e.g., importing 500 spare parts), there's [logFieldChangesBatch()](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/server/modules/sync/fieldLogger.ts#L272-L378) which uses multi-row INSERTs (1,000 rows per chunk) instead of individual INSERTs:

```typescript
await logFieldChangesBatch([
  { tableName: 'spares', rowUuid: 'sp-001', vesselId, oldRow: oldSpare1, newRow: newSpare1, userId },
  { tableName: 'spares', rowUuid: 'sp-002', vesselId, oldRow: oldSpare2, newRow: newSpare2, userId },
  // ... 498 more entries
], txConnection);
```

### Where Are `logFieldChanges()` Calls Wired?

Every BOTH_EDITABLE table must have logging wired into its service layer. Here are the key files:

| Table | Logging Location |
|-------|------------------|
| `work_orders` | Work order service (create, update, status change, execution) |
| `defects` | [postgresStorage.ts](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/server/postgresStorage.ts) (create, update, close, verify) |
| `spares` | Spares service (receive, consume, adjust, transfer) |
| `running_hours_audit` | Running hours service (create, update audit entries) |
| `vessel_certificate_data` | Certificate service (update dates, status) |
| `vessel_survey_data` | Survey service (update dates, status) |
| `change_request` | Change request service (create, approve, reject) |

> [!CAUTION]
> **If ANY write path misses the `logFieldChanges()` call, those changes silently never sync.** The project went through multiple audit rounds to catch missing calls — fix #14 alone added 20 new logging calls across 10 tables.

---

## 10. Deep Dive: File Transfer with Real Example

### The Scenario

A ship engineer uploads a PDF called **"MainEngine_Inspection.pdf"** (750KB) to a work order on the **ship server**. This file needs to reach the **shore server**.

### Phase 1: File Gets Queued (at upload time)

When the engineer uploads the file via the UI, the upload handler in [woDocumentService.ts](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/server/modules/work-orders/services/woDocumentService.ts#L207) does two things:

```
1. Saves the file to disk:  .private/wo-docs/abc123-MainEngine_Inspection.pdf
2. Calls FileSyncProcessor.queueFileForSync() → adds entry to sync_file_queue
```

Here's what gets written to the `sync_file_queue` table:

| Column | Value |
|--------|-------|
| `queue_uuid` | `q-111-222` |
| `table_name` | `work_order_documents` |
| `file_key` | `abc123-MainEngine_Inspection.pdf` |
| `file_name` | `MainEngine_Inspection.pdf` |
| `file_size_bytes` | `768000` (750KB) |
| `file_hash` | `sha256:a1b2c3d4...` |
| `direction` | `ship_to_shore` |
| `status` | `pending` |
| `priority` | `5` (medium — between 100KB and 1MB) |
| `total_chunks` | `3` (750KB ÷ 256KB per chunk = 3) |
| `chunk_offset` | `0` (nothing sent yet) |

> [!NOTE]
> **The file upload itself is NOT blocked by sync.** `queueFileForSync()` is best-effort — if it fails, the upload still succeeds. The file just won't sync until re-queued.

### How Priority Works

Small files sync first so users see results faster:

| File Size | Priority | Example |
|-----------|----------|---------|
| < 100KB | `10` (highest) | Small images, text files |
| < 1MB | `5` (medium) | PDFs, photos |
| > 1MB | `1` (lowest) | Large CAD files, videos |

### Phase 2: Sync Cycle Runs (later)

After the field data sync finishes (INITIATE → PUSH → PULL → COMPLETE), the `SyncEngine` calls `FileSyncProcessor.processQueue()` from [fileSyncProcessor.ts](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/server/modules/sync/fileSyncProcessor.ts#L90):

```
FileSyncProcessor on SHIP
        │
        │  Step 1: Query sync_file_queue
        │          WHERE status='pending'
        │          AND direction='ship_to_shore'
        │          ORDER BY priority DESC, created_at ASC
        │          LIMIT 50
        │          → finds our 750KB PDF
        │
        │  Step 2: Read file from disk
        │          .private/wo-docs/abc123-MainEngine_Inspection.pdf
        │          → Buffer (768,000 bytes)
        │
        │  Step 3: Calculate SHA-256 hash of ENTIRE file
        │          → "a1b2c3d4e5f6..."
        │
        │  Step 4: Split into 256KB chunks
        │
        │  ┌──────────┐  ┌──────────┐  ┌──────────┐
        │  │ Chunk 0   │  │ Chunk 1   │  │ Chunk 2   │
        │  │ 256 KB    │  │ 256 KB    │  │ 236 KB    │
        │  │ (base64)  │  │ (base64)  │  │ (base64)  │
        │  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
        │        │               │               │
        │        ▼               ▼               ▼
        │  POST /sync/file/upload-chunk (3 HTTP calls)
```

### Phase 3: Sending Chunks (HTTP)

Each chunk is sent as a JSON POST to shore via [sendChunk()](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/server/modules/sync/fileSyncProcessor.ts#L412-L436). Here's what chunk 0 looks like:

```json
{
  "queueUuid": "q-111-222",
  "chunkIndex": 0,
  "totalChunks": 3,
  "data": "JVBERi0xLjQKMS...",
  "fileHash": "a1b2c3d4e5f6...",

  "fileKey": "abc123-MainEngine_Inspection.pdf",
  "tableName": "work_order_documents",
  "fileName": "MainEngine_Inspection.pdf",
  "fileSizeBytes": 768000,
  "vesselId": "vessel-uuid-001"
}
```

The HTTP request includes authentication headers:

```
Content-Type: application/json
X-Sync-Api-Key: <shared secret key>
X-Sync-Instance-Id: SHIP-VESSEL01
```

After each successful chunk, the ship updates `chunk_offset` in `sync_file_queue`:

| After chunk sent | `chunk_offset` | `status` |
|------------------|----------------|-----------|
| Chunk 0 | `1` | `in_progress` |
| Chunk 1 | `2` | `in_progress` |
| Chunk 2 | `3` → mark `completed` | `completed` |

### Resume Capability — What Happens If Connection Drops

```
Scenario: Ship sends chunks 0 and 1, then loses internet.

  sync_file_queue row after chunk 1:
    status = 'in_progress'
    chunk_offset = 2           ← "I've sent 2 chunks successfully"

  Next sync cycle (when internet returns):
    processQueue() reads chunk_offset = 2
    Starts the for loop at i = 2 (skips chunks 0 and 1)
    Only re-sends chunk 2
    → No wasted bandwidth!
```

This is handled by line 135 in [fileSyncProcessor.ts](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/server/modules/sync/fileSyncProcessor.ts#L135):

```typescript
const startChunk = fileEntry.chunkOffset || 0; // Resume from last successful chunk
for (let i = startChunk; i < totalChunks; i++) { ... }
```

### Phase 4: Receiving Chunks (Shore Side)

Shore's `receiveChunk()` method ([fileSyncProcessor.ts:210](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/server/modules/sync/fileSyncProcessor.ts#L210-L319)) handles each incoming chunk:

```
Shore receives chunk 0:
  → Decode base64 → binary Buffer
  → Save to temp:  .private/sync-temp/q-111-222/chunk_00000
  → Create a "mirror" queue entry in shore's DB (for tracking)
  → Return { received: true, complete: false }

Shore receives chunk 1:
  → Save to temp:  .private/sync-temp/q-111-222/chunk_00001
  → Return { received: true, complete: false }

Shore receives chunk 2 (LAST chunk):
  → Save to temp:  .private/sync-temp/q-111-222/chunk_00002
  → Detect: chunkIndex (2) === totalChunks - 1 (2)  ← THIS IS THE LAST ONE!
  → Trigger REASSEMBLY ↓
```

### Phase 5: Reassembly & Hash Verification

```
Shore REASSEMBLES the file:
  1. Read chunk_00000 (256KB) + chunk_00001 (256KB) + chunk_00002 (236KB)
  2. Buffer.concat() → single Buffer (768,000 bytes)

Shore VERIFIES integrity:
  3. SHA-256(assembled buffer)  → "a1b2c3d4e5f6..."
  4. Compare with chunk.fileHash → "a1b2c3d4e5f6..."
  5. MATCH ✅ → file is intact, no corruption!

  (If hash DOESN'T match → discard the file, log error,
   delete temp chunks. Ship will retry next sync.)

Shore SAVES to final location:
  6. tableName = "work_order_documents"
  7. getStorageDir("work_order_documents") → .private/wo-docs/
  8. Write to: .private/wo-docs/abc123-MainEngine_Inspection.pdf
  9. Delete temp dir: rm -rf .private/sync-temp/q-111-222/
```

### Full Journey Diagram

```
SHIP SERVER                                         SHORE SERVER

.private/wo-docs/                                   .private/wo-docs/
  abc123-MainEngine.pdf                               (doesn't exist yet)
  (750KB original file)
        │
        ├── Read file into Buffer
        ├── SHA-256 hash: a1b2c3...
        ├── Split: 3 chunks × 256KB
        │
        │  POST chunk 0 (base64) ───────────────►  .private/sync-temp/q-111/chunk_00000
        │  POST chunk 1 (base64) ───────────────►  .private/sync-temp/q-111/chunk_00001
        │  POST chunk 2 (base64) ───────────────►  .private/sync-temp/q-111/chunk_00002
        │                                                    │
        │                                           Reassemble → 750KB Buffer
        │                                           SHA-256 verify ✅
        │                                           Save to final location:
        │                                                    │
        │                                           .private/wo-docs/
        │                                             abc123-MainEngine.pdf  ✅
```

### Which Tables Have File Sync Wired?

Only **4 tables** queue files for sync:

| Table | Where `queueFileForSync()` Is Called | File Types |
|-------|--------------------------------------|------------|
| `work_order_documents` | [woDocumentService.ts:207](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/server/modules/work-orders/services/woDocumentService.ts#L207) | PDFs, images, any uploaded binary |
| `component_documents` | [documentService.ts:124](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/server/modules/components/services/documentService.ts#L124) | Component manuals, drawings |
| `defect_attachments` | [postgresStorage.ts:4623](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/server/postgresStorage.ts#L4623) | Only `local://` files (URL refs sync via field logs) |
| `change_request_attachment` | [postgresStorage.ts:5756](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/server/postgresStorage.ts#L5756) | Only `local://` files |

### Storage Backend: `local` vs `object`

Files can be stored in two backends:

| Backend | How | Sync Support |
|---------|-----|---------------|
| `local` | Filesystem under `.private/` | ✅ Full support — read from disk, chunk, send |
| `object` | Replit Object Storage (GCS) | ❌ Not yet implemented — files stored in cloud can't be synced locally |

The storage directory is determined by table name:

```typescript
function getStorageDir(tableName: string): string {
  switch (tableName) {
    case 'component_documents':        return '.private/component-docs/';
    case 'defect_attachments':         return '.private/defect-docs/';
    case 'change_request_attachment':  return '.private/cr-docs/';
    default:                           return '.private/wo-docs/';  // work_order_documents
  }
}
```

### Retry & Failure Handling

| Event | What Happens |
|-------|-------------|
| Chunk upload fails (network error) | Retry count incremented. Status stays `pending` if retries < 3 |
| 3 consecutive failures | Status set to `failed`. Health monitor flags it |
| File not found on disk | Error logged, file skipped (status = `failed`) |
| Hash mismatch after reassembly | Assembled file discarded, temp chunks deleted. Ship retries next sync |
| File sync as a whole fails | **Non-fatal** — field data is already synced. SyncEngine wraps file sync in try/catch |

### Key Design Decision: Why File Sync Runs LAST

```
Sync Cycle Order:
  ① INITIATE  ─── lightweight, always succeeds
  ② PUSH      ─── field data (small JSON payloads)
  ③ PULL      ─── field data (small JSON payloads)
  ④ COMPLETE  ─── advance checkpoint
  ⑤ FILE SYNC ─── binary files (large, slow, may fail)  ← LAST!
```

If file sync ran earlier and failed, it would block the entire sync. By running it last:
- All metadata (file name, who uploaded, which work order) is already synced via field logs
- The checkpoint is already advanced
- The file can be retried independently on the next sync
- Users see the document metadata immediately, even if the actual file arrives later

### Local Mode (Development)

In local mode (single machine, two databases), `sendChunk()` skips the HTTP call and directly calls `receiveChunk()` on the same instance ([fileSyncProcessor.ts:415-418](file:///c:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/TechnicalMoudle/server/modules/sync/fileSyncProcessor.ts#L415-L418)):

```typescript
if (localMode || !this.shoreUrl) {
  // No HTTP — directly save the chunk as if we received it
  await this.receiveChunk(chunk);
  return;
}
```

This simulates the full chunking + reassembly + hash verification flow without network overhead.

---

## 11. Glossary

| Term | Meaning |
|------|---------|
| **Batch** | A single sync cycle. Gets a UUID. Status: `in_progress` → `completed` or `failed` |
| **Checkpoint** | A timestamp. Data changed *after* this point hasn't been synced yet. Advances on every successful sync |
| **Chunk** | A 256KB piece of a binary file, base64-encoded for JSON transport. Files are split into chunks for transfer |
| **Chunk offset** | Tracks how many chunks have been successfully sent. Enables resume-from-failure without re-sending everything |
| **Conflict** | Both sides changed the same field on the same row between syncs |
| **Delta sync** | Only sync the differences (changes) instead of full copies of all data |
| **Field log** | A single entry in `sync_field_log` recording one field change (table + row + field + old/new value) |
| **File queue** | The `sync_file_queue` table where files are registered for transfer. Entries have status, priority, and chunk tracking |
| **Hash verification** | SHA-256 hash of the complete file, computed before chunking and verified after reassembly to ensure integrity |
| **Identity column** | A UUID column (like `wouuid`) that uniquely identifies a row across all instances. NOT the auto-increment `id` |
| **Instance ID** | A string like `SHORE-PROD` or `SHIP-VESSEL01` identifying which server made a change |
| **Local mode** | Development mode where `SyncEngine` calls service functions directly instead of making HTTP requests |
| **Mirror queue entry** | A copy of the sender's `sync_file_queue` entry created on the receiver side, so the receiver can track the file transfer status |
| **One-way** | Shore sends, ship receives. Ship's data is overwritten. No conflicts possible |
| **Provisioning** | The initial data load when setting up a new ship server — export JSON from shore, import on ship |
| **Pruning** | Automatic cleanup of old sync records (synced field logs, completed batches, resolved conflicts) |
| **Stale-skip guard** | When applying a field log, check if the receiver already has a newer edit on that specific field. If so, skip the incoming log |
| **Storage backend** | Where files are physically stored: `local` (filesystem) or `object` (cloud GCS). Only local supports sync currently |
| **Trigger bypass** | PostgreSQL session variable (`sync.bypass_trigger = 'true'`) that tells the `set_updated_at` trigger to preserve the application-supplied `updated_at` instead of overriding with `NOW()` |
| **Vessel scope** | Most tables have a `vessel_id` column to filter data to a specific vessel. Some use `vessel_code` instead |

---

> [!TIP]
> **Starting point for replication:** Begin with Section 7, Steps 1-4. Get the database tables and field logging working first. Then build the sync engine. The frontend dashboard is last — you can trigger syncs via `curl` during development.
