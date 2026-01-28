# V2 Full Upgrade Plan: Admin, Vessel, and Rotation Modules

## Document Purpose

This document provides a complete technical specification for upgrading the Admin, Vessel, and Rotation modules to V2 architecture, matching the patterns established in Crew Pool and Recruitment V2 modules.

**Target Architecture:**
- Normalized tables (no JSON storage)
- UUID primary keys
- Full audit columns
- Proper foreign key constraints
- Modular services/controllers
- V2 API endpoints

---

## Part 1: Replit Analysis Review

### ✅ Replit's Analysis is CORRECT and COMPREHENSIVE

| Section | Assessment | Notes |
|---------|------------|-------|
| Current Architecture Overview | ✅ Accurate | V1 vs V2 tables correctly identified |
| V1 Structural Issues | ✅ Complete | JSON fields, missing UUIDs, audit gaps documented |
| V2 Crew Pool Integration Gaps | ✅ Correct | 7 gaps identified with root causes |
| Implementation Tasks | ✅ Actionable | 6 tasks with code examples |
| Admin → Vessel Flow | ✅ Detailed | Revision workflow traced correctly |
| Crew Pool → Rotation Flow | ✅ Accurate | V1-only query problem identified |

### Replit's Recommended Approach (Option A)

Replit recommends **extending V1 rotation** for immediate needs:
- Keep V1 tables/endpoints
- Add V2 crew query
- Sync crew_assignments on deployment

**This is correct for SHORT-TERM integration.**

However, for **LONG-TERM maintainability**, a full V2 upgrade is needed.

---

## Part 2: Current V1 Schema Analysis

### 2.1 Tables Requiring V2 Upgrade

| Module | V1 Table | Issues Count | Priority |
|--------|----------|--------------|----------|
| **Admin** | `available_ranks` | 5 issues | High |
| **Admin** | `company_ranks` | 7 issues | High |
| **Vessel** | `vessel_revisions` | 7 issues | High |
| **Vessel** | `vessel_drafts` | 6 issues | High |
| **Vessel** | `vessel_planning` | 12 issues | Critical |
| **Rotation** | `rotation_plans` | 8 issues | Critical |
| **Rotation** | `rotation_archive` | 9 issues | High |

### 2.2 Common V1 Issues

```
┌─────────────────────────────────────────────────────────────────┐
│                    V1 STRUCTURAL ISSUES                         │
└─────────────────────────────────────────────────────────────────┘

1. INTEGER PRIMARY KEYS
   └─ All tables use serial(id) instead of UUID
   └─ Makes data portability and merging difficult

2. JSON AS TEXT
   └─ vessel_revisions.revisionData = TEXT (JSON string)
   └─ vessel_drafts.draftData = TEXT (JSON string)
   └─ rotation_plans.assignments = TEXT (JSON string)
   └─ rotation_plans.vessels = TEXT (JSON string)
   └─ vessel_planning.handoverAttachments = TEXT (JSON string)

3. MISSING AUDIT COLUMNS
   └─ No createdByUuid on any table
   └─ No updatedByUuid on any table
   └─ No isDeleted soft delete flag
   └─ No deletedAt timestamp

4. TEXT DATE FIELDS
   └─ All dates stored as TEXT (e.g., "dd/mm/yyyy")
   └─ No proper DATE or TIMESTAMP types

5. NO FOREIGN KEY CONSTRAINTS
   └─ vesselId references no table
   └─ crewMemberId references no table
   └─ rankId references no table

6. DEPRECATED COLUMNS
   └─ vessel_planning has 5 deprecated columns
   └─ Still in schema, consuming space
```

---

## Part 3: V2 Schema Design

### 3.1 ER Diagram - Admin Module V2

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ADMIN MODULE V2 - ER DIAGRAM                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────┐       ┌─────────────────────────┐
│    available_ranks_v2   │       │     rank_categories     │
├─────────────────────────┤       ├─────────────────────────┤
│ PK rank_uuid      UUID  │──┐    │ PK category_uuid  UUID  │
│    rank_code      TEXT  │  │    │    category_name  TEXT  │
│    rank_name      TEXT  │  │    │    category_type  TEXT  │
│    category_uuid  UUID  │──┼───>│    sort_order     INT   │
│    sort_order     INT   │  │    │    ...audit_columns...  │
│    is_system_rank BOOL  │  │    └─────────────────────────┘
│    is_active      BOOL  │  │
│    ...audit_columns...  │  │
└─────────────────────────┘  │
                             │
┌─────────────────────────┐  │    ┌─────────────────────────┐
│   company_ranks_v2      │  │    │   rank_designations     │
├─────────────────────────┤  │    ├─────────────────────────┤
│ PK comp_rank_uuid UUID  │  │    │ PK desig_uuid     UUID  │
│ FK rank_uuid      UUID  │──┘    │ FK comp_rank_uuid UUID  │──┐
│    role_name      TEXT  │       │    designation    TEXT  │  │
│    role_suffix    TEXT  │       │    is_active      BOOL  │  │
│    is_role_row    BOOL  │       │    ...audit_columns...  │  │
│    is_active      BOOL  │       └─────────────────────────┘  │
│    ...audit_columns...  │                                    │
└─────────────────────────┘<───────────────────────────────────┘

Note: 19 boolean columns (officer, seniorOfficer, etc.)
      → Normalized to rank_designations junction table
```

### 3.2 ER Diagram - Vessel Module V2

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        VESSEL MODULE V2 - ER DIAGRAM                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────┐
│   vessel_revisions_v2   │
├─────────────────────────┤       ┌─────────────────────────┐
│ PK revision_uuid  UUID  │       │  revision_ranks_v2      │
│ FK vessel_uuid    UUID  │       ├─────────────────────────┤
│    revision_no    INT   │──────>│ PK rev_rank_uuid  UUID  │
│    revision_date  DATE  │       │ FK revision_uuid  UUID  │
│    status         TEXT  │       │ FK rank_uuid      UUID  │
│    submitted_by   UUID  │       │    actual_manning BOOL  │
│    submitted_at   TS    │       │    safe_manning   INT   │
│    ...audit_columns...  │       │    optimum_manning INT  │
└─────────────────────────┘       │    high_workload  INT   │
                                  │    sort_order     INT   │
┌─────────────────────────┐       │    ...audit_columns...  │
│    vessel_drafts_v2     │       └─────────────────────────┘
├─────────────────────────┤
│ PK draft_uuid     UUID  │
│ FK vessel_uuid    UUID  │
│    revision_no    INT   │
│    status         TEXT  │
│    ...audit_columns...  │
└─────────────────────────┘
         │
         │
         ▼
┌─────────────────────────┐       ┌─────────────────────────┐
│    draft_ranks_v2       │       │  vessel_planning_v2     │
├─────────────────────────┤       ├─────────────────────────┤
│ PK draft_rank_uuid UUID │       │ PK planning_uuid  UUID  │
│ FK draft_uuid      UUID │       │ FK vessel_uuid    UUID  │
│ FK rank_uuid       UUID │       │ FK rank_uuid      UUID  │
│    actual_manning  BOOL │       │ FK crew_uuid      UUID  │──┐
│    safe_manning    INT  │       │    crew_status    TEXT  │  │
│    optimum_manning INT  │       │    sign_on_date   DATE  │  │
│    high_workload   INT  │       │    relief_due     DATE  │  │
│    sort_order      INT  │       │    sign_off_date  DATE  │  │
│    ...audit_columns...  │       │    joining_status TEXT  │  │
└─────────────────────────┘       │    is_archived    BOOL  │  │
                                  │    ...audit_columns...  │  │
                                  └─────────────────────────┘  │
                                                               │
┌─────────────────────────┐       ┌─────────────────────────┐  │
│  planning_relievers_v2  │       │  planning_contracts_v2  │  │
├─────────────────────────┤       ├─────────────────────────┤  │
│ PK reliever_uuid  UUID  │       │ PK contract_uuid  UUID  │  │
│ FK planning_uuid  UUID  │       │ FK planning_uuid  UUID  │  │
│ FK crew_uuid      UUID  │───────│    period_months  INT   │<─┘
│    sign_on_date   DATE  │       │    range_start    INT   │
│    joining_port   TEXT  │       │    range_end      INT   │
│    joining_status TEXT  │       │    ...audit_columns...  │
│    ...audit_columns...  │       └─────────────────────────┘
└─────────────────────────┘
```

### 3.3 ER Diagram - Rotation Module V2

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ROTATION MODULE V2 - ER DIAGRAM                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────┐       ┌─────────────────────────┐
│   rotation_plans_v2     │       │   plan_vessels_v2       │
├─────────────────────────┤       ├─────────────────────────┤
│ PK plan_uuid      UUID  │──────>│ PK pv_uuid        UUID  │
│    draft_id       TEXT  │       │ FK plan_uuid      UUID  │
│    plan_from_date DATE  │       │ FK vessel_uuid    UUID  │
│    plan_to_date   DATE  │       │    sort_order     INT   │
│    plan_status    TEXT  │       │    ...audit_columns...  │
│    proposed_by    UUID  │       └─────────────────────────┘
│    proposed_at    TS    │
│    approved_by    UUID  │       ┌─────────────────────────┐
│    approved_at    TS    │       │   plan_ranks_v2         │
│    ...audit_columns...  │       ├─────────────────────────┤
└─────────────────────────┘──────>│ PK pr_uuid        UUID  │
                                  │ FK plan_uuid      UUID  │
                                  │ FK rank_uuid      UUID  │
                                  │    sort_order     INT   │
                                  │    ...audit_columns...  │
                                  └─────────────────────────┘

┌─────────────────────────┐
│ rotation_assignments_v2 │       ┌─────────────────────────┐
├─────────────────────────┤       │  assignment_history_v2  │
│ PK assign_uuid    UUID  │       ├─────────────────────────┤
│ FK plan_uuid      UUID  │──────>│ PK history_uuid   UUID  │
│ FK vessel_uuid    UUID  │       │ FK assign_uuid    UUID  │
│ FK rank_uuid      UUID  │       │    action         TEXT  │
│ FK crew_uuid      UUID  │       │    action_by      UUID  │
│    joining_date   DATE  │       │    action_at      TS    │
│    joining_port   TEXT  │       │    reason         TEXT  │
│    contract_months INT  │       │    snapshot_data  JSONB │
│    status         TEXT  │       │    ...audit_columns...  │
│    deployed_by    UUID  │       └─────────────────────────┘
│    deployed_at    TS    │
│    rejected_by    UUID  │
│    rejected_at    TS    │
│    rejection_reason TEXT│
│ FK vessel_planning_uuid │───┐
│ FK crew_assignment_uuid │──┐│
│    sort_order     INT   │  ││
│    ...audit_columns...  │  ││
└─────────────────────────┘  ││
                             ││
  Links to vessel_planning_v2┘│
  Links to crew_assignments───┘

┌─────────────────────────┐
│  rotation_archive_v2    │
├─────────────────────────┤
│ PK archive_uuid   UUID  │
│ FK plan_uuid      UUID  │
│ FK assign_uuid    UUID  │
│ FK vessel_uuid    UUID  │
│ FK crew_uuid      UUID  │
│    result         TEXT  │  (Deployed/Rejected)
│    archived_by    UUID  │
│    archived_at    TS    │
│    snapshot_data  JSONB │  (For audit trail)
│    ...audit_columns...  │
└─────────────────────────┘
```

---

## Part 4: Detailed Table Specifications

### 4.1 Common Audit Columns (Used in All V2 Tables)

```typescript
// Standard audit columns for all V2 tables
const auditColumns = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  deletedAt: timestamp("deleted_at"),
  deletedByUuid: text("deleted_by_uuid"),
  isSync: boolean("is_sync").default(false),
};
```

### 4.2 Admin Module V2 Tables

#### Table: available_ranks_v2

```sql
CREATE TABLE available_ranks_v2 (
  id SERIAL PRIMARY KEY,
  rank_uuid TEXT NOT NULL UNIQUE,
  rank_code TEXT NOT NULL UNIQUE,        -- e.g., "S1", "S2"
  rank_name TEXT NOT NULL,               -- e.g., "Master", "Chief Officer"
  category_uuid TEXT,                    -- FK to rank_categories
  sort_order INTEGER DEFAULT 0,
  is_system_rank BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  -- Audit columns
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  is_sync BOOLEAN DEFAULT false
);

CREATE INDEX idx_available_ranks_v2_code ON available_ranks_v2(rank_code);
CREATE INDEX idx_available_ranks_v2_category ON available_ranks_v2(category_uuid);
CREATE INDEX idx_available_ranks_v2_active ON available_ranks_v2(is_active) WHERE is_active = true;
```

#### Table: rank_categories

```sql
CREATE TABLE rank_categories (
  id SERIAL PRIMARY KEY,
  category_uuid TEXT NOT NULL UNIQUE,
  category_name TEXT NOT NULL,           -- e.g., "Officer", "Rating", "Catering"
  category_type TEXT NOT NULL,           -- e.g., "deck", "engine", "general"
  parent_category_uuid TEXT,             -- For hierarchical categories
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  -- Audit columns
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  is_sync BOOLEAN DEFAULT false
);
```

#### Table: company_ranks_v2

```sql
CREATE TABLE company_ranks_v2 (
  id SERIAL PRIMARY KEY,
  comp_rank_uuid TEXT NOT NULL UNIQUE,
  rank_uuid TEXT NOT NULL,               -- FK to available_ranks_v2
  role_name TEXT,                        -- e.g., "3rd Officer_1"
  role_suffix TEXT,                      -- e.g., "_1", "_2"
  is_role_row BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  -- Audit columns
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  is_sync BOOLEAN DEFAULT false,

  CONSTRAINT fk_company_ranks_v2_rank FOREIGN KEY (rank_uuid)
    REFERENCES available_ranks_v2(rank_uuid)
);

CREATE INDEX idx_company_ranks_v2_rank ON company_ranks_v2(rank_uuid);
```

#### Table: rank_designations (Replaces 19 boolean columns)

```sql
CREATE TABLE rank_designations (
  id SERIAL PRIMARY KEY,
  desig_uuid TEXT NOT NULL UNIQUE,
  comp_rank_uuid TEXT NOT NULL,          -- FK to company_ranks_v2
  designation TEXT NOT NULL,             -- e.g., "officer", "seniorOfficer", "deckOfficer"
  is_active BOOLEAN DEFAULT true,
  -- Audit columns
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  is_sync BOOLEAN DEFAULT false,

  CONSTRAINT fk_rank_desig_comp_rank FOREIGN KEY (comp_rank_uuid)
    REFERENCES company_ranks_v2(comp_rank_uuid),
  CONSTRAINT uq_rank_designation UNIQUE (comp_rank_uuid, designation)
);

-- Valid designation values:
-- officer, rating, seniorOfficer, deckOfficer, engOfficer, pettyOfficer,
-- deckRating, engineRating, generalRating, cateringRating, safetyOfficer,
-- sso, medicalOfficer, navigatingOfficer, emtOfficer
```

### 4.3 Vessel Module V2 Tables

#### Table: vessel_revisions_v2

```sql
CREATE TABLE vessel_revisions_v2 (
  id SERIAL PRIMARY KEY,
  revision_uuid TEXT NOT NULL UNIQUE,
  vessel_uuid TEXT NOT NULL,             -- FK to Master 014 vessels
  revision_number INTEGER NOT NULL,      -- Sequential: 0, 1, 2...
  revision_date DATE NOT NULL,
  status TEXT DEFAULT 'active',          -- active, superseded, archived
  submitted_by_uuid TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  -- Audit columns
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  is_sync BOOLEAN DEFAULT false,

  CONSTRAINT uq_vessel_revision UNIQUE (vessel_uuid, revision_number)
);

CREATE INDEX idx_vessel_revisions_v2_vessel ON vessel_revisions_v2(vessel_uuid);
CREATE INDEX idx_vessel_revisions_v2_status ON vessel_revisions_v2(status);
```

#### Table: revision_ranks_v2 (Normalized from JSON revisionData)

```sql
CREATE TABLE revision_ranks_v2 (
  id SERIAL PRIMARY KEY,
  rev_rank_uuid TEXT NOT NULL UNIQUE,
  revision_uuid TEXT NOT NULL,           -- FK to vessel_revisions_v2
  rank_uuid TEXT NOT NULL,               -- FK to available_ranks_v2
  actual_manning_flag BOOLEAN DEFAULT false,
  safe_manning INTEGER DEFAULT 0,
  optimum_manning INTEGER DEFAULT 0,
  high_workload_manning INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  -- Audit columns
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  is_sync BOOLEAN DEFAULT false,

  CONSTRAINT fk_rev_ranks_revision FOREIGN KEY (revision_uuid)
    REFERENCES vessel_revisions_v2(revision_uuid),
  CONSTRAINT fk_rev_ranks_rank FOREIGN KEY (rank_uuid)
    REFERENCES available_ranks_v2(rank_uuid)
);

CREATE INDEX idx_revision_ranks_v2_revision ON revision_ranks_v2(revision_uuid);
CREATE INDEX idx_revision_ranks_v2_rank ON revision_ranks_v2(rank_uuid);
```

#### Table: vessel_drafts_v2

```sql
CREATE TABLE vessel_drafts_v2 (
  id SERIAL PRIMARY KEY,
  draft_uuid TEXT NOT NULL UNIQUE,
  vessel_uuid TEXT NOT NULL,
  revision_number INTEGER DEFAULT 1,
  status TEXT DEFAULT 'in_progress',     -- in_progress, saved, submitted
  -- Audit columns
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  is_sync BOOLEAN DEFAULT false
);

CREATE INDEX idx_vessel_drafts_v2_vessel ON vessel_drafts_v2(vessel_uuid);
CREATE INDEX idx_vessel_drafts_v2_status ON vessel_drafts_v2(status);
```

#### Table: draft_ranks_v2 (Normalized from JSON draftData)

```sql
CREATE TABLE draft_ranks_v2 (
  id SERIAL PRIMARY KEY,
  draft_rank_uuid TEXT NOT NULL UNIQUE,
  draft_uuid TEXT NOT NULL,              -- FK to vessel_drafts_v2
  rank_uuid TEXT NOT NULL,               -- FK to available_ranks_v2
  actual_manning_flag BOOLEAN DEFAULT false,
  safe_manning INTEGER DEFAULT 0,
  optimum_manning INTEGER DEFAULT 0,
  high_workload_manning INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  -- Audit columns
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  is_sync BOOLEAN DEFAULT false,

  CONSTRAINT fk_draft_ranks_draft FOREIGN KEY (draft_uuid)
    REFERENCES vessel_drafts_v2(draft_uuid),
  CONSTRAINT fk_draft_ranks_rank FOREIGN KEY (rank_uuid)
    REFERENCES available_ranks_v2(rank_uuid)
);
```

#### Table: vessel_planning_v2

```sql
CREATE TABLE vessel_planning_v2 (
  id SERIAL PRIMARY KEY,
  planning_uuid TEXT NOT NULL UNIQUE,
  vessel_uuid TEXT NOT NULL,             -- FK to Master 014
  rank_uuid TEXT NOT NULL,               -- FK to available_ranks_v2
  crew_uuid TEXT,                        -- FK to crew_members_v2
  crew_status TEXT DEFAULT 'primary',    -- primary, secondary
  sign_on_date DATE,
  relief_due DATE,
  sign_off_date DATE,
  sign_off_port TEXT,
  sign_off_reason TEXT,
  joining_status TEXT,                   -- Proposed, Planned, Confirmed, InTransit, SignedOn
  is_archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMP WITH TIME ZONE,
  -- Audit columns
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  is_sync BOOLEAN DEFAULT false,

  CONSTRAINT fk_vp_v2_rank FOREIGN KEY (rank_uuid)
    REFERENCES available_ranks_v2(rank_uuid),
  CONSTRAINT fk_vp_v2_crew FOREIGN KEY (crew_uuid)
    REFERENCES crew_members_v2(crew_uuid)
);

CREATE INDEX idx_vessel_planning_v2_vessel ON vessel_planning_v2(vessel_uuid);
CREATE INDEX idx_vessel_planning_v2_crew ON vessel_planning_v2(crew_uuid);
CREATE INDEX idx_vessel_planning_v2_archived ON vessel_planning_v2(is_archived);
```

#### Table: planning_relievers_v2 (Separate reliever data)

```sql
CREATE TABLE planning_relievers_v2 (
  id SERIAL PRIMARY KEY,
  reliever_uuid TEXT NOT NULL UNIQUE,
  planning_uuid TEXT NOT NULL,           -- FK to vessel_planning_v2
  crew_uuid TEXT NOT NULL,               -- FK to crew_members_v2 (reliever)
  sign_on_date DATE,
  joining_port TEXT,
  joining_status TEXT,                   -- Proposed, Planned, Confirmed, InTransit
  -- Audit columns
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  is_sync BOOLEAN DEFAULT false,

  CONSTRAINT fk_pr_v2_planning FOREIGN KEY (planning_uuid)
    REFERENCES vessel_planning_v2(planning_uuid),
  CONSTRAINT fk_pr_v2_crew FOREIGN KEY (crew_uuid)
    REFERENCES crew_members_v2(crew_uuid)
);
```

#### Table: planning_contracts_v2 (Separate contract terms)

```sql
CREATE TABLE planning_contracts_v2 (
  id SERIAL PRIMARY KEY,
  contract_uuid TEXT NOT NULL UNIQUE,
  planning_uuid TEXT NOT NULL,           -- FK to vessel_planning_v2
  contract_type TEXT NOT NULL,           -- 'primary' or 'reliever'
  period_months INTEGER,
  range_start_months INTEGER,
  range_end_months INTEGER,
  -- Audit columns
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  is_sync BOOLEAN DEFAULT false,

  CONSTRAINT fk_pc_v2_planning FOREIGN KEY (planning_uuid)
    REFERENCES vessel_planning_v2(planning_uuid)
);
```

#### Table: planning_handover_attachments_v2

```sql
CREATE TABLE planning_handover_attachments_v2 (
  id SERIAL PRIMARY KEY,
  attachment_uuid TEXT NOT NULL UNIQUE,
  planning_uuid TEXT NOT NULL,           -- FK to vessel_planning_v2
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  file_path TEXT,
  file_data TEXT,                        -- Base64 if stored inline
  uploaded_by_uuid TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Audit columns
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  is_sync BOOLEAN DEFAULT false,

  CONSTRAINT fk_pha_v2_planning FOREIGN KEY (planning_uuid)
    REFERENCES vessel_planning_v2(planning_uuid)
);
```

### 4.4 Rotation Module V2 Tables

#### Table: rotation_plans_v2

```sql
CREATE TABLE rotation_plans_v2 (
  id SERIAL PRIMARY KEY,
  plan_uuid TEXT NOT NULL UNIQUE,
  draft_id TEXT NOT NULL UNIQUE,
  plan_from_date DATE,
  plan_to_date DATE,
  plan_status TEXT DEFAULT 'In Draft',   -- In Draft, Proposed, Partially Approved, Approved, Rejected, Archived
  proposed_by_uuid TEXT,
  proposed_at TIMESTAMP WITH TIME ZONE,
  approved_by_uuid TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  -- Audit columns
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  is_sync BOOLEAN DEFAULT false
);

CREATE INDEX idx_rotation_plans_v2_status ON rotation_plans_v2(plan_status);
CREATE INDEX idx_rotation_plans_v2_dates ON rotation_plans_v2(plan_from_date, plan_to_date);
```

#### Table: plan_vessels_v2 (Normalized from JSON vessels array)

```sql
CREATE TABLE plan_vessels_v2 (
  id SERIAL PRIMARY KEY,
  pv_uuid TEXT NOT NULL UNIQUE,
  plan_uuid TEXT NOT NULL,               -- FK to rotation_plans_v2
  vessel_uuid TEXT NOT NULL,             -- FK to Master 014
  sort_order INTEGER DEFAULT 0,
  -- Audit columns
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  is_sync BOOLEAN DEFAULT false,

  CONSTRAINT fk_pv_v2_plan FOREIGN KEY (plan_uuid)
    REFERENCES rotation_plans_v2(plan_uuid)
);

CREATE INDEX idx_plan_vessels_v2_plan ON plan_vessels_v2(plan_uuid);
```

#### Table: plan_ranks_v2 (Normalized from crew text field)

```sql
CREATE TABLE plan_ranks_v2 (
  id SERIAL PRIMARY KEY,
  pr_uuid TEXT NOT NULL UNIQUE,
  plan_uuid TEXT NOT NULL,               -- FK to rotation_plans_v2
  rank_uuid TEXT NOT NULL,               -- FK to available_ranks_v2
  sort_order INTEGER DEFAULT 0,
  -- Audit columns
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  is_sync BOOLEAN DEFAULT false,

  CONSTRAINT fk_pr_v2_plan FOREIGN KEY (plan_uuid)
    REFERENCES rotation_plans_v2(plan_uuid),
  CONSTRAINT fk_pr_v2_rank FOREIGN KEY (rank_uuid)
    REFERENCES available_ranks_v2(rank_uuid)
);
```

#### Table: rotation_assignments_v2 (Normalized from JSON assignments)

```sql
CREATE TABLE rotation_assignments_v2 (
  id SERIAL PRIMARY KEY,
  assign_uuid TEXT NOT NULL UNIQUE,
  plan_uuid TEXT NOT NULL,               -- FK to rotation_plans_v2
  vessel_uuid TEXT NOT NULL,             -- FK to Master 014
  rank_uuid TEXT,                        -- FK to available_ranks_v2
  rank_name TEXT,                        -- Denormalized for display
  crew_uuid TEXT,                        -- FK to crew_members_v2
  crew_emp_no TEXT,                      -- For V1 compatibility
  joining_date DATE,
  joining_port TEXT,
  contract_period_months INTEGER,
  contract_end_range_start INTEGER,
  contract_end_range_end INTEGER,
  status TEXT DEFAULT 'proposed',        -- proposed, approved, deployed, rejected
  deployed_by_uuid TEXT,
  deployed_at TIMESTAMP WITH TIME ZONE,
  rejected_by_uuid TEXT,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  vessel_planning_uuid TEXT,             -- FK to vessel_planning_v2 after deploy
  crew_assignment_uuid TEXT,             -- FK to crew_assignments after deploy
  sort_order INTEGER DEFAULT 0,
  -- Audit columns
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  is_sync BOOLEAN DEFAULT false,

  CONSTRAINT fk_ra_v2_plan FOREIGN KEY (plan_uuid)
    REFERENCES rotation_plans_v2(plan_uuid),
  CONSTRAINT fk_ra_v2_crew FOREIGN KEY (crew_uuid)
    REFERENCES crew_members_v2(crew_uuid)
);

CREATE INDEX idx_rotation_assignments_v2_plan ON rotation_assignments_v2(plan_uuid);
CREATE INDEX idx_rotation_assignments_v2_crew ON rotation_assignments_v2(crew_uuid);
CREATE INDEX idx_rotation_assignments_v2_status ON rotation_assignments_v2(status);
CREATE INDEX idx_rotation_assignments_v2_vessel ON rotation_assignments_v2(vessel_uuid);
```

#### Table: rotation_archive_v2

```sql
CREATE TABLE rotation_archive_v2 (
  id SERIAL PRIMARY KEY,
  archive_uuid TEXT NOT NULL UNIQUE,
  original_plan_uuid TEXT,               -- FK to rotation_plans_v2
  original_assign_uuid TEXT,             -- FK to rotation_assignments_v2
  vessel_uuid TEXT,
  rank_uuid TEXT,
  rank_name TEXT,
  crew_uuid TEXT,
  crew_emp_no TEXT,
  joining_date DATE,
  joining_port TEXT,
  contract_period_months INTEGER,
  sign_off_date DATE,
  result TEXT NOT NULL,                  -- Deployed, Rejected
  vessel_planning_uuid TEXT,
  crew_assignment_uuid TEXT,
  archived_by_uuid TEXT,
  archived_at TIMESTAMP WITH TIME ZONE,
  snapshot_data JSONB,                   -- Full snapshot for audit
  -- Audit columns
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  is_sync BOOLEAN DEFAULT false
);

CREATE INDEX idx_rotation_archive_v2_result ON rotation_archive_v2(result);
CREATE INDEX idx_rotation_archive_v2_crew ON rotation_archive_v2(crew_uuid);
CREATE INDEX idx_rotation_archive_v2_vessel ON rotation_archive_v2(vessel_uuid);
CREATE INDEX idx_rotation_archive_v2_date ON rotation_archive_v2(archived_at);
```

---

## Part 5: V2 Folder Structure

### 5.1 Backend Structure

```
server/v2/
├── admin/
│   ├── controllers/
│   │   ├── ranksController.ts
│   │   ├── companyRanksController.ts
│   │   └── index.ts
│   ├── services/
│   │   ├── ranksService.ts
│   │   └── companyRanksService.ts
│   ├── routes.ts
│   └── index.ts
│
├── vessel/
│   ├── controllers/
│   │   ├── revisionsController.ts
│   │   ├── draftsController.ts
│   │   ├── planningController.ts
│   │   └── index.ts
│   ├── services/
│   │   ├── revisionsService.ts
│   │   ├── draftsService.ts
│   │   └── planningService.ts
│   ├── routes.ts
│   └── index.ts
│
├── rotation/
│   ├── controllers/
│   │   ├── plansController.ts
│   │   ├── assignmentsController.ts
│   │   ├── proposalsController.ts
│   │   └── index.ts
│   ├── services/
│   │   ├── plansService.ts
│   │   ├── assignmentsService.ts
│   │   ├── deploymentService.ts
│   │   ├── conflictService.ts
│   │   └── dueCrewService.ts
│   ├── routes.ts
│   └── index.ts
│
├── crew-pool/           (Already exists)
│   └── ...
│
└── recruitment/         (Already exists)
    └── ...

shared/v2/
├── admin/
│   ├── schema.ts
│   └── types.ts
│
├── vessel/
│   ├── schema.ts
│   └── types.ts
│
├── rotation/
│   ├── schema.ts
│   └── types.ts
│
├── crew-pool/           (Already exists)
│   └── ...
│
└── recruitment/         (Already exists)
    └── ...
```

### 5.2 V2 API Endpoints

#### Admin Module V2 Endpoints

```
GET    /api/v2/admin/ranks                        - List all ranks
GET    /api/v2/admin/ranks/:rankUuid              - Get single rank
POST   /api/v2/admin/ranks                        - Create rank
PATCH  /api/v2/admin/ranks/:rankUuid              - Update rank
DELETE /api/v2/admin/ranks/:rankUuid              - Delete rank
POST   /api/v2/admin/ranks/reorder                - Reorder ranks

GET    /api/v2/admin/categories                   - List rank categories
POST   /api/v2/admin/categories                   - Create category

GET    /api/v2/admin/company-ranks                - List company ranks
GET    /api/v2/admin/company-ranks/:compRankUuid  - Get company rank
POST   /api/v2/admin/company-ranks                - Create company rank
PATCH  /api/v2/admin/company-ranks/:compRankUuid  - Update company rank
DELETE /api/v2/admin/company-ranks/:compRankUuid  - Delete company rank

GET    /api/v2/admin/company-ranks/:compRankUuid/designations  - Get designations
PUT    /api/v2/admin/company-ranks/:compRankUuid/designations  - Set designations
```

#### Vessel Module V2 Endpoints

```
GET    /api/v2/vessel/revisions                   - List all revisions
GET    /api/v2/vessel/revisions/vessel/:vesselUuid - Get vessel revisions
GET    /api/v2/vessel/revisions/:revisionUuid     - Get single revision
GET    /api/v2/vessel/revisions/:revisionUuid/ranks - Get revision ranks
POST   /api/v2/vessel/revisions                   - Submit revision
DELETE /api/v2/vessel/revisions/:revisionUuid     - Delete revision

GET    /api/v2/vessel/drafts                      - List all drafts
GET    /api/v2/vessel/drafts/vessel/:vesselUuid   - Get vessel drafts
GET    /api/v2/vessel/drafts/:draftUuid           - Get single draft
GET    /api/v2/vessel/drafts/:draftUuid/ranks     - Get draft ranks
POST   /api/v2/vessel/drafts                      - Create draft
PATCH  /api/v2/vessel/drafts/:draftUuid           - Update draft
DELETE /api/v2/vessel/drafts/:draftUuid           - Delete draft
POST   /api/v2/vessel/drafts/:draftUuid/submit    - Submit draft as revision

GET    /api/v2/vessel/planning                    - List all planning
GET    /api/v2/vessel/planning/vessel/:vesselUuid - Get vessel planning
GET    /api/v2/vessel/planning/:planningUuid      - Get single planning
POST   /api/v2/vessel/planning                    - Create planning
PATCH  /api/v2/vessel/planning/:planningUuid      - Update planning
DELETE /api/v2/vessel/planning/:planningUuid      - Delete planning
POST   /api/v2/vessel/planning/:planningUuid/archive - Archive planning

GET    /api/v2/vessel/planning/:planningUuid/relievers    - Get relievers
POST   /api/v2/vessel/planning/:planningUuid/relievers    - Add reliever
PATCH  /api/v2/vessel/planning/:planningUuid/relievers/:relieverUuid - Update
DELETE /api/v2/vessel/planning/:planningUuid/relievers/:relieverUuid - Delete

GET    /api/v2/vessel/planning/:planningUuid/contracts    - Get contracts
PUT    /api/v2/vessel/planning/:planningUuid/contracts    - Set contracts

GET    /api/v2/vessel/planning/:planningUuid/attachments  - Get attachments
POST   /api/v2/vessel/planning/:planningUuid/attachments  - Add attachment
DELETE /api/v2/vessel/planning/:planningUuid/attachments/:attUuid - Delete
```

#### Rotation Module V2 Endpoints

```
GET    /api/v2/rotation/plans                     - List all plans
GET    /api/v2/rotation/plans/:planUuid           - Get single plan
POST   /api/v2/rotation/plans                     - Create plan
PATCH  /api/v2/rotation/plans/:planUuid           - Update plan
DELETE /api/v2/rotation/plans/:planUuid           - Delete plan

GET    /api/v2/rotation/plans/:planUuid/vessels   - Get plan vessels
PUT    /api/v2/rotation/plans/:planUuid/vessels   - Set plan vessels
GET    /api/v2/rotation/plans/:planUuid/ranks     - Get plan ranks
PUT    /api/v2/rotation/plans/:planUuid/ranks     - Set plan ranks

GET    /api/v2/rotation/plans/:planUuid/assignments       - Get assignments
POST   /api/v2/rotation/plans/:planUuid/assignments       - Add assignment
PATCH  /api/v2/rotation/plans/:planUuid/assignments/:assignUuid - Update
DELETE /api/v2/rotation/plans/:planUuid/assignments/:assignUuid - Delete

POST   /api/v2/rotation/plans/:planUuid/propose   - Propose plan
POST   /api/v2/rotation/plans/:planUuid/approve   - Approve plan

GET    /api/v2/rotation/proposals                 - Get proposals
GET    /api/v2/rotation/proposals/conflicts       - Check conflicts
POST   /api/v2/rotation/proposals/:assignUuid/deploy  - Deploy assignment
POST   /api/v2/rotation/proposals/:assignUuid/reject  - Reject assignment

GET    /api/v2/rotation/archive                   - Get archived
GET    /api/v2/rotation/archive/:archiveUuid      - Get single archive

GET    /api/v2/rotation/due-crew                  - Get due crew
GET    /api/v2/rotation/crew/by-rank/:rank        - Get crew by rank (V2)
```

---

## Part 6: Migration Strategy

### 6.1 Migration Phases

```
┌─────────────────────────────────────────────────────────────────┐
│                    V2 MIGRATION PHASES                          │
└─────────────────────────────────────────────────────────────────┘

PHASE 1: Schema Creation (Non-Breaking)
├── Create all V2 tables with proper structure
├── Add indexes and constraints
├── No impact on V1 operations
└── Timeline: 1 week

PHASE 2: Service Layer
├── Create V2 controllers
├── Create V2 services
├── Create V2 routes
├── V1 and V2 run in parallel
└── Timeline: 2 weeks

PHASE 3: Data Migration
├── Write migration scripts
├── Transform V1 JSON to V2 normalized
├── Convert IDs to UUIDs
├── Populate audit columns
└── Timeline: 1 week

PHASE 4: Frontend Integration
├── Update UI to use V2 endpoints
├── Feature flags for gradual rollout
├── Test both paths
└── Timeline: 2 weeks

PHASE 5: Cleanup
├── Deprecate V1 endpoints
├── Remove V1 table references
├── Archive V1 tables
└── Timeline: 1 week
```

### 6.2 Data Migration Scripts

```typescript
// migrations/0085_create_admin_v2_tables.sql
// migrations/0086_create_vessel_v2_tables.sql
// migrations/0087_create_rotation_v2_tables.sql
// migrations/0088_migrate_admin_data_v1_to_v2.ts
// migrations/0089_migrate_vessel_data_v1_to_v2.ts
// migrations/0090_migrate_rotation_data_v1_to_v2.ts
```

---

## Part 7: Summary Statistics

### Tables Created

| Module | New V2 Tables | Replaces V1 Tables |
|--------|---------------|-------------------|
| Admin | 4 tables | 2 tables |
| Vessel | 7 tables | 4 tables |
| Rotation | 5 tables | 2 tables |
| **Total** | **16 tables** | **8 tables** |

### JSON Fields Normalized

| V1 Table | V1 JSON Field | V2 Normalized Table |
|----------|---------------|---------------------|
| vessel_revisions | revisionData | revision_ranks_v2 |
| vessel_drafts | draftData | draft_ranks_v2 |
| vessel_planning | handoverAttachments | planning_handover_attachments_v2 |
| rotation_plans | vessels | plan_vessels_v2 |
| rotation_plans | assignments | rotation_assignments_v2 |
| rotation_archive | currentCrewInfo | (stored in snapshot_data JSONB) |
| rotation_archive | fullAssignmentSnapshot | (stored in snapshot_data JSONB) |

### Boolean Columns Normalized

| V1 Table | Boolean Columns | V2 Solution |
|----------|-----------------|-------------|
| company_ranks | 19 designation booleans | rank_designations junction table |

---

## Part 8: Replit Implementation Prompt

```markdown
# Replit Implementation Task: Full V2 Upgrade for Admin, Vessel, Rotation Modules

## Objective

Upgrade Admin, Vessel, and Rotation modules to V2 architecture matching Crew Pool and Recruitment patterns.

## Prerequisites

- Reference existing V2 patterns in:
  - `server/v2/crew-pool/` (controller/service/routes pattern)
  - `shared/v2/crew-pool/schema.ts` (table definitions)
  - `shared/v2/recruitment/schema.ts` (table definitions)

## Deliverables

### Phase 1: Schema Creation

1. **Create shared/v2/admin/schema.ts**
   - `available_ranks_v2`
   - `rank_categories`
   - `company_ranks_v2`
   - `rank_designations`

2. **Create shared/v2/vessel/schema.ts**
   - `vessel_revisions_v2`
   - `revision_ranks_v2`
   - `vessel_drafts_v2`
   - `draft_ranks_v2`
   - `vessel_planning_v2`
   - `planning_relievers_v2`
   - `planning_contracts_v2`
   - `planning_handover_attachments_v2`

3. **Create shared/v2/rotation/schema.ts**
   - `rotation_plans_v2`
   - `plan_vessels_v2`
   - `plan_ranks_v2`
   - `rotation_assignments_v2`
   - `rotation_archive_v2`

4. **Create migration file**
   - `migrations/0085_create_v2_admin_vessel_rotation_tables.sql`

### Phase 2: Backend Services

1. **Create server/v2/admin/**
   - controllers/ranksController.ts
   - controllers/companyRanksController.ts
   - services/ranksService.ts
   - services/companyRanksService.ts
   - routes.ts

2. **Create server/v2/vessel/**
   - controllers/revisionsController.ts
   - controllers/draftsController.ts
   - controllers/planningController.ts
   - services/revisionsService.ts
   - services/draftsService.ts
   - services/planningService.ts
   - routes.ts

3. **Create server/v2/rotation/**
   - controllers/plansController.ts
   - controllers/assignmentsController.ts
   - controllers/proposalsController.ts
   - services/plansService.ts
   - services/assignmentsService.ts
   - services/deploymentService.ts
   - services/conflictService.ts
   - routes.ts

### Phase 3: Integration

1. **Register V2 routes in server/routes.ts**
   ```typescript
   app.use("/api/v2/admin", adminV2Routes);
   app.use("/api/v2/vessel", vesselV2Routes);
   app.use("/api/v2/rotation", rotationV2Routes);
   ```

2. **Update rotation deployment to sync with crew_assignments**
   - In deploymentService.ts, write to both vessel_planning_v2 and crew_assignments

3. **Add V2 crew by-rank endpoint**
   - In rotation routes, add `/crew/by-rank/:rank` that queries crew_members_v2

## Key Requirements

1. **All tables must have:**
   - UUID primary key column (e.g., `plan_uuid`)
   - Standard audit columns (createdAt, updatedAt, createdByUuid, updatedByUuid, isDeleted, deletedAt)
   - Proper foreign key constraints

2. **No JSON storage:**
   - All JSON fields must be normalized to separate tables
   - Exception: snapshot_data in archive can use JSONB for audit purposes

3. **Service pattern:**
   - Each service handles one domain entity
   - Controllers call services, services call database
   - Proper error handling with try/catch

4. **Transaction support:**
   - Multi-table operations wrapped in db.transaction()

## Testing Checklist

- [ ] Create V2 rank → verify in database
- [ ] Create V2 vessel revision → verify ranks normalized
- [ ] Create V2 rotation plan → verify vessels/ranks normalized
- [ ] Add assignment to plan → verify in rotation_assignments_v2
- [ ] Deploy assignment → verify updates vessel_planning_v2 AND crew_assignments
- [ ] V2 crew appears in rotation crew selection

## Definition of Done

- [ ] All 16 V2 tables created with proper schema
- [ ] All V2 endpoints functional
- [ ] JSON fields eliminated (normalized)
- [ ] Audit columns populated on all operations
- [ ] Foreign keys enforced
- [ ] V2 crew integrated with rotation
- [ ] Deployment syncs vessel_planning_v2 + crew_assignments
```

---

**Document Version:** 1.0
**Created:** January 28, 2026
**Status:** READY FOR IMPLEMENTATION

---

**End of Document**
