# Appraisal Module V2 Migration Plan

## Overview

Migrate the Appraisal module from V1 (single `appraisal_results` table with `appraisal_data` JSON blob, `stage_statuses` JSON, `stage_payloads` JSON) to V2 (normalized relational tables with UUID identifiers and audit columns). The V1 `appraisal_results` table stores all appraisal sections (Parts A-G) as a single JSON string in `appraisal_data`, plus stage workflow tracking as JSON in `stage_statuses` and `stage_payloads`.

**No V1 code is modified.** V2 is fully isolated in its own folder structure.

---

## Architecture: V1 vs V2

### V1 (Current)

**1 table**: `appraisal_results` with 3 JSON text columns + flat columns:

```
appraisal_results
├── id                  SERIAL PK
├── crew_member_id      TEXT FK → crew_members.id
├── form_id             INTEGER FK → forms.id
├── appraisal_type      TEXT
├── appraisal_date      TEXT
├── appraisal_data      TEXT (JSON string — entire Parts A-G payload)
├── competence_rating   TEXT
├── behavioral_rating   TEXT
├── overall_rating      TEXT
├── submitted_at        TIMESTAMP
├── submitted_by        TEXT
├── status              TEXT (draft | preliminary | submitted | reviewed)
├── stage_statuses      TEXT (JSON string — {stage1: {status, submittedAt, submittedBy}, ...})
└── stage_payloads      TEXT (JSON string — {stage1: {...}, stage2: {...}, stage3: {...}})
```

**V1 `appraisal_data` JSON structure** (from AppraisalForm.tsx schemas):

```json
{
  "seafarersName": "string",
  "seafarersRank": "string",
  "nationality": "string",
  "vessel": "string",
  "signOn": "string",
  "appraisalType": "string",
  "appraisalPeriodFrom": "string",
  "appraisalPeriodTo": "string",
  "personalityIndexCategory": "string",
  "primaryAppraiser": "string",
  "trainings": [
    { "id": "string", "training": "string", "evaluation": "string", "comment": "string" }
  ],
  "targets": [
    { "id": "string", "targetSetting": "string", "evaluation": "string", "comment": "string" }
  ],
  "competenceAssessments": [
    { "id": "string", "assessmentCriteria": "string", "weight": number, "effectiveness": "string", "comment": "string" }
  ],
  "behaviouralAssessments": [
    { "id": "string", "assessmentCriteria": "string", "weight": number, "effectiveness": "string", "comment": "string" }
  ],
  "trainingNeeds": [
    { "id": "string", "training": "string", "comment": "string" }
  ],
  "recommendations": [
    { "id": "string", "question": "string", "answer": "Yes|No|NA|", "comment": "string" }
  ],
  "appraiserComments": [
    { "id": "string", "name": "string", "rank": "string", "comment": "string" }
  ],
  "seafarerComments": [
    { "id": "string", "name": "string", "rank": "string", "comment": "string" }
  ],
  "officeReviews": [
    { "id": "string", "name": "string", "position": "string", "feedback": "string" }
  ],
  "trainingFollowups": [
    { "id": "string", "training": "string", "correspondingInDB": "string", "category": "string", "status": "string", "targetDate": "string", "comment": "string" }
  ]
}
```

**V1 `stage_statuses` JSON structure**:
```json
{
  "stage1": { "status": "completed", "submittedAt": "ISO string", "submittedBy": "string" },
  "stage2": { "status": "completed", "submittedAt": "ISO string", "submittedBy": "string" },
  "stage3": { "status": "completed", "submittedAt": "ISO string", "submittedBy": "string" }
}
```

**V1 `stage_payloads` JSON structure**:
```json
{
  "stage1": { "seafarersName": "...", "trainings": [...], "targets": [...], ... },
  "stage2": { "competenceAssessments": [...], "behaviouralAssessments": [...], ... },
  "stage3": { "officeReviews": [...], "trainingFollowups": [...] }
}
```

**V1 Stage → Parts mapping**:
- Stage 1: Part A (seafarer info) + Part B (trainings, targets)
- Stage 2: Part C (competenceAssessments) + Part D (behaviouralAssessments) + Part E (trainingNeeds) + Part F (recommendations, appraiserComments, seafarerComments)
- Stage 3: Part G (officeReviews, trainingFollowups)

### V2 (Target — 1 parent + 10 child tables, all ending with `_v2`)

1. **`appraisal_results_v2`** — Parent record (Part A flat fields + ratings + stage status flat columns, no JSON)
2. **`appr_trainings_v2`** — Part B trainings array → one row per training per appraisal
3. **`appr_targets_v2`** — Part B targets array → one row per target per appraisal
4. **`appr_competence_assessments_v2`** — Part C → one row per competence assessment
5. **`appr_behavioural_assessments_v2`** — Part D → one row per behavioural assessment
6. **`appr_training_needs_v2`** — Part E → one row per training need
7. **`appr_recommendations_v2`** — Part F recommendations → one row per recommendation
8. **`appr_appraiser_comments_v2`** — Part F appraiserComments → one row per comment
9. **`appr_seafarer_comments_v2`** — Part F seafarerComments → one row per comment
10. **`appr_office_reviews_v2`** — Part G officeReviews → one row per review
11. **`appr_training_followups_v2`** — Part G trainingFollowups → one row per followup

All tables have: `id SERIAL PK`, `{prefix}_uuid TEXT UNIQUE`, `audit columns` (created_by_uuid, updated_by_uuid), `is_deleted`, `is_sync`, `sort_order`, `created_at`, `updated_at`.

### V2 Admin Table References
The V2 appraisal module references these existing V2 tables (not V1):
- **Forms**: `adm_forms_v2` via `/api/v2/admin/forms`
- **Rank Groups**: `adm_rank_groups_v2` via `/api/v2/admin/rank-groups`
- **Available Ranks**: `adm_available_ranks_v2` via `/api/v2/admin/available-ranks`
- **Company Ranks**: `adm_company_ranks_v2` via `/api/v2/admin/company-ranks`
- **Vessels**: `master_vessels` via `/api/v2/masters/vessels` (useVesselsV2 hook)
- **Nationalities**: `master_nationalities` via `/api/v2/masters/nationalities` (useNationalitiesV2 hook)

---

## Step-by-Step Plan

### STEP 1: Database Migration

**File**: `server/migrations/NNNN_create_appraisal_v2_tables.sql`

Create all 11 tables using `CREATE TABLE IF NOT EXISTS`:

#### 1.1 `appraisal_results_v2`
Parent table. Part A flat fields extracted from `appraisal_data` JSON. Stage statuses flattened from `stage_statuses` JSON. No JSON columns.

```sql
CREATE TABLE IF NOT EXISTS appraisal_results_v2 (
  id SERIAL PRIMARY KEY,
  appraisal_uuid TEXT NOT NULL UNIQUE,
  crew_member_id TEXT NOT NULL,
  form_uuid TEXT,
  appraisal_type TEXT NOT NULL,
  appraisal_date TEXT NOT NULL,
  -- Part A fields (from appraisal_data JSON root)
  seafarers_name TEXT,
  seafarers_rank TEXT,
  nationality TEXT,
  vessel TEXT,
  sign_on TEXT,
  appraisal_period_from TEXT,
  appraisal_period_to TEXT,
  personality_index_category TEXT,
  primary_appraiser TEXT,
  form_id_legacy INTEGER,
  -- Computed ratings
  competence_rating TEXT,
  behavioral_rating TEXT,
  overall_rating TEXT,
  -- Submission info
  submitted_at TIMESTAMP DEFAULT NOW(),
  submitted_by TEXT NOT NULL,
  -- Overall status
  status TEXT NOT NULL DEFAULT 'draft',
  -- Stage statuses (flattened from stage_statuses JSON)
  stage1_status TEXT,
  stage1_submitted_at TEXT,
  stage1_submitted_by TEXT,
  stage2_status TEXT,
  stage2_submitted_at TEXT,
  stage2_submitted_by TEXT,
  stage3_status TEXT,
  stage3_submitted_at TEXT,
  stage3_submitted_by TEXT,
  -- Standard V2 columns
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);
```

**Column mapping from V1**:
| V1 column | V2 column | Notes |
|-----------|-----------|-------|
| `id` | `id` | SERIAL PK (same) |
| — | `appraisal_uuid` | New UUID unique key |
| `crew_member_id` | `crew_member_id` | Same |
| `form_id` | `form_uuid` | Changed from integer FK to text UUID ref |
| `appraisal_type` | `appraisal_type` | Same |
| `appraisal_date` | `appraisal_date` | Same |
| `appraisal_data` → `.seafarersName` | `seafarers_name` | Extracted from JSON |
| `appraisal_data` → `.seafarersRank` | `seafarers_rank` | Extracted from JSON |
| `appraisal_data` → `.nationality` | `nationality` | Extracted from JSON |
| `appraisal_data` → `.vessel` | `vessel` | Extracted from JSON |
| `appraisal_data` → `.signOn` | `sign_on` | Extracted from JSON |
| `appraisal_data` → `.appraisalPeriodFrom` | `appraisal_period_from` | Extracted from JSON |
| `appraisal_data` → `.appraisalPeriodTo` | `appraisal_period_to` | Extracted from JSON |
| `appraisal_data` → `.personalityIndexCategory` | `personality_index_category` | Extracted from JSON |
| `appraisal_data` → `.primaryAppraiser` | `primary_appraiser` | Extracted from JSON |
| `competence_rating` | `competence_rating` | Same |
| `behavioral_rating` | `behavioral_rating` | Same |
| `overall_rating` | `overall_rating` | Same |
| `submitted_at` | `submitted_at` | Same |
| `submitted_by` | `submitted_by` | Same |
| `status` | `status` | Same |
| `stage_statuses` → `.stage1.status` | `stage1_status` | Flattened from JSON |
| `stage_statuses` → `.stage1.submittedAt` | `stage1_submitted_at` | Flattened from JSON |
| `stage_statuses` → `.stage1.submittedBy` | `stage1_submitted_by` | Flattened from JSON |
| `stage_statuses` → `.stage2.status` | `stage2_status` | Flattened from JSON |
| `stage_statuses` → `.stage2.submittedAt` | `stage2_submitted_at` | Flattened from JSON |
| `stage_statuses` → `.stage2.submittedBy` | `stage2_submitted_by` | Flattened from JSON |
| `stage_statuses` → `.stage3.status` | `stage3_status` | Flattened from JSON |
| `stage_statuses` → `.stage3.submittedAt` | `stage3_submitted_at` | Flattened from JSON |
| `stage_statuses` → `.stage3.submittedBy` | `stage3_submitted_by` | Flattened from JSON |
| `stage_payloads` | — | Not stored separately; child table rows ARE the stage payloads |

#### 1.2 `appr_trainings_v2`
Replaces `appraisal_data` → `trainings[]` array (Part B).

```sql
CREATE TABLE IF NOT EXISTS appr_trainings_v2 (
  id SERIAL PRIMARY KEY,
  tr_uuid TEXT NOT NULL UNIQUE,
  appraisal_uuid TEXT NOT NULL,
  training TEXT,
  evaluation TEXT,
  comment TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);
```

**Column mapping**: `trainings[].id` → row identity (use sort_order), `trainings[].training` → `training`, `trainings[].evaluation` → `evaluation`, `trainings[].comment` → `comment`

#### 1.3 `appr_targets_v2`
Replaces `appraisal_data` → `targets[]` array (Part B).

```sql
CREATE TABLE IF NOT EXISTS appr_targets_v2 (
  id SERIAL PRIMARY KEY,
  tg_uuid TEXT NOT NULL UNIQUE,
  appraisal_uuid TEXT NOT NULL,
  target_setting TEXT,
  evaluation TEXT,
  comment TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);
```

**Column mapping**: `targets[].targetSetting` → `target_setting`, `targets[].evaluation` → `evaluation`, `targets[].comment` → `comment`

#### 1.4 `appr_competence_assessments_v2`
Replaces `appraisal_data` → `competenceAssessments[]` array (Part C).

```sql
CREATE TABLE IF NOT EXISTS appr_competence_assessments_v2 (
  id SERIAL PRIMARY KEY,
  ca_uuid TEXT NOT NULL UNIQUE,
  appraisal_uuid TEXT NOT NULL,
  assessment_criteria TEXT,
  weight INTEGER,
  effectiveness TEXT,
  comment TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);
```

**Column mapping**: `competenceAssessments[].assessmentCriteria` → `assessment_criteria`, `.weight` → `weight`, `.effectiveness` → `effectiveness`, `.comment` → `comment`

#### 1.5 `appr_behavioural_assessments_v2`
Replaces `appraisal_data` → `behaviouralAssessments[]` array (Part D).

```sql
CREATE TABLE IF NOT EXISTS appr_behavioural_assessments_v2 (
  id SERIAL PRIMARY KEY,
  ba_uuid TEXT NOT NULL UNIQUE,
  appraisal_uuid TEXT NOT NULL,
  assessment_criteria TEXT,
  weight INTEGER,
  effectiveness TEXT,
  comment TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);
```

**Column mapping**: `behaviouralAssessments[].assessmentCriteria` → `assessment_criteria`, `.weight` → `weight`, `.effectiveness` → `effectiveness`, `.comment` → `comment`

#### 1.6 `appr_training_needs_v2`
Replaces `appraisal_data` → `trainingNeeds[]` array (Part E).

```sql
CREATE TABLE IF NOT EXISTS appr_training_needs_v2 (
  id SERIAL PRIMARY KEY,
  tn_uuid TEXT NOT NULL UNIQUE,
  appraisal_uuid TEXT NOT NULL,
  training TEXT,
  comment TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);
```

**Column mapping**: `trainingNeeds[].training` → `training`, `.comment` → `comment`

#### 1.7 `appr_recommendations_v2`
Replaces `appraisal_data` → `recommendations[]` array (Part F).

```sql
CREATE TABLE IF NOT EXISTS appr_recommendations_v2 (
  id SERIAL PRIMARY KEY,
  rc_uuid TEXT NOT NULL UNIQUE,
  appraisal_uuid TEXT NOT NULL,
  question TEXT,
  answer TEXT,
  comment TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);
```

**Column mapping**: `recommendations[].question` → `question`, `.answer` → `answer` (Yes|No|NA|""), `.comment` → `comment`

#### 1.8 `appr_appraiser_comments_v2`
Replaces `appraisal_data` → `appraiserComments[]` array (Part F).

```sql
CREATE TABLE IF NOT EXISTS appr_appraiser_comments_v2 (
  id SERIAL PRIMARY KEY,
  ac_uuid TEXT NOT NULL UNIQUE,
  appraisal_uuid TEXT NOT NULL,
  name TEXT,
  rank TEXT,
  comment TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);
```

**Column mapping**: `appraiserComments[].name` → `name`, `.rank` → `rank`, `.comment` → `comment`

#### 1.9 `appr_seafarer_comments_v2`
Replaces `appraisal_data` → `seafarerComments[]` array (Part F).

```sql
CREATE TABLE IF NOT EXISTS appr_seafarer_comments_v2 (
  id SERIAL PRIMARY KEY,
  sc_uuid TEXT NOT NULL UNIQUE,
  appraisal_uuid TEXT NOT NULL,
  name TEXT,
  rank TEXT,
  comment TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);
```

**Column mapping**: `seafarerComments[].name` → `name`, `.rank` → `rank`, `.comment` → `comment`

#### 1.10 `appr_office_reviews_v2`
Replaces `appraisal_data` → `officeReviews[]` array (Part G).

```sql
CREATE TABLE IF NOT EXISTS appr_office_reviews_v2 (
  id SERIAL PRIMARY KEY,
  or_uuid TEXT NOT NULL UNIQUE,
  appraisal_uuid TEXT NOT NULL,
  name TEXT,
  position TEXT,
  feedback TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);
```

**Column mapping**: `officeReviews[].name` → `name`, `.position` → `position`, `.feedback` → `feedback`

#### 1.11 `appr_training_followups_v2`
Replaces `appraisal_data` → `trainingFollowups[]` array (Part G).

```sql
CREATE TABLE IF NOT EXISTS appr_training_followups_v2 (
  id SERIAL PRIMARY KEY,
  tf_uuid TEXT NOT NULL UNIQUE,
  appraisal_uuid TEXT NOT NULL,
  training TEXT,
  corresponding_in_db TEXT,
  category TEXT,
  status TEXT,
  target_date TEXT,
  comment TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);
```

**Column mapping**: `trainingFollowups[].training` → `training`, `.correspondingInDB` → `corresponding_in_db`, `.category` → `category`, `.status` → `status` (Proposed|Approved|Planned|Declined|Completed), `.targetDate` → `target_date`, `.comment` → `comment`

---

### STEP 2: Drizzle Schema Definitions

**File**: `shared/v2/appraisals/schema.ts`

Define all 11 tables using Drizzle ORM `pgTable()` with proper column types matching the SQL migration. Reuse `auditColumns` pattern from `shared/v2/admin/schema.ts`.

```typescript
import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";

const auditColumns = {
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
};

export const appraisalResultsV2 = pgTable("appraisal_results_v2", {
  id: serial("id").primaryKey(),
  appraisalUuid: text("appraisal_uuid").notNull().unique(),
  crewMemberId: text("crew_member_id").notNull(),
  formUuid: text("form_uuid"),
  formIdLegacy: integer("form_id_legacy"),
  appraisalType: text("appraisal_type").notNull(),
  appraisalDate: text("appraisal_date").notNull(),
  seafarersName: text("seafarers_name"),
  seafarersRank: text("seafarers_rank"),
  nationality: text("nationality"),
  vessel: text("vessel"),
  signOn: text("sign_on"),
  appraisalPeriodFrom: text("appraisal_period_from"),
  appraisalPeriodTo: text("appraisal_period_to"),
  personalityIndexCategory: text("personality_index_category"),
  primaryAppraiser: text("primary_appraiser"),
  competenceRating: text("competence_rating"),
  behavioralRating: text("behavioral_rating"),
  overallRating: text("overall_rating"),
  submittedAt: timestamp("submitted_at").defaultNow(),
  submittedBy: text("submitted_by").notNull(),
  status: text("status").notNull().default("draft"),
  stage1Status: text("stage1_status"),
  stage1SubmittedAt: text("stage1_submitted_at"),
  stage1SubmittedBy: text("stage1_submitted_by"),
  stage2Status: text("stage2_status"),
  stage2SubmittedAt: text("stage2_submitted_at"),
  stage2SubmittedBy: text("stage2_submitted_by"),
  stage3Status: text("stage3_status"),
  stage3SubmittedAt: text("stage3_submitted_at"),
  stage3SubmittedBy: text("stage3_submitted_by"),
  ...auditColumns,
});

export const apprTrainingsV2 = pgTable("appr_trainings_v2", {
  id: serial("id").primaryKey(),
  trUuid: text("tr_uuid").notNull().unique(),
  appraisalUuid: text("appraisal_uuid").notNull(),
  training: text("training"),
  evaluation: text("evaluation"),
  comment: text("comment"),
  ...auditColumns,
});

export const apprTargetsV2 = pgTable("appr_targets_v2", {
  id: serial("id").primaryKey(),
  tgUuid: text("tg_uuid").notNull().unique(),
  appraisalUuid: text("appraisal_uuid").notNull(),
  targetSetting: text("target_setting"),
  evaluation: text("evaluation"),
  comment: text("comment"),
  ...auditColumns,
});

export const apprCompetenceAssessmentsV2 = pgTable("appr_competence_assessments_v2", {
  id: serial("id").primaryKey(),
  caUuid: text("ca_uuid").notNull().unique(),
  appraisalUuid: text("appraisal_uuid").notNull(),
  assessmentCriteria: text("assessment_criteria"),
  weight: integer("weight"),
  effectiveness: text("effectiveness"),
  comment: text("comment"),
  ...auditColumns,
});

export const apprBehaviouralAssessmentsV2 = pgTable("appr_behavioural_assessments_v2", {
  id: serial("id").primaryKey(),
  baUuid: text("ba_uuid").notNull().unique(),
  appraisalUuid: text("appraisal_uuid").notNull(),
  assessmentCriteria: text("assessment_criteria"),
  weight: integer("weight"),
  effectiveness: text("effectiveness"),
  comment: text("comment"),
  ...auditColumns,
});

export const apprTrainingNeedsV2 = pgTable("appr_training_needs_v2", {
  id: serial("id").primaryKey(),
  tnUuid: text("tn_uuid").notNull().unique(),
  appraisalUuid: text("appraisal_uuid").notNull(),
  training: text("training"),
  comment: text("comment"),
  ...auditColumns,
});

export const apprRecommendationsV2 = pgTable("appr_recommendations_v2", {
  id: serial("id").primaryKey(),
  rcUuid: text("rc_uuid").notNull().unique(),
  appraisalUuid: text("appraisal_uuid").notNull(),
  question: text("question"),
  answer: text("answer"),
  comment: text("comment"),
  ...auditColumns,
});

export const apprAppraiserCommentsV2 = pgTable("appr_appraiser_comments_v2", {
  id: serial("id").primaryKey(),
  acUuid: text("ac_uuid").notNull().unique(),
  appraisalUuid: text("appraisal_uuid").notNull(),
  name: text("name"),
  rank: text("rank"),
  comment: text("comment"),
  ...auditColumns,
});

export const apprSeafarerCommentsV2 = pgTable("appr_seafarer_comments_v2", {
  id: serial("id").primaryKey(),
  scUuid: text("sc_uuid").notNull().unique(),
  appraisalUuid: text("appraisal_uuid").notNull(),
  name: text("name"),
  rank: text("rank"),
  comment: text("comment"),
  ...auditColumns,
});

export const apprOfficeReviewsV2 = pgTable("appr_office_reviews_v2", {
  id: serial("id").primaryKey(),
  orUuid: text("or_uuid").notNull().unique(),
  appraisalUuid: text("appraisal_uuid").notNull(),
  name: text("name"),
  position: text("position"),
  feedback: text("feedback"),
  ...auditColumns,
});

export const apprTrainingFollowupsV2 = pgTable("appr_training_followups_v2", {
  id: serial("id").primaryKey(),
  tfUuid: text("tf_uuid").notNull().unique(),
  appraisalUuid: text("appraisal_uuid").notNull(),
  training: text("training"),
  correspondingInDb: text("corresponding_in_db"),
  category: text("category"),
  status: text("status"),
  targetDate: text("target_date"),
  comment: text("comment"),
  ...auditColumns,
});
```

**File**: `shared/v2/appraisals/types.ts`

For each table, define:
- `insertSchema` using `createInsertSchema(table).omit({ id: true, createdAt: true, updatedAt: true })`
- `InsertType` = `z.infer<typeof insertSchema>`
- `SelectType` = `typeof table.$inferSelect`

---

### STEP 3: Backend — Repositories (with batch query optimization)

**Directory**: `server/v2/appraisals/repositories/`

**Key design**: Same as Promotions V2. The `appraisalResultsRepository` uses batch queries to avoid N+1. When fetching appraisals (list or by ID), it performs:
1. One query for the appraisal(s) from `appraisal_results_v2`
2. One batched query per child table using `WHERE appraisal_uuid IN (...)` — NOT one query per appraisal

This means fetching 50 appraisals = 1 appraisal query + 10 child table queries = **11 total queries** instead of 50 × 10 = 500 queries.

| File | Class | Key Methods |
|------|-------|-------------|
| `appraisalResultsRepository.ts` | `AppraisalResultsRepository` | `findAll()`, `findById(id)`, `findByAppraisalUuid(uuid)`, `findByCrewMemberId(crewMemberId)`, `create(data)`, `updateByAppraisalUuid(uuid, data)`, `softDeleteById(id)` |
| `apprTrainingsRepository.ts` | `ApprTrainingsRepository` | `findByAppraisalUuids(uuids[])` ← batch, `syncForAppraisal(appraisalUuid, rows[])` |
| `apprTargetsRepository.ts` | `ApprTargetsRepository` | `findByAppraisalUuids(uuids[])` ← batch, `syncForAppraisal(appraisalUuid, rows[])` |
| `apprCompetenceAssessmentsRepository.ts` | `ApprCompetenceAssessmentsRepository` | `findByAppraisalUuids(uuids[])` ← batch, `syncForAppraisal(appraisalUuid, rows[])` |
| `apprBehaviouralAssessmentsRepository.ts` | `ApprBehaviouralAssessmentsRepository` | `findByAppraisalUuids(uuids[])` ← batch, `syncForAppraisal(appraisalUuid, rows[])` |
| `apprTrainingNeedsRepository.ts` | `ApprTrainingNeedsRepository` | `findByAppraisalUuids(uuids[])` ← batch, `syncForAppraisal(appraisalUuid, rows[])` |
| `apprRecommendationsRepository.ts` | `ApprRecommendationsRepository` | `findByAppraisalUuids(uuids[])` ← batch, `syncForAppraisal(appraisalUuid, rows[])` |
| `apprAppraiserCommentsRepository.ts` | `ApprAppraiserCommentsRepository` | `findByAppraisalUuids(uuids[])` ← batch, `syncForAppraisal(appraisalUuid, rows[])` |
| `apprSeafarerCommentsRepository.ts` | `ApprSeafarerCommentsRepository` | `findByAppraisalUuids(uuids[])` ← batch, `syncForAppraisal(appraisalUuid, rows[])` |
| `apprOfficeReviewsRepository.ts` | `ApprOfficeReviewsRepository` | `findByAppraisalUuids(uuids[])` ← batch, `syncForAppraisal(appraisalUuid, rows[])` |
| `apprTrainingFollowupsRepository.ts` | `ApprTrainingFollowupsRepository` | `findByAppraisalUuids(uuids[])` ← batch, `syncForAppraisal(appraisalUuid, rows[])` |

**Batch query pattern** (same as Promotions V2):
```typescript
async findByAppraisalUuids(appraisalUuids: string[]): Promise<Map<string, ChildRow[]>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(childTable)
    .where(and(
      inArray(childTable.appraisalUuid, appraisalUuids),
      eq(childTable.isDeleted, false)
    ));
  const map = new Map<string, ChildRow[]>();
  for (const row of rows) {
    if (!map.has(row.appraisalUuid)) map.set(row.appraisalUuid, []);
    map.get(row.appraisalUuid)!.push(row);
  }
  return map;
}
```

**`syncForAppraisal` pattern** (delete old + insert new):
```typescript
async syncForAppraisal(appraisalUuid: string, rows: InsertRow[], auditUserUuid?: string): Promise<void> {
  const db = getDb();
  // Soft-delete existing rows
  await db.update(childTable)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(and(eq(childTable.appraisalUuid, appraisalUuid), eq(childTable.isDeleted, false)));
  // Insert new rows
  if (rows.length > 0) {
    const rowsWithUuids = rows.map((row, i) => ({
      ...row,
      [uuidField]: crypto.randomUUID(),
      appraisalUuid,
      sortOrder: i,
      createdByUuid: auditUserUuid,
      updatedByUuid: auditUserUuid,
    }));
    await db.insert(childTable).values(rowsWithUuids);
  }
}
```

**File**: `server/v2/appraisals/repositories/index.ts` — barrel export

---

### STEP 4: Backend — Services (V1-compatible response assembly)

**Directory**: `server/v2/appraisals/services/`

Services wrap repositories with business logic and audit user handling via `applyAuditUser()` from `server/v2/admin/utils/auditUser.ts` (reused, not duplicated).

#### 4.1 `appraisalResultsService.ts` — **Core service**

**GET methods** (all return V1-shaped response via `assembleV1Response`):

```typescript
async getAll(): Promise<V1AppraisalResult[]> {
  // 1. Fetch all non-deleted, non-draft appraisals (same filter as V1)
  const appraisals = await appraisalResultsRepo.findAll(); // WHERE status != 'draft' AND is_deleted = false
  if (appraisals.length === 0) return [];

  // 2. Batch-fetch all child data for ALL appraisal UUIDs in parallel (no N+1)
  const appraisalUuids = appraisals.map(a => a.appraisalUuid);
  const [trainings, targets, competenceAssessments, behaviouralAssessments,
         trainingNeeds, recommendations, appraiserComments, seafarerComments,
         officeReviews, trainingFollowups] = await Promise.all([
    trainingsRepo.findByAppraisalUuids(appraisalUuids),
    targetsRepo.findByAppraisalUuids(appraisalUuids),
    competenceAssessmentsRepo.findByAppraisalUuids(appraisalUuids),
    behaviouralAssessmentsRepo.findByAppraisalUuids(appraisalUuids),
    trainingNeedsRepo.findByAppraisalUuids(appraisalUuids),
    recommendationsRepo.findByAppraisalUuids(appraisalUuids),
    appraiserCommentsRepo.findByAppraisalUuids(appraisalUuids),
    seafarerCommentsRepo.findByAppraisalUuids(appraisalUuids),
    officeReviewsRepo.findByAppraisalUuids(appraisalUuids),
    trainingFollowupsRepo.findByAppraisalUuids(appraisalUuids),
  ]);

  // 3. Assemble V1-shaped response for each appraisal
  return appraisals.map(appraisal => assembleV1Response(
    appraisal,
    trainings.get(appraisal.appraisalUuid) || [],
    targets.get(appraisal.appraisalUuid) || [],
    competenceAssessments.get(appraisal.appraisalUuid) || [],
    behaviouralAssessments.get(appraisal.appraisalUuid) || [],
    trainingNeeds.get(appraisal.appraisalUuid) || [],
    recommendations.get(appraisal.appraisalUuid) || [],
    appraiserComments.get(appraisal.appraisalUuid) || [],
    seafarerComments.get(appraisal.appraisalUuid) || [],
    officeReviews.get(appraisal.appraisalUuid) || [],
    trainingFollowups.get(appraisal.appraisalUuid) || [],
  ));
}
```

Total queries for getAll() with N appraisals: **11 queries** (1 parent + 10 child tables), regardless of N.

**POST/PUT methods** (accept V1-format body, same variables as V1 routes):

```typescript
async create(body: any): Promise<V1AppraisalResult> {
  const auditUserUuid = body.auditUserUuid;
  // 1. Parse appraisalData (object or JSON string)
  const appraisalData = typeof body.appraisalData === 'object'
    ? body.appraisalData
    : JSON.parse(body.appraisalData || '{}');

  // 2. Create parent record with Part A flat fields extracted
  const appraisalUuid = crypto.randomUUID();
  await appraisalResultsRepo.create({
    appraisalUuid,
    crewMemberId: body.crewMemberId,
    formUuid: body.formId?.toString(),
    appraisalType: body.appraisalType,
    appraisalDate: body.appraisalDate,
    seafarersName: appraisalData.seafarersName,
    seafarersRank: appraisalData.seafarersRank,
    nationality: appraisalData.nationality,
    vessel: appraisalData.vessel,
    signOn: appraisalData.signOn,
    appraisalPeriodFrom: appraisalData.appraisalPeriodFrom,
    appraisalPeriodTo: appraisalData.appraisalPeriodTo,
    personalityIndexCategory: appraisalData.personalityIndexCategory,
    primaryAppraiser: appraisalData.primaryAppraiser,
    competenceRating: body.competenceRating,
    behavioralRating: body.behavioralRating,
    overallRating: body.overallRating,
    submittedBy: body.submittedBy,
    status: body.status || 'draft',
    createdByUuid: auditUserUuid,
    updatedByUuid: auditUserUuid,
  });

  // 3. Sync child tables from appraisalData arrays
  await Promise.all([
    trainingsRepo.syncForAppraisal(appraisalUuid, appraisalData.trainings || [], auditUserUuid),
    targetsRepo.syncForAppraisal(appraisalUuid, appraisalData.targets || [], auditUserUuid),
    competenceAssessmentsRepo.syncForAppraisal(appraisalUuid, appraisalData.competenceAssessments || [], auditUserUuid),
    behaviouralAssessmentsRepo.syncForAppraisal(appraisalUuid, appraisalData.behaviouralAssessments || [], auditUserUuid),
    trainingNeedsRepo.syncForAppraisal(appraisalUuid, appraisalData.trainingNeeds || [], auditUserUuid),
    recommendationsRepo.syncForAppraisal(appraisalUuid, appraisalData.recommendations || [], auditUserUuid),
    appraiserCommentsRepo.syncForAppraisal(appraisalUuid, appraisalData.appraiserComments || [], auditUserUuid),
    seafarerCommentsRepo.syncForAppraisal(appraisalUuid, appraisalData.seafarerComments || [], auditUserUuid),
    officeReviewsRepo.syncForAppraisal(appraisalUuid, appraisalData.officeReviews || [], auditUserUuid),
    trainingFollowupsRepo.syncForAppraisal(appraisalUuid, appraisalData.trainingFollowups || [], auditUserUuid),
  ]);

  // 4. Return V1-shaped response
  return this.getById(/* newly created id */);
}
```

**Stage submission** (same logic as V1 `submitAppraisalStage`):

```typescript
async submitStage(id: number, stage: 'stage1' | 'stage2' | 'stage3', data: any, submittedBy: string): Promise<V1AppraisalResult> {
  const appraisal = await appraisalResultsRepo.findById(id);
  if (!appraisal) throw new Error('Appraisal not found');

  // Enforce sequential stage progression (same as V1)
  if (stage === 'stage2' && !appraisal.stage1Status) {
    throw new Error('Stage 1 must be submitted before Stage 2');
  }
  if (stage === 'stage3' && !appraisal.stage2Status) {
    throw new Error('Stage 2 must be submitted before Stage 3');
  }

  // Determine new overall status (same logic as V1)
  let newStatus = appraisal.status;
  if (stage === 'stage1') newStatus = 'preliminary';
  else if (stage === 'stage2') newStatus = 'submitted';
  else if (stage === 'stage3') newStatus = 'reviewed';

  // Update parent record with stage status + Part A fields if stage1
  const stageUpdate: any = {
    [`${stage}Status`]: 'completed',
    [`${stage}SubmittedAt`]: new Date().toISOString(),
    [`${stage}SubmittedBy`]: submittedBy,
    status: newStatus,
    submittedBy,
    submittedAt: new Date(),
  };

  // If stage1, also update Part A flat fields on parent
  if (stage === 'stage1') {
    stageUpdate.seafarersName = data.seafarersName;
    stageUpdate.seafarersRank = data.seafarersRank;
    stageUpdate.nationality = data.nationality;
    stageUpdate.vessel = data.vessel;
    stageUpdate.signOn = data.signOn;
    stageUpdate.appraisalType = data.appraisalType;
    stageUpdate.appraisalPeriodFrom = data.appraisalPeriodFrom;
    stageUpdate.appraisalPeriodTo = data.appraisalPeriodTo;
    stageUpdate.personalityIndexCategory = data.personalityIndexCategory;
    stageUpdate.primaryAppraiser = data.primaryAppraiser;
  }

  await appraisalResultsRepo.updateByAppraisalUuid(appraisal.appraisalUuid, stageUpdate);

  // Sync child tables for this stage's arrays
  if (stage === 'stage1') {
    await Promise.all([
      trainingsRepo.syncForAppraisal(appraisal.appraisalUuid, data.trainings || []),
      targetsRepo.syncForAppraisal(appraisal.appraisalUuid, data.targets || []),
    ]);
  } else if (stage === 'stage2') {
    await Promise.all([
      competenceAssessmentsRepo.syncForAppraisal(appraisal.appraisalUuid, data.competenceAssessments || []),
      behaviouralAssessmentsRepo.syncForAppraisal(appraisal.appraisalUuid, data.behaviouralAssessments || []),
      trainingNeedsRepo.syncForAppraisal(appraisal.appraisalUuid, data.trainingNeeds || []),
      recommendationsRepo.syncForAppraisal(appraisal.appraisalUuid, data.recommendations || []),
      appraiserCommentsRepo.syncForAppraisal(appraisal.appraisalUuid, data.appraiserComments || []),
      seafarerCommentsRepo.syncForAppraisal(appraisal.appraisalUuid, data.seafarerComments || []),
    ]);
  } else if (stage === 'stage3') {
    await Promise.all([
      officeReviewsRepo.syncForAppraisal(appraisal.appraisalUuid, data.officeReviews || []),
      trainingFollowupsRepo.syncForAppraisal(appraisal.appraisalUuid, data.trainingFollowups || []),
    ]);
  }

  // Return V1-shaped response
  return this.getById(id);
}
```

#### 4.2 `responseAssembler.ts`

**File**: `server/v2/appraisals/utils/responseAssembler.ts`

Converts normalized child table rows back into V1-compatible response. Returns **exact same response shape as V1** including `appraisalData` as JSON string and `stageStatuses`/`stagePayloads` as JSON strings.

```typescript
function assembleV1Response(
  appraisal,
  trainings, targets, competenceAssessments, behaviouralAssessments,
  trainingNeeds, recommendations, appraiserComments, seafarerComments,
  officeReviews, trainingFollowups
): V1AppraisalResult {
  // Reassemble appraisalData from Part A flat fields + child table rows
  const appraisalDataObj = {
    seafarersName: appraisal.seafarersName,
    seafarersRank: appraisal.seafarersRank,
    nationality: appraisal.nationality,
    vessel: appraisal.vessel,
    signOn: appraisal.signOn,
    appraisalType: appraisal.appraisalType,
    appraisalPeriodFrom: appraisal.appraisalPeriodFrom,
    appraisalPeriodTo: appraisal.appraisalPeriodTo,
    personalityIndexCategory: appraisal.personalityIndexCategory,
    primaryAppraiser: appraisal.primaryAppraiser,
    trainings: trainings.map((t, i) => ({
      id: String(i + 1),
      training: t.training,
      evaluation: t.evaluation,
      comment: t.comment,
    })),
    targets: targets.map((t, i) => ({
      id: String(i + 1),
      targetSetting: t.targetSetting,
      evaluation: t.evaluation,
      comment: t.comment,
    })),
    competenceAssessments: competenceAssessments.map((ca, i) => ({
      id: String(i + 1),
      assessmentCriteria: ca.assessmentCriteria,
      weight: ca.weight,
      effectiveness: ca.effectiveness,
      comment: ca.comment,
    })),
    behaviouralAssessments: behaviouralAssessments.map((ba, i) => ({
      id: String(i + 1),
      assessmentCriteria: ba.assessmentCriteria,
      weight: ba.weight,
      effectiveness: ba.effectiveness,
      comment: ba.comment,
    })),
    trainingNeeds: trainingNeeds.map((tn, i) => ({
      id: String(i + 1),
      training: tn.training,
      comment: tn.comment,
    })),
    recommendations: recommendations.map((r, i) => ({
      id: String(i + 1),
      question: r.question,
      answer: r.answer,
      comment: r.comment,
    })),
    appraiserComments: appraiserComments.map((ac, i) => ({
      id: String(i + 1),
      name: ac.name,
      rank: ac.rank,
      comment: ac.comment,
    })),
    seafarerComments: seafarerComments.map((sc, i) => ({
      id: String(i + 1),
      name: sc.name,
      rank: sc.rank,
      comment: sc.comment,
    })),
    officeReviews: officeReviews.map((or, i) => ({
      id: String(i + 1),
      name: or.name,
      position: or.position,
      feedback: or.feedback,
    })),
    trainingFollowups: trainingFollowups.map((tf, i) => ({
      id: String(i + 1),
      training: tf.training,
      correspondingInDB: tf.correspondingInDb,
      category: tf.category,
      status: tf.status,
      targetDate: tf.targetDate,
      comment: tf.comment,
    })),
  };

  // Reassemble stageStatuses JSON (same shape as V1)
  const stageStatuses: Record<string, any> = {};
  if (appraisal.stage1Status) {
    stageStatuses.stage1 = {
      status: appraisal.stage1Status,
      submittedAt: appraisal.stage1SubmittedAt,
      submittedBy: appraisal.stage1SubmittedBy,
    };
  }
  if (appraisal.stage2Status) {
    stageStatuses.stage2 = {
      status: appraisal.stage2Status,
      submittedAt: appraisal.stage2SubmittedAt,
      submittedBy: appraisal.stage2SubmittedBy,
    };
  }
  if (appraisal.stage3Status) {
    stageStatuses.stage3 = {
      status: appraisal.stage3Status,
      submittedAt: appraisal.stage3SubmittedAt,
      submittedBy: appraisal.stage3SubmittedBy,
    };
  }

  // Reassemble stagePayloads JSON (same shape as V1)
  const stagePayloads: Record<string, any> = {};
  if (appraisal.stage1Status) {
    stagePayloads.stage1 = {
      seafarersName: appraisal.seafarersName,
      seafarersRank: appraisal.seafarersRank,
      nationality: appraisal.nationality,
      vessel: appraisal.vessel,
      signOn: appraisal.signOn,
      appraisalType: appraisal.appraisalType,
      appraisalPeriodFrom: appraisal.appraisalPeriodFrom,
      appraisalPeriodTo: appraisal.appraisalPeriodTo,
      personalityIndexCategory: appraisal.personalityIndexCategory,
      primaryAppraiser: appraisal.primaryAppraiser,
      trainings: appraisalDataObj.trainings,
      targets: appraisalDataObj.targets,
    };
  }
  if (appraisal.stage2Status) {
    stagePayloads.stage2 = {
      competenceAssessments: appraisalDataObj.competenceAssessments,
      behaviouralAssessments: appraisalDataObj.behaviouralAssessments,
      trainingNeeds: appraisalDataObj.trainingNeeds,
      recommendations: appraisalDataObj.recommendations,
      appraiserComments: appraisalDataObj.appraiserComments,
      seafarerComments: appraisalDataObj.seafarerComments,
    };
  }
  if (appraisal.stage3Status) {
    stagePayloads.stage3 = {
      officeReviews: appraisalDataObj.officeReviews,
      trainingFollowups: appraisalDataObj.trainingFollowups,
    };
  }

  return {
    id: appraisal.id,
    crewMemberId: appraisal.crewMemberId,
    formId: appraisal.formIdLegacy ?? parseInt(appraisal.formUuid) || 1,
    appraisalType: appraisal.appraisalType,
    appraisalDate: appraisal.appraisalDate,
    appraisalData: JSON.stringify(appraisalDataObj),
    competenceRating: appraisal.competenceRating,
    behavioralRating: appraisal.behavioralRating,
    overallRating: appraisal.overallRating,
    submittedAt: appraisal.submittedAt,
    submittedBy: appraisal.submittedBy,
    status: appraisal.status,
    stageStatuses: JSON.stringify(stageStatuses),
    stagePayloads: JSON.stringify(stagePayloads),
  };
}
```

**File**: `server/v2/appraisals/services/index.ts` — barrel export

---

### STEP 5: Backend — Controllers & Routes

**Directory**: `server/v2/appraisals/controllers/`

#### 5.1 `appraisalResultsController.ts`
Maps V1 endpoint patterns under `/api/v2/appraisals/`:

| Method | V2 Endpoint | V1 Equivalent | Handler | Same variables as V1 |
|--------|-------------|---------------|---------|---------------------|
| GET | `/` | `/api/appraisals` | `getAll` | `appraisals` |
| GET | `/:id` | `/api/appraisals/:id` | `getById` | `appraisal`, `id` |
| GET | `/crew/:crewMemberId` | `/api/appraisals/crew/:crewMemberId` | `getByCrewMember` | `crewMemberId`, `appraisals` |
| GET | `/crew/:crewMemberId/promotion-recommendations` | `/api/appraisals/crew/:crewMemberId/promotion-recommendations` | `getPromotionRecommendations` | `crewMemberId`, `rank`, `count` |
| POST | `/` | `/api/appraisals` | `create` | `bodyWithStringifiedData`, `appraisal` |
| PUT | `/:id` | `/api/appraisals/:id` | `update` | `id`, `bodyWithStringifiedData`, `appraisal` |
| DELETE | `/:id` | `/api/appraisals/:id` | `delete` | `id`, `deleted` |
| POST | `/:id/submit-stage1` | `/api/appraisals/:id/submit-stage1` | `submitStage1` | `id`, `data`, `submittedBy`, `appraisal` |
| POST | `/:id/submit-stage2` | `/api/appraisals/:id/submit-stage2` | `submitStage2` | `id`, `data`, `submittedBy`, `appraisal` |
| POST | `/:id/submit-stage3` | `/api/appraisals/:id/submit-stage3` | `submitStage3` | `id`, `data`, `submittedBy`, `appraisal` |

**Route ordering note**: `/crew/:crewMemberId/promotion-recommendations` and `/crew/:crewMemberId` must be registered BEFORE `/:id` to avoid route conflicts.

#### 5.2 Route Registration

**File**: `server/v2/appraisals/routes.ts`
```typescript
const router = Router();

// List & crew-specific (before /:id to avoid route conflicts)
router.get("/", appraisalResultsController.getAll);
router.get("/crew/:crewMemberId/promotion-recommendations", appraisalResultsController.getPromotionRecommendations);
router.get("/crew/:crewMemberId", appraisalResultsController.getByCrewMember);
router.get("/:id", appraisalResultsController.getById);
router.post("/", appraisalResultsController.create);
router.put("/:id", appraisalResultsController.update);
router.delete("/:id", appraisalResultsController.delete);

// Stage submissions
router.post("/:id/submit-stage1", appraisalResultsController.submitStage1);
router.post("/:id/submit-stage2", appraisalResultsController.submitStage2);
router.post("/:id/submit-stage3", appraisalResultsController.submitStage3);

export default router;
```

**File**: `server/routes.ts` — Register V2 router:
```typescript
import appraisalsV2Routes from "./v2/appraisals/routes";
app.use("/api/v2/appraisals", appraisalsV2Routes);
```

---

### STEP 6: Frontend — V2 API Client & Hooks

**File**: `client/src/modules/crewing/v2/api/appraisalsApiV2.ts`

```typescript
const V2_BASE = "/api/v2/appraisals";

export const appraisalsApiV2 = {
  getAll: () => fetch(`${V2_BASE}`).then(r => r.json()),
  getById: (id: number) => fetch(`${V2_BASE}/${id}`).then(r => r.json()),
  getByCrewMember: (crewMemberId: string) => fetch(`${V2_BASE}/crew/${crewMemberId}`).then(r => r.json()),
  getPromotionRecommendations: (crewMemberId: string, rank: string) =>
    fetch(`${V2_BASE}/crew/${crewMemberId}/promotion-recommendations?rank=${encodeURIComponent(rank)}`).then(r => r.json()),
  create: (data: any) => apiRequest("POST", V2_BASE, data),
  update: (id: number, data: any) => apiRequest("PUT", `${V2_BASE}/${id}`, data),
  delete: (id: number) => apiRequest("DELETE", `${V2_BASE}/${id}`),
  submitStage1: (id: number, data: any) => apiRequest("POST", `${V2_BASE}/${id}/submit-stage1`, data),
  submitStage2: (id: number, data: any) => apiRequest("POST", `${V2_BASE}/${id}/submit-stage2`, data),
  submitStage3: (id: number, data: any) => apiRequest("POST", `${V2_BASE}/${id}/submit-stage3`, data),
};
```

**File**: `client/src/modules/crewing/v2/hooks/useAppraisalsV2.ts`

```typescript
// Queries (same queryKey pattern as V1 but with V2 base)
useAppraisalsV2()                    → queryKey: ["/api/v2/appraisals"]
useAppraisalByIdV2(id)               → queryKey: ["/api/v2/appraisals", id]
useAppraisalsByCrewMemberV2(crewId)  → queryKey: ["/api/v2/appraisals/crew", crewId]

// Mutations (all include auditUserUuid)
useCreateAppraisalV2()       → POST / with { ...data, auditUserUuid }
useUpdateAppraisalV2()       → PUT /:id with { ...data, auditUserUuid }
useDeleteAppraisalV2()       → DELETE /:id
useSubmitStage1V2()          → POST /:id/submit-stage1
useSubmitStage2V2()          → POST /:id/submit-stage2
useSubmitStage3V2()          → POST /:id/submit-stage3
```

**File**: `client/src/modules/crewing/v2/hooks/useAppraisalsVersion.ts`
Same pattern as `useAdminVersion` — reads/writes localStorage key `appraisals_module_version`.

---

### STEP 7: Frontend — V2 Appraisal Module

**Copy V1 files exactly to V2 folder, only swap hooks/endpoints:**

#### 7.1 `ElementCrewAppraisals_v2.tsx`
Exact copy of `client/src/modules/crewing/ElementCrewAppraisals.tsx` with these changes:

| V1 Hook / Query / Import | V2 Replacement |
|--------------------------|----------------|
| `queryKey: ["/api/appraisals"]` | `queryKey: ["/api/v2/appraisals"]` |
| `fetch("/api/appraisals")` | `fetch("/api/v2/appraisals")` |
| `useExternalVessels()` | `useVesselsV2()` from `useMasterDataV2.ts` |
| `useCompanyRanks()` | `useCompanyRanksV2()` from `useAdminV2.ts` |
| `DEFAULT_DROPDOWN_VESSEL_TYPES` | `useVesselTypesV2()` from `useMasterDataV2.ts` |
| `import { CrewMember } from "@shared/schema"` | Same (V1-compatible response shape) |
| `import { AppraisalResult } from "@shared/schema"` | Same (V1-compatible response shape) |
| `import { AppraisalForm } from "./AppraisalForm"` | `import { AppraisalForm } from "./AppraisalForm_v2"` |

#### 7.2 `AppraisalForm_v2.tsx`
Exact copy of `client/src/modules/crewing/AppraisalForm.tsx` with these changes:

| V1 Reference | V2 Replacement |
|--------------|----------------|
| `/api/appraisals/${appraisalId}` (queryKey) | `/api/v2/appraisals/${appraisalId}` |
| `/api/appraisals` (POST url) | `/api/v2/appraisals` |
| `/api/appraisals/${idToUse}` (PUT url) | `/api/v2/appraisals/${idToUse}` |
| `/api/appraisals/${id}/submit-stage1` | `/api/v2/appraisals/${id}/submit-stage1` |
| `/api/appraisals/${id}/submit-stage2` | `/api/v2/appraisals/${id}/submit-stage2` |
| `/api/appraisals/${id}/submit-stage3` | `/api/v2/appraisals/${id}/submit-stage3` |
| `queryClient.invalidateQueries({ queryKey: ['/api/appraisals'] })` | `queryClient.invalidateQueries({ queryKey: ['/api/v2/appraisals'] })` |
| `queryClient.invalidateQueries({ queryKey: ['/api/appraisals/${appraisalId}'] })` | `queryClient.invalidateQueries({ queryKey: ['/api/v2/appraisals/${appraisalId}'] })` |

**Note**: `AppraisalForm_v2.tsx` does NOT use `useExternalVesselTypes` or `useExternalUsers` — those are only in `ElementCrewAppraisals.tsx`. The form component receives data via props, so no master hook changes needed inside the form itself.

#### 7.3 Version Toggle

**File**: `client/src/modules/crewing/v2/components/AppraisalsVersionToggle.tsx`
Same pattern as `AdminVersionToggle`.

**File**: `client/src/modules/crewing/AppraisalsRouter.tsx`
```typescript
import { useAppraisalsVersion } from './v2/hooks/useAppraisalsVersion';
import ElementCrewAppraisals from './ElementCrewAppraisals';
import ElementCrewAppraisals_v2 from './v2/ElementCrewAppraisals_v2';

export default function AppraisalsRouter() {
  const { isV2 } = useAppraisalsVersion();
  return isV2 ? <ElementCrewAppraisals_v2 /> : <ElementCrewAppraisals />;
}
```

---

## Data Flow Summary

### Save (POST/PUT) — Frontend → Backend
```
Frontend sends V1-shaped body (same as V1):
{
  crewMemberId, formId, appraisalType, appraisalDate,
  appraisalData: { seafarersName, trainings: [...], targets: [...], ... },  ← object
  competenceRating, behavioralRating, overallRating,
  submittedBy, status,
  auditUserUuid: "..."                ← from localStorage.crewUserId
}

Backend appraisalResultsService.create():
  1. Extract auditUserUuid via applyAuditUser()
  2. Parse appraisalData object
  3. Create appraisal_results_v2 (Part A flat fields + ratings + status)
  4. Sync appr_trainings_v2 (from appraisalData.trainings)
  5. Sync appr_targets_v2 (from appraisalData.targets)
  6. Sync appr_competence_assessments_v2 (from appraisalData.competenceAssessments)
  7. Sync appr_behavioural_assessments_v2 (from appraisalData.behaviouralAssessments)
  8. Sync appr_training_needs_v2 (from appraisalData.trainingNeeds)
  9. Sync appr_recommendations_v2 (from appraisalData.recommendations)
  10. Sync appr_appraiser_comments_v2 (from appraisalData.appraiserComments)
  11. Sync appr_seafarer_comments_v2 (from appraisalData.seafarerComments)
  12. Sync appr_office_reviews_v2 (from appraisalData.officeReviews)
  13. Sync appr_training_followups_v2 (from appraisalData.trainingFollowups)
  14. Return V1-shaped response (reassembled from child tables)
```

### Stage Submit — Frontend → Backend
```
Frontend sends stage data (same as V1):
Stage 1: { data: { seafarersName, ..., trainings: [...], targets: [...] }, submittedBy }
Stage 2: { data: { competenceAssessments: [...], behaviouralAssessments: [...], ... }, submittedBy }
Stage 3: { data: { officeReviews: [...], trainingFollowups: [...] }, submittedBy }

Backend appraisalResultsService.submitStage():
  1. Enforce sequential progression (same as V1)
  2. Update parent stage status columns (stage1_status → 'completed', etc.)
  3. Update parent overall status (draft → preliminary → submitted → reviewed)
  4. Sync only the child tables for that stage's arrays
  5. Return V1-shaped response
```

### Read (GET) — Backend → Frontend
```
Backend appraisalResultsService.getAll():
  1. Fetch all non-draft appraisals from appraisal_results_v2 (1 query)
  2. Extract all appraisal UUIDs
  3. Batch-fetch ALL child rows using WHERE appraisal_uuid IN (...) (10 parallel queries)
  4. Group child rows by appraisal_uuid using Map
  5. For each appraisal, assemble V1-compatible response via responseAssembler
  Total: 11 queries regardless of number of appraisals (no N+1)

Response shape (identical to V1):
{
  id: number,
  crewMemberId: string,
  formId: number,
  appraisalType: string,
  appraisalDate: string,
  appraisalData: "JSON string",        ← reassembled from child tables
  competenceRating: string,
  behavioralRating: string,
  overallRating: string,
  submittedAt: timestamp,
  submittedBy: string,
  status: string,
  stageStatuses: "JSON string",        ← reassembled from flat columns
  stagePayloads: "JSON string",        ← reassembled from child tables
}
```

---

## Folder Structure (Final)

```
server/v2/appraisals/
├── repositories/
│   ├── appraisalResultsRepository.ts
│   ├── apprTrainingsRepository.ts
│   ├── apprTargetsRepository.ts
│   ├── apprCompetenceAssessmentsRepository.ts
│   ├── apprBehaviouralAssessmentsRepository.ts
│   ├── apprTrainingNeedsRepository.ts
│   ├── apprRecommendationsRepository.ts
│   ├── apprAppraiserCommentsRepository.ts
│   ├── apprSeafarerCommentsRepository.ts
│   ├── apprOfficeReviewsRepository.ts
│   ├── apprTrainingFollowupsRepository.ts
│   └── index.ts
├── services/
│   ├── appraisalResultsService.ts
│   └── index.ts
├── controllers/
│   ├── appraisalResultsController.ts
│   └── index.ts
├── utils/
│   └── responseAssembler.ts          ← V1-compatible response builder
├── routes.ts
└── index.ts

shared/v2/appraisals/
├── schema.ts                          ← Drizzle table definitions (11 tables)
└── types.ts                           ← Insert schemas, select types

client/src/modules/crewing/
├── v2/
│   ├── api/
│   │   └── appraisalsApiV2.ts
│   ├── hooks/
│   │   ├── useAppraisalsV2.ts
│   │   └── useAppraisalsVersion.ts
│   ├── components/
│   │   └── AppraisalsVersionToggle.tsx
│   ├── ElementCrewAppraisals_v2.tsx   ← Copy of V1 with V2 hooks/endpoints
│   └── AppraisalForm_v2.tsx           ← Copy of V1 with V2 endpoints
├── AppraisalsRouter.tsx               ← Version router (V1/V2 toggle)
├── ElementCrewAppraisals.tsx          ← V1 (unchanged)
├── AppraisalForm.tsx                  ← V1 (unchanged)
└── ...
```

---

## Key Design Decisions

1. **V1-compatible API responses**: The service layer reassembles normalized data back into JSON strings matching V1 response shape (`appraisalData`, `stageStatuses`, `stagePayloads` as JSON strings). All existing frontend components work without modification.

2. **V1-compatible request body**: The service accepts V1-format request bodies (with `appraisalData` as object or JSON string) and decomposes them into child table rows. Frontend save/submit logic doesn't need changes.

3. **Same backend variables as V1**: Controller methods use the same variable names (`appraisals`, `appraisal`, `id`, `crewMemberId`, `data`, `submittedBy`, `bodyWithStringifiedData`) as the V1 routes in `server/routes.ts`.

4. **All table names end with `_v2`**: Consistent naming convention across all V2 modules.

5. **No backfill**: V2 starts with empty tables. New appraisals created in V2 mode go to V2 tables.

6. **Separate tables for appraiserComments and seafarerComments**: NOT merged into a single table — matches exact V1 JSON structure with separate arrays.

7. **Stage payloads are NOT stored in a separate column**: V1 stores `stage_payloads` as a JSON column. V2 eliminates this column. Instead, `assembleV1Response` reconstructs the `stagePayloads` JSON from the parent flat fields and child table rows (see Appendix A.4 for the full reconstruction mapping). This avoids redundant storage while returning the exact same V1 response shape.

8. **Stage statuses flattened**: V1's `stageStatuses` JSON with nested objects is flattened to 9 columns on the parent table (`stage1_status`, `stage1_submitted_at`, `stage1_submitted_by`, etc.) — eliminates JSON parsing.

9. **Batch query optimization (no N+1)**: All child table reads use `WHERE appraisal_uuid IN (...)` batch pattern. Total queries = 1 (parent) + 10 (child tables) = 11, regardless of number of appraisals. All 10 child queries run in parallel via `Promise.all()`.

10. **V2 Admin references**: Uses `adm_forms_v2` and `adm_rank_groups_v2` from Admin V2 module instead of V1 `forms` and `rank_groups` tables.

11. **V2 Masters references**: `ElementCrewAppraisals_v2.tsx` uses `useVesselsV2()`, `useVesselTypesV2()` from `useMasterDataV2.ts` instead of V1 `useExternalVessels()` and `DEFAULT_DROPDOWN_VESSEL_TYPES`.

12. **Audit user flow**: Frontend wraps mutations with `auditUserUuid` from `localStorage.crewUserId` → service extracts via `applyAuditUser()` → sets `created_by_uuid`/`updated_by_uuid` on all tables.

13. **`form_id` → `form_uuid` + `form_id_legacy`**: V1 stores `form_id` as INTEGER (e.g., `1`). V2 stores both `form_uuid` (TEXT, for future UUID-based form references) and `form_id_legacy` (INTEGER, preserves original V1 integer). `assembleV1Response` returns `formId: appraisal.formIdLegacy ?? parseInt(appraisal.formUuid) || 1` — always produces a valid integer matching V1 expectations.

14. **Status may downgrade on re-save**: V1 unconditionally sets status based on which stage was submitted (stage1 → 'preliminary', stage2 → 'submitted', stage3 → 'reviewed'). If a user re-saves stage1 after stage3 was already submitted, status reverts to 'preliminary'. V2 replicates this exact behavior. Status progression is NOT monotonic — it always reflects the most recently submitted stage.

---

## Dependencies & References

- **Forms**: V2 admin module → `adm_forms_v2` → `/api/v2/admin/forms`
- **Rank Groups**: V2 admin module → `adm_rank_groups_v2` → `/api/v2/admin/rank-groups`
- **Available Ranks**: V2 admin module → `adm_available_ranks_v2` → `/api/v2/admin/available-ranks`
- **Company Ranks**: V2 admin module → `adm_company_ranks_v2` → `/api/v2/admin/company-ranks`
- **Vessels**: V2 masters module → `master_vessels` → `/api/v2/masters/vessels` (via `useVesselsV2()` hook)
- **Vessel Types**: V2 masters module → `master_vessel_types` → `/api/v2/masters/vessel-types` (via `useVesselTypesV2()` hook)
- **Nationalities**: V2 masters module → `master_nationalities` → `/api/v2/masters/nationalities` (via `useNationalitiesV2()` hook)
- **V2 Master Hooks**: Shared from `client/src/hooks/v2/useMasterDataV2.ts` (same hooks used by all V2 modules)
- **Audit User Utility**: Reused from `server/v2/admin/utils/auditUser.ts` (not duplicated)
- **Crew Members**: V1 `/api/crew-members` (shared — appraisals reference crew by `crewMemberId` text field, no V2 crew pool change needed since the response assembler returns the same `crewMemberId` value)

---

## V1 → V2 Validation Schemas (Backend)

The V2 controller reuses the **same validation schemas** as V1 (from `server/routes.ts`):

```typescript
// Stage 1 (Parts A & B) — same as V1 stage1SubmissionSchema
const stage1SubmissionSchema = z.object({
  data: z.object({
    seafarersName: z.string().min(1),
    seafarersRank: z.string().min(1),
    nationality: z.string().min(1),
    vessel: z.string().min(1),
    appraisalType: z.string().min(1),
    signOn: z.string().optional(),
    appraisalPeriodFrom: z.string().optional(),
    appraisalPeriodTo: z.string().optional(),
    personalityIndexCategory: z.string().optional(),
    primaryAppraiser: z.string().optional(),
    trainings: z.array(z.any()).optional(),
    targets: z.array(z.any()).optional(),
  }),
  submittedBy: z.string().optional(),
});

// Stage 2 (Parts C, D, E, F) — same as V1 stage2SubmissionSchema
const stage2SubmissionSchema = z.object({
  data: z.object({
    competenceAssessments: z.array(z.any()).optional(),
    behaviouralAssessments: z.array(z.any()).optional(),
    trainingNeeds: z.array(z.any()).optional(),
    recommendations: z.array(z.any()).optional(),
    appraiserComments: z.array(z.any()).optional(),
    seafarerComments: z.array(z.any()).optional(),
  }),
  submittedBy: z.string().optional(),
});

// Stage 3 (Part G) — same as V1 stage3SubmissionSchema
const stage3SubmissionSchema = z.object({
  data: z.object({
    officeReviews: z.array(z.any()).optional(),
    trainingFollowups: z.array(z.any()).optional(),
  }),
  submittedBy: z.string().optional(),
});
```

---

## Appendix A: Definitive V1 → V2 Field Mapping (Every Key)

This table maps every JSON key from V1 `appraisal_data`, `stage_statuses`, and `stage_payloads` to its V2 table and column. **No V1 field is omitted.**

### A.1 Parent-Level Columns (appraisal_results → appraisal_results_v2)

| # | V1 Source | V1 Key | V2 Table | V2 Column | Notes |
|---|-----------|--------|----------|-----------|-------|
| 1 | column | `id` | `appraisal_results_v2` | `id` | Same SERIAL PK |
| 2 | — | — | `appraisal_results_v2` | `appraisal_uuid` | New UUID (generated on create) |
| 3 | column | `crew_member_id` | `appraisal_results_v2` | `crew_member_id` | Same |
| 4 | column | `form_id` | `appraisal_results_v2` | `form_uuid` | TEXT. V1 stores integer form IDs (e.g., `1`). V2 stores the same value as a string in `form_uuid`. `assembleV1Response` converts back via `parseInt()`. If the value is a proper UUID, `parseInt()` returns NaN → fallback to `1`. To handle this correctly, V2 also has `form_id_legacy INTEGER` column that preserves the original V1 integer. See Key Decision #13. |
| 5 | column | `appraisal_type` | `appraisal_results_v2` | `appraisal_type` | Same |
| 6 | column | `appraisal_date` | `appraisal_results_v2` | `appraisal_date` | Same |
| 7 | `appraisal_data` JSON | `.seafarersName` | `appraisal_results_v2` | `seafarers_name` | Extracted from JSON |
| 8 | `appraisal_data` JSON | `.seafarersRank` | `appraisal_results_v2` | `seafarers_rank` | Extracted from JSON |
| 9 | `appraisal_data` JSON | `.nationality` | `appraisal_results_v2` | `nationality` | Extracted from JSON |
| 10 | `appraisal_data` JSON | `.vessel` | `appraisal_results_v2` | `vessel` | Extracted from JSON |
| 11 | `appraisal_data` JSON | `.signOn` | `appraisal_results_v2` | `sign_on` | Extracted from JSON |
| 12 | `appraisal_data` JSON | `.appraisalType` | — | — | **Duplicate**: same value as column `appraisal_type`. Not stored again. `assembleV1Response` emits it in the `appraisalData` JSON from the parent column `appraisal_type`. |
| 13 | `appraisal_data` JSON | `.appraisalPeriodFrom` | `appraisal_results_v2` | `appraisal_period_from` | Extracted from JSON |
| 14 | `appraisal_data` JSON | `.appraisalPeriodTo` | `appraisal_results_v2` | `appraisal_period_to` | Extracted from JSON |
| 15 | `appraisal_data` JSON | `.personalityIndexCategory` | `appraisal_results_v2` | `personality_index_category` | Extracted from JSON |
| 16 | `appraisal_data` JSON | `.primaryAppraiser` | `appraisal_results_v2` | `primary_appraiser` | Extracted from JSON |
| 17 | column | `competence_rating` | `appraisal_results_v2` | `competence_rating` | Same |
| 18 | column | `behavioral_rating` | `appraisal_results_v2` | `behavioral_rating` | Same |
| 19 | column | `overall_rating` | `appraisal_results_v2` | `overall_rating` | Same |
| 20 | column | `submitted_at` | `appraisal_results_v2` | `submitted_at` | Same |
| 21 | column | `submitted_by` | `appraisal_results_v2` | `submitted_by` | Same |
| 22 | column | `status` | `appraisal_results_v2` | `status` | Same (draft\|preliminary\|submitted\|reviewed) |
| 23 | `stage_statuses` JSON | `.stage1.status` | `appraisal_results_v2` | `stage1_status` | Flattened |
| 24 | `stage_statuses` JSON | `.stage1.submittedAt` | `appraisal_results_v2` | `stage1_submitted_at` | Flattened |
| 25 | `stage_statuses` JSON | `.stage1.submittedBy` | `appraisal_results_v2` | `stage1_submitted_by` | Flattened |
| 26 | `stage_statuses` JSON | `.stage2.status` | `appraisal_results_v2` | `stage2_status` | Flattened |
| 27 | `stage_statuses` JSON | `.stage2.submittedAt` | `appraisal_results_v2` | `stage2_submitted_at` | Flattened |
| 28 | `stage_statuses` JSON | `.stage2.submittedBy` | `appraisal_results_v2` | `stage2_submitted_by` | Flattened |
| 29 | `stage_statuses` JSON | `.stage3.status` | `appraisal_results_v2` | `stage3_status` | Flattened |
| 30 | `stage_statuses` JSON | `.stage3.submittedAt` | `appraisal_results_v2` | `stage3_submitted_at` | Flattened |
| 31 | `stage_statuses` JSON | `.stage3.submittedBy` | `appraisal_results_v2` | `stage3_submitted_by` | Flattened |

### A.2 Child Table Array Items — `.id` Field Handling

V1 array items have an `.id` field (e.g., `trainings[].id = "1"`). These are ephemeral frontend-generated string IDs used for React `key` props and form field identity. They are **NOT stored** in V2 child tables.

**On read** (`assembleV1Response`): The `.id` is regenerated from array position:
```
id: String(index + 1)   // → "1", "2", "3", ...
```
Items are sorted by `sort_order ASC` before mapping, ensuring stable ordering.

**On write** (create/update/stage-submit): The `.id` from the frontend payload is **ignored**. Rows are inserted in array order, and `sort_order` is set to the array index (0-based).

### A.3 Child Table Field Mappings

#### `appraisal_data.trainings[]` → `appr_trainings_v2`
| V1 JSON Key | V2 Column | Type | Notes |
|-------------|-----------|------|-------|
| `.id` | — | — | Not stored; regenerated from sort_order on read |
| `.training` | `training` | TEXT | Training name/description |
| `.evaluation` | `evaluation` | TEXT | Evaluation text |
| `.comment` | `comment` | TEXT | Comment text |

#### `appraisal_data.targets[]` → `appr_targets_v2`
| V1 JSON Key | V2 Column | Type | Notes |
|-------------|-----------|------|-------|
| `.id` | — | — | Not stored; regenerated |
| `.targetSetting` | `target_setting` | TEXT | camelCase → snake_case |
| `.evaluation` | `evaluation` | TEXT | |
| `.comment` | `comment` | TEXT | |

#### `appraisal_data.competenceAssessments[]` → `appr_competence_assessments_v2`
| V1 JSON Key | V2 Column | Type | Notes |
|-------------|-----------|------|-------|
| `.id` | — | — | Not stored; regenerated |
| `.assessmentCriteria` | `assessment_criteria` | TEXT | camelCase → snake_case |
| `.weight` | `weight` | INTEGER | Percentage weight |
| `.effectiveness` | `effectiveness` | TEXT | Rating enum string (e.g., "5-exceeds-expectations") |
| `.comment` | `comment` | TEXT | |

#### `appraisal_data.behaviouralAssessments[]` → `appr_behavioural_assessments_v2`
| V1 JSON Key | V2 Column | Type | Notes |
|-------------|-----------|------|-------|
| `.id` | — | — | Not stored; regenerated |
| `.assessmentCriteria` | `assessment_criteria` | TEXT | camelCase → snake_case |
| `.weight` | `weight` | INTEGER | Percentage weight |
| `.effectiveness` | `effectiveness` | TEXT | Rating enum string |
| `.comment` | `comment` | TEXT | |

#### `appraisal_data.trainingNeeds[]` → `appr_training_needs_v2`
| V1 JSON Key | V2 Column | Type | Notes |
|-------------|-----------|------|-------|
| `.id` | — | — | Not stored; regenerated |
| `.training` | `training` | TEXT | |
| `.comment` | `comment` | TEXT | |

#### `appraisal_data.recommendations[]` → `appr_recommendations_v2`
| V1 JSON Key | V2 Column | Type | Notes |
|-------------|-----------|------|-------|
| `.id` | — | — | Not stored; regenerated |
| `.question` | `question` | TEXT | |
| `.answer` | `answer` | TEXT | "Yes"\|"No"\|"NA"\|"" |
| `.comment` | `comment` | TEXT | |

#### `appraisal_data.appraiserComments[]` → `appr_appraiser_comments_v2`
| V1 JSON Key | V2 Column | Type | Notes |
|-------------|-----------|------|-------|
| `.id` | — | — | Not stored; regenerated |
| `.name` | `name` | TEXT | Appraiser name |
| `.rank` | `rank` | TEXT | Appraiser rank |
| `.comment` | `comment` | TEXT | |

#### `appraisal_data.seafarerComments[]` → `appr_seafarer_comments_v2`
| V1 JSON Key | V2 Column | Type | Notes |
|-------------|-----------|------|-------|
| `.id` | — | — | Not stored; regenerated |
| `.name` | `name` | TEXT | Seafarer name |
| `.rank` | `rank` | TEXT | Seafarer rank |
| `.comment` | `comment` | TEXT | |

#### `appraisal_data.officeReviews[]` → `appr_office_reviews_v2`
| V1 JSON Key | V2 Column | Type | Notes |
|-------------|-----------|------|-------|
| `.id` | — | — | Not stored; regenerated |
| `.name` | `name` | TEXT | Reviewer name |
| `.position` | `position` | TEXT | Reviewer position |
| `.feedback` | `feedback` | TEXT | |

#### `appraisal_data.trainingFollowups[]` → `appr_training_followups_v2`
| V1 JSON Key | V2 Column | Type | Notes |
|-------------|-----------|------|-------|
| `.id` | — | — | Not stored; regenerated |
| `.training` | `training` | TEXT | |
| `.correspondingInDB` | `corresponding_in_db` | TEXT | camelCase → snake_case |
| `.category` | `category` | TEXT | |
| `.status` | `status` | TEXT | Proposed\|Approved\|Planned\|Declined\|Completed |
| `.targetDate` | `target_date` | TEXT | camelCase → snake_case |
| `.comment` | `comment` | TEXT | |

### A.4 `stage_payloads` Reconstruction

V1 stores a separate `stage_payloads` JSON column with per-stage snapshots of submitted data. V2 does **NOT** store `stage_payloads` — they are reconstructed in `assembleV1Response` from child table rows and parent flat fields:

| V1 `stage_payloads` key | Reconstructed from |
|--------------------------|-------------------|
| `.stage1.seafarersName` | `appraisal_results_v2.seafarers_name` |
| `.stage1.seafarersRank` | `appraisal_results_v2.seafarers_rank` |
| `.stage1.nationality` | `appraisal_results_v2.nationality` |
| `.stage1.vessel` | `appraisal_results_v2.vessel` |
| `.stage1.signOn` | `appraisal_results_v2.sign_on` |
| `.stage1.appraisalType` | `appraisal_results_v2.appraisal_type` |
| `.stage1.appraisalPeriodFrom` | `appraisal_results_v2.appraisal_period_from` |
| `.stage1.appraisalPeriodTo` | `appraisal_results_v2.appraisal_period_to` |
| `.stage1.personalityIndexCategory` | `appraisal_results_v2.personality_index_category` |
| `.stage1.primaryAppraiser` | `appraisal_results_v2.primary_appraiser` |
| `.stage1.trainings` | `appr_trainings_v2` rows for this appraisal |
| `.stage1.targets` | `appr_targets_v2` rows for this appraisal |
| `.stage2.competenceAssessments` | `appr_competence_assessments_v2` rows |
| `.stage2.behaviouralAssessments` | `appr_behavioural_assessments_v2` rows |
| `.stage2.trainingNeeds` | `appr_training_needs_v2` rows |
| `.stage2.recommendations` | `appr_recommendations_v2` rows |
| `.stage2.appraiserComments` | `appr_appraiser_comments_v2` rows |
| `.stage2.seafarerComments` | `appr_seafarer_comments_v2` rows |
| `.stage3.officeReviews` | `appr_office_reviews_v2` rows |
| `.stage3.trainingFollowups` | `appr_training_followups_v2` rows |

### A.5 Duplicate Field Reconciliation

| Field | In `appraisal_data` JSON? | As Parent Column? | Resolution |
|-------|--------------------------|-------------------|------------|
| `appraisalType` | Yes (`.appraisalType`) | Yes (`appraisal_type`) | Stored once in parent column. `assembleV1Response` emits it in both locations: as `appraisalType` inside the reassembled `appraisalData` JSON (read from `appraisal_type` column) and as the top-level `appraisalType` field. |

No other duplicate fields exist between the JSON payload and parent columns.

---

## Appendix B: assembleV1Response — Exact Algorithm

```
FUNCTION assembleV1Response(appraisal, trainings[], targets[], 
  competenceAssessments[], behaviouralAssessments[], trainingNeeds[],
  recommendations[], appraiserComments[], seafarerComments[],
  officeReviews[], trainingFollowups[]) → V1AppraisalResult

  // --- 1. Sort all child arrays by sort_order ASC ---
  trainings.sort(a.sortOrder - b.sortOrder)
  targets.sort(a.sortOrder - b.sortOrder)
  competenceAssessments.sort(a.sortOrder - b.sortOrder)
  behaviouralAssessments.sort(a.sortOrder - b.sortOrder)
  trainingNeeds.sort(a.sortOrder - b.sortOrder)
  recommendations.sort(a.sortOrder - b.sortOrder)
  appraiserComments.sort(a.sortOrder - b.sortOrder)
  seafarerComments.sort(a.sortOrder - b.sortOrder)
  officeReviews.sort(a.sortOrder - b.sortOrder)
  trainingFollowups.sort(a.sortOrder - b.sortOrder)

  // --- 2. Build appraisalData object (V1 JSON shape) ---
  // Part A flat fields from parent columns
  appraisalDataObj = {
    seafarersName:             appraisal.seafarersName,
    seafarersRank:             appraisal.seafarersRank,
    nationality:               appraisal.nationality,
    vessel:                    appraisal.vessel,
    signOn:                    appraisal.signOn,
    appraisalType:             appraisal.appraisalType,        // ← from parent column, not stored twice
    appraisalPeriodFrom:       appraisal.appraisalPeriodFrom,
    appraisalPeriodTo:         appraisal.appraisalPeriodTo,
    personalityIndexCategory:  appraisal.personalityIndexCategory,
    primaryAppraiser:          appraisal.primaryAppraiser,
  }

  // Part B arrays — regenerate ".id" as 1-indexed string from sorted position
  appraisalDataObj.trainings = trainings.map((t, i) => ({
    id: String(i + 1), training: t.training, evaluation: t.evaluation, comment: t.comment
  }))
  appraisalDataObj.targets = targets.map((t, i) => ({
    id: String(i + 1), targetSetting: t.targetSetting, evaluation: t.evaluation, comment: t.comment
  }))

  // Part C — competence assessments
  appraisalDataObj.competenceAssessments = competenceAssessments.map((ca, i) => ({
    id: String(i + 1), assessmentCriteria: ca.assessmentCriteria, 
    weight: ca.weight, effectiveness: ca.effectiveness, comment: ca.comment
  }))

  // Part D — behavioural assessments
  appraisalDataObj.behaviouralAssessments = behaviouralAssessments.map((ba, i) => ({
    id: String(i + 1), assessmentCriteria: ba.assessmentCriteria, 
    weight: ba.weight, effectiveness: ba.effectiveness, comment: ba.comment
  }))

  // Part E — training needs
  appraisalDataObj.trainingNeeds = trainingNeeds.map((tn, i) => ({
    id: String(i + 1), training: tn.training, comment: tn.comment
  }))

  // Part F — recommendations + comments
  appraisalDataObj.recommendations = recommendations.map((r, i) => ({
    id: String(i + 1), question: r.question, answer: r.answer, comment: r.comment
  }))
  appraisalDataObj.appraiserComments = appraiserComments.map((ac, i) => ({
    id: String(i + 1), name: ac.name, rank: ac.rank, comment: ac.comment
  }))
  appraisalDataObj.seafarerComments = seafarerComments.map((sc, i) => ({
    id: String(i + 1), name: sc.name, rank: sc.rank, comment: sc.comment
  }))

  // Part G — office reviews + training followups
  appraisalDataObj.officeReviews = officeReviews.map((or, i) => ({
    id: String(i + 1), name: or.name, position: or.position, feedback: or.feedback
  }))
  appraisalDataObj.trainingFollowups = trainingFollowups.map((tf, i) => ({
    id: String(i + 1), training: tf.training, correspondingInDB: tf.correspondingInDb, 
    category: tf.category, status: tf.status, targetDate: tf.targetDate, comment: tf.comment
  }))

  // --- 3. Build stageStatuses object (only include stages that have been submitted) ---
  stageStatuses = {}
  IF appraisal.stage1Status IS NOT NULL:
    stageStatuses.stage1 = { status: appraisal.stage1Status, submittedAt: appraisal.stage1SubmittedAt, submittedBy: appraisal.stage1SubmittedBy }
  IF appraisal.stage2Status IS NOT NULL:
    stageStatuses.stage2 = { status: appraisal.stage2Status, submittedAt: appraisal.stage2SubmittedAt, submittedBy: appraisal.stage2SubmittedBy }
  IF appraisal.stage3Status IS NOT NULL:
    stageStatuses.stage3 = { status: appraisal.stage3Status, submittedAt: appraisal.stage3SubmittedAt, submittedBy: appraisal.stage3SubmittedBy }

  // --- 4. Build stagePayloads object (reconstructed, not stored) ---
  stagePayloads = {}
  IF appraisal.stage1Status IS NOT NULL:
    stagePayloads.stage1 = {
      seafarersName, seafarersRank, nationality, vessel, signOn, appraisalType,
      appraisalPeriodFrom, appraisalPeriodTo, personalityIndexCategory, primaryAppraiser,
      trainings: appraisalDataObj.trainings,
      targets: appraisalDataObj.targets,
    }
  IF appraisal.stage2Status IS NOT NULL:
    stagePayloads.stage2 = {
      competenceAssessments: appraisalDataObj.competenceAssessments,
      behaviouralAssessments: appraisalDataObj.behaviouralAssessments,
      trainingNeeds: appraisalDataObj.trainingNeeds,
      recommendations: appraisalDataObj.recommendations,
      appraiserComments: appraisalDataObj.appraiserComments,
      seafarerComments: appraisalDataObj.seafarerComments,
    }
  IF appraisal.stage3Status IS NOT NULL:
    stagePayloads.stage3 = {
      officeReviews: appraisalDataObj.officeReviews,
      trainingFollowups: appraisalDataObj.trainingFollowups,
    }

  // --- 5. Return V1 response shape ---
  // CRITICAL: All 3 JSON fields MUST be stringified (V1 frontend does JSON.parse on read)
  RETURN {
    id:                appraisal.id,                     // integer (SERIAL)
    crewMemberId:      appraisal.crewMemberId,           // string
    formId:            appraisal.formIdLegacy ?? parseInt(appraisal.formUuid) || 1, // V1 expects integer; prefer legacy int column
    appraisalType:     appraisal.appraisalType,          // string
    appraisalDate:     appraisal.appraisalDate,          // string
    appraisalData:     JSON.stringify(appraisalDataObj),  // ← JSON string
    competenceRating:  appraisal.competenceRating,       // string | null
    behavioralRating:  appraisal.behavioralRating,       // string | null
    overallRating:     appraisal.overallRating,           // string | null
    submittedAt:       appraisal.submittedAt,             // timestamp
    submittedBy:       appraisal.submittedBy,             // string
    status:            appraisal.status,                  // string
    stageStatuses:     JSON.stringify(stageStatuses),     // ← JSON string
    stagePayloads:     JSON.stringify(stagePayloads),     // ← JSON string
  }
END
```

---

## Appendix C: Stage Submission — Exact Server-Side Behavior

### C.1 Sequential Enforcement (same as V1 `server/storage.ts` lines 3087-3138)

```
submitStage(id, stage, data, submittedBy):

  1. Fetch appraisal by id from appraisal_results_v2
  2. IF not found → return HTTP 404 { message: "Appraisal not found" }
  
  3. Sequential enforcement (throw Error → HTTP 400):
     IF stage === 'stage2' AND appraisal.stage1_status IS NULL:
       throw Error("Stage 1 must be submitted before Stage 2")
     IF stage === 'stage3' AND appraisal.stage2_status IS NULL:
       throw Error("Stage 2 must be submitted before Stage 3")
  
  4. Status transitions (exactly matches V1 storage.ts lines 3114-3121):
     IF stage === 'stage1' → newStatus = 'preliminary'
     IF stage === 'stage2' → newStatus = 'submitted'  
     IF stage === 'stage3' → newStatus = 'reviewed'
     
     NOTE: V1 ALWAYS sets newStatus regardless of current status.
     If appraisal is already 'submitted' and stage1 is re-saved,
     status gets set to 'preliminary' (downgraded). This matches V1.
```

### C.2 Re-save Behavior

When a stage is submitted a second time (e.g., editing Stage 1 after it was already submitted):

- **Stage status columns**: Overwritten with new `submittedAt` timestamp and `submittedBy` value
- **Overall status**: Always set to the stage's target status (may downgrade — matches V1)
- **Child table rows**: Previous rows are soft-deleted (`is_deleted = true`), new rows inserted
- This matches V1's behavior where `{ ...appraisalData, ...data }` overwrites previous stage data

### C.3 Stage → Child Table Sync Mapping

| Stage | Child Tables Synced |
|-------|-------------------|
| stage1 | `appr_trainings_v2`, `appr_targets_v2` |
| stage2 | `appr_competence_assessments_v2`, `appr_behavioural_assessments_v2`, `appr_training_needs_v2`, `appr_recommendations_v2`, `appr_appraiser_comments_v2`, `appr_seafarer_comments_v2` |
| stage3 | `appr_office_reviews_v2`, `appr_training_followups_v2` |

Additionally for stage1: Parent flat fields (seafarers_name, seafarers_rank, nationality, vessel, sign_on, appraisal_type, appraisal_period_from, appraisal_period_to, personality_index_category, primary_appraiser) are updated on the parent record.

### C.4 Error Codes

| Condition | HTTP Status | Error Message |
|-----------|------------|---------------|
| Appraisal not found | 404 | "Appraisal not found" |
| Stage 2 without Stage 1 | 400 | "Stage 1 must be submitted before Stage 2" |
| Stage 3 without Stage 2 | 400 | "Stage 2 must be submitted before Stage 3" |
| Invalid stage data (Zod) | 400 | Zod validation error details |
| Database error | 500 | "Failed to submit stage" |

---

## Appendix D: Complete Frontend Hook/Import Swaps

### D.1 `ElementCrewAppraisals.tsx` → `ElementCrewAppraisals_v2.tsx`

| Line(s) | V1 Import/Usage | V2 Replacement | V2 Import Source |
|---------|----------------|----------------|-----------------|
| 30 | `import { useVesselLookup } from "@/hooks/useVesselLookup"` | `import { useVesselsV2 } from "@/hooks/v2/useMasterDataV2"` | `useMasterDataV2.ts` |
| 31 | `import { useExternalVessels } from "@/hooks/useExternalVessels"` | Remove — `useVesselsV2()` covers this | — |
| 32 | `import { useCompanyRanks } from "@/hooks/useCompanyRanks"` | `import { useCompanyRanksV2 } from "@/hooks/v2/useAdminV2"` | `useAdminV2.ts` |
| 33 | `import { DEFAULT_DROPDOWN_VESSEL_TYPES } from '@/utils/data/vesselTypes'` | `import { useVesselTypesV2 } from "@/hooks/v2/useMasterDataV2"` | `useMasterDataV2.ts` |
| 180 | `const { getVesselName } = useVesselLookup()` | `const { data: vessels = [] } = useVesselsV2(); const getVesselName = (id: string) => vessels.find((v: any) => v.uuid === id)?.name \|\| id` | inline |
| 206 | `const { rankOptions } = useCompanyRanks()` | `const { data: companyRanks = [] } = useCompanyRanksV2(); const rankOptions = companyRanks.map(r => ({ value: r.uuid, label: r.name }))` | inline mapping |
| 209 | `const { data: externalVessels = [] } = useExternalVessels()` | `const { data: externalVessels = [] } = useVesselsV2()` | `useMasterDataV2.ts` |
| 257 | `DEFAULT_DROPDOWN_VESSEL_TYPES.map(...)` | `const { data: vesselTypes = [] } = useVesselTypesV2(); vesselTypes.map(...)` | `useMasterDataV2.ts` |
| 195 | `queryKey: ["/api/appraisals"]` | `queryKey: ["/api/v2/appraisals"]` | — |
| 197 | `fetch("/api/appraisals")` | `fetch("/api/v2/appraisals")` | — |
| — | `import { AppraisalForm } from "./AppraisalForm"` | `import { AppraisalForm } from "./AppraisalForm_v2"` | local V2 |

### D.2 `AppraisalForm.tsx` → `AppraisalForm_v2.tsx`

| Line(s) | V1 Import/Usage | V2 Replacement | V2 Import Source |
|---------|----------------|----------------|-----------------|
| 21 | `import { useVesselLookup } from "@/hooks/useVesselLookup"` | `import { useVesselsV2 } from "@/hooks/v2/useMasterDataV2"` | `useMasterDataV2.ts` |
| 24 | `import { useMasterDataEntries } from "@/hooks/useDataMasters"` | `import { useAppraisalTypesV2 } from "@/hooks/v2/useMasterDataV2"` | `useMasterDataV2.ts` |
| 362 | `const { vessels } = useVesselLookup()` | `const { data: vessels = [] } = useVesselsV2()` | `useMasterDataV2.ts` |
| 368 | `const { data: appraisalTypesRaw = [] } = useMasterDataEntries('023')` | `const { data: appraisalTypesRaw = [] } = useAppraisalTypesV2()` | `useMasterDataV2.ts` (via `/api/v2/masters/appraisal-types`) |
| 394 | `` queryKey: [`/api/appraisals/${appraisalId}`] `` | `queryKey: ["/api/v2/appraisals", appraisalId]` | — |
| 675 | `'/api/appraisals'` (POST URL) | `'/api/v2/appraisals'` | — |
| 675 | `` `/api/appraisals/${idToUse}` `` (PUT URL) | `` `/api/v2/appraisals/${idToUse}` `` | — |
| 688 | `queryClient.invalidateQueries({ queryKey: ['/api/appraisals'] })` | `queryClient.invalidateQueries({ queryKey: ['/api/v2/appraisals'] })` | — |
| 728 | `` `/api/appraisals/${id}/submit-stage1` `` | `` `/api/v2/appraisals/${id}/submit-stage1` `` | — |
| 740-741 | invalidateQueries for V1 appraisals | update queryKeys to `/api/v2/appraisals` prefix | — |
| 762 | `` `/api/appraisals/${id}/submit-stage2` `` | `` `/api/v2/appraisals/${id}/submit-stage2` `` | — |
| 774-775 | invalidateQueries for V1 appraisals | update queryKeys to `/api/v2/appraisals` prefix | — |
| 792 | `` `/api/appraisals/${id}/submit-stage3` `` | `` `/api/v2/appraisals/${id}/submit-stage3` `` | — |
| 800-801 | invalidateQueries for V1 appraisals | update queryKeys to `/api/v2/appraisals` prefix | — |

### D.3 Shared Imports (NOT swapped in V2 copies)

These imports remain identical in V2 copies — they are shared UI components with no data fetching:
- `import { PartA, PartB, PartC, PartD, PartE, PartF, PartG } from "@/components/appraisal-form-parts"` — shared Part UI components (no data hooks inside)
- `import { TrainingCourseSelectionDialog } from '@/modules/crew-pool/TrainingCourseSelectionDialog'` — shared dialog
- `import type { TrainingCourseTemplate } from '@/utils/data/trainingCourseTemplates'` — type import only
- All shadcn component imports (`Button`, `Card`, `Input`, etc.) — unchanged
- `apiRequest`, `queryClient` from `@/lib/queryClient` — unchanged
- `NATIONALITIES` constant array — **kept as hardcoded constant** (AppraisalForm.tsx lines 30-50). This is a static list of nationality strings used for the nationality dropdown. It does NOT come from `master_nationalities` or any API — it's a hardcoded array in the component. In V2, this remains unchanged. The `useNationalitiesV2()` hook is used in `ElementCrewAppraisals_v2.tsx` for the list/table view (resolving nationality UUIDs to names), but the form itself uses the hardcoded list for the dropdown.
- Zod schemas (`trainingSchema`, etc.) — unchanged

### D.4 V2 Appraisal Types Master Data

V1 uses `useMasterDataEntries('023')` to fetch appraisal types from the shared `master_data_entries` table.

V2 uses the dedicated `master_appraisal_types` table (created in migration 0090) via:
- Endpoint: `/api/v2/masters/appraisal-types`
- Hook: `useAppraisalTypesV2()` from `client/src/hooks/v2/useMasterDataV2.ts`
- Response includes alias fields (`uuid`, `name`) matching the V1 external API shape — zero frontend field mapping changes needed
