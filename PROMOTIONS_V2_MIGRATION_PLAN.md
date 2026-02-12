# Promotions Module V2 Migration Plan

## Overview

Migrate the Promotions module from V1 (JSON-heavy `promotion_reviews` table) to V2 (normalized relational tables with UUID identifiers and audit columns). The V1 `promotion_reviews` table stores criteria statuses, CES tests, comments, training needs, approvals, and checklist progress as JSON blobs. V2 breaks these into 8 dedicated child tables linked by `review_uuid`, plus a new `promo_criteria_master_v2` reference table.

**No V1 code is modified.** V2 is fully isolated in its own folder structure.

---

## Architecture: V1 vs V2

### V1 (Current)
- **1 table**: `promotion_reviews` with 7 JSON text columns:
  - `criteria_verified_status` → JSON object `{ "a2.1": "yes", ... }`
  - `criteria_meets_status` → JSON object `{ "a2.1": "yes", ... }`
  - `ces_tests_data` → JSON array `[{ id, description, date, minScore, score, result }]`
  - `criteria_comments` → JSON object `{ "a2.1": [{ id, user, text }], "a3": {...}, "a4": [...] }`
  - `training_needs` → JSON array `[{ id, training, correspondingInDB, category, status, completionDate }]`
  - `approval_data` → JSON array `[{ id, date, approver, status, approval, comments, isFromPartA, isSelectedForSubmission }]`
  - `checklist_progress_data` → JSON object `{ "section_id:assessment_point_id": { verifierName, date } }`
- **1 table**: `promotion_hierarchies` (already migrated to V2 in Admin module as `adm_promotion_hierarchies_v2`)

### V2 (Target — 9 new tables, all ending with `_v2`)
1. **`promo_criteria_master_v2`** — Reference table for promotion criteria definitions
2. **`promotion_reviews_v2`** — Core review record (flat fields only, no JSON)
3. **`promo_criteria_status_v2`** — One row per criteria per review (replaces both `criteria_verified_status` and `criteria_meets_status` JSON)
4. **`promo_ces_tests_v2`** — One row per CES test per review (replaces `ces_tests_data` JSON)
5. **`promo_criteria_comments_v2`** — One row per criteria comment (replaces criteria portion of `criteria_comments` JSON, keys like a2.1, a2.2 etc.)
6. **`promo_training_comments_v2`** — One row per training comment (replaces `a3` portion of `criteria_comments` JSON, keyed by training row id)
7. **`promo_training_needs_v2`** — One row per training need (replaces `training_needs` JSON)
8. **`promo_approvals_v2`** — One row per approver entry (replaces `approval_data` JSON)
9. **`promo_checklist_progress_v2`** — One row per checklist verification (replaces `checklist_progress_data` JSON)

All tables have: `uuid PK`, `audit columns` (created_by_uuid, updated_by_uuid), `is_deleted`, `is_sync`, `sort_order`, `created_at`, `updated_at`.

### V2 Admin / Crew Pool Table References
The V2 promotions module references these existing V2 tables (not V1):
- **Promotion Hierarchies**: `adm_promotion_hierarchies_v2` via `/api/v2/admin/promotion-hierarchies`
- **Forms**: `adm_forms_v2` via `/api/v2/admin/forms`
- **Rank Groups**: `adm_rank_groups_v2` via `/api/v2/admin/rank-groups`
- **Available Ranks**: `adm_available_ranks_v2` via `/api/v2/admin/available-ranks`
- **Company Ranks**: `adm_company_ranks_v2` via `/api/v2/admin/company-ranks`
- **Crew Members**: V2 crew pool via `/api/v2/crew-pool`

---

## Step-by-Step Plan

### STEP 1: Database Migration

**File**: `server/migrations/0090_create_promotions_v2_tables.sql`

Create all 9 tables using `CREATE TABLE IF NOT EXISTS`:

#### 1.1 `promo_criteria_master_v2`
```sql
CREATE TABLE IF NOT EXISTS promo_criteria_master_v2 (
  id SERIAL PRIMARY KEY,
  criteria_uuid TEXT NOT NULL UNIQUE,
  criteria_code TEXT NOT NULL,
  criteria_label TEXT NOT NULL,
  section TEXT,
  is_parent BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);
```

**Seed data** (from V1 criteria IDs used in PromotionReviewForm.tsx):
| code | label | section | is_parent |
|------|-------|---------|-----------|
| a2.1 | Higher License Criteria | a2 | false |
| a2.2 | Age Criteria | a2 | false |
| a2.3 | Experience & Sea Service Criteria | a2 | true |
| a2.3a | Minimum Rank Experience (Vessel) | a2.3 | false |
| a2.3b | Minimum Rank Experience (Vessel Type) | a2.3 | false |
| a2.3c | Company Service | a2.3 | false |
| a2.3d | Minimum Tanker Experience | a2.3 | false |
| a2.4 | Recommendations Criteria | a2 | false |
| a2.5a | Promotion Checklist Completed | a2.5 | false |
| a2.6 | Other Criteria | a2 | true |
| a2.7 | CES / Language Tests Criteria | a2 | true |
| a2.8 | Training & Other Documents Verification | a2 | false |

Note: Dynamic `a2.6a`, `a2.6b`, etc. (from rank group config `otherCriteria`) are NOT in master. They are generated at runtime from rank group configuration — same as V1.

#### 1.2 `promotion_reviews_v2`
```sql
CREATE TABLE IF NOT EXISTS promotion_reviews_v2 (
  id SERIAL PRIMARY KEY,
  review_uuid TEXT NOT NULL UNIQUE,
  crew_member_id TEXT NOT NULL,
  promotion_to_rank TEXT NOT NULL,
  selected_vessel_type_for_a2_3b TEXT,
  promotion_confirmed TEXT,
  vessel_assigned TEXT,
  promotion_date TEXT,
  promotion_timing TEXT,
  part_a_notes TEXT,
  part_b_notes TEXT,
  part_c_notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);
```

#### 1.3 `promo_criteria_status_v2`
Replaces both `criteria_verified_status` and `criteria_meets_status` JSON columns.
```sql
CREATE TABLE IF NOT EXISTS promo_criteria_status_v2 (
  id SERIAL PRIMARY KEY,
  cs_uuid TEXT NOT NULL UNIQUE,
  review_uuid TEXT NOT NULL,
  criteria_code TEXT NOT NULL,
  verified_status TEXT,
  meets_status TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);
```

Uses `criteria_code` (e.g. "a2.1", "a2.3a", "a2.6a") rather than FK to criteria_master, because dynamic criteria codes (a2.6a, a2.6b from rank group config) don't exist in master.

#### 1.4 `promo_ces_tests_v2`
Replaces `ces_tests_data` JSON column.
```sql
CREATE TABLE IF NOT EXISTS promo_ces_tests_v2 (
  id SERIAL PRIMARY KEY,
  ct_uuid TEXT NOT NULL UNIQUE,
  review_uuid TEXT NOT NULL,
  test_id TEXT,
  description TEXT,
  date TEXT,
  min_score TEXT,
  score TEXT,
  result TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);
```

#### 1.5 `promo_criteria_comments_v2`
Replaces the criteria portion of `criteria_comments` JSON (keys like "a2.1", "a2.2", etc.).
```sql
CREATE TABLE IF NOT EXISTS promo_criteria_comments_v2 (
  id SERIAL PRIMARY KEY,
  cc_uuid TEXT NOT NULL UNIQUE,
  review_uuid TEXT NOT NULL,
  criteria_code TEXT NOT NULL,
  comment_id TEXT,
  comment_user TEXT,
  comment_text TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);
```

#### 1.6 `promo_training_comments_v2`
Replaces the `a3` portion of `criteria_comments` JSON (keyed by training row id).
```sql
CREATE TABLE IF NOT EXISTS promo_training_comments_v2 (
  id SERIAL PRIMARY KEY,
  tc_uuid TEXT NOT NULL UNIQUE,
  review_uuid TEXT NOT NULL,
  training_row_id TEXT NOT NULL,
  comment_id TEXT,
  comment_user TEXT,
  comment_text TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);
```

#### 1.7 `promo_training_needs_v2`
Replaces `training_needs` JSON column.
```sql
CREATE TABLE IF NOT EXISTS promo_training_needs_v2 (
  id SERIAL PRIMARY KEY,
  tn_uuid TEXT NOT NULL UNIQUE,
  review_uuid TEXT NOT NULL,
  training_row_id TEXT,
  training TEXT,
  corresponding_in_db TEXT,
  category TEXT,
  status TEXT,
  completion_date TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);
```

#### 1.8 `promo_approvals_v2`
Replaces `approval_data` and `selected_approvers_for_submission` JSON columns.
```sql
CREATE TABLE IF NOT EXISTS promo_approvals_v2 (
  id SERIAL PRIMARY KEY,
  ap_uuid TEXT NOT NULL UNIQUE,
  review_uuid TEXT NOT NULL,
  approver_id TEXT,
  date TEXT,
  approver TEXT,
  status TEXT,
  approval TEXT,
  comments TEXT,
  is_from_part_a BOOLEAN DEFAULT false,
  is_selected_for_submission BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);
```

#### 1.9 `promo_checklist_progress_v2`
Replaces `checklist_progress_data` JSON column.
```sql
CREATE TABLE IF NOT EXISTS promo_checklist_progress_v2 (
  id SERIAL PRIMARY KEY,
  cp_uuid TEXT NOT NULL UNIQUE,
  review_uuid TEXT NOT NULL,
  section_id TEXT NOT NULL,
  assessment_point_id TEXT NOT NULL,
  verifier_name TEXT,
  date TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);
```

---

### STEP 2: Drizzle Schema Definitions

**File**: `shared/v2/promotions/schema.ts`

Define all 9 tables using Drizzle ORM `pgTable()` with proper column types matching the SQL migration. Reuse `auditColumns` pattern from `shared/v2/admin/schema.ts`.

```typescript
import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";

export const auditColumns = {
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
};

// (9 table definitions follow matching SQL above)
```

**File**: `shared/v2/promotions/types.ts`

For each table, define:
- `insertSchema` using `createInsertSchema(table).omit({ id: true, createdAt: true, updatedAt: true })`
- `InsertType` = `z.infer<typeof insertSchema>`
- `SelectType` = `typeof table.$inferSelect`

---

### STEP 3: Backend — Repositories (with JOIN optimization)

**Directory**: `server/v2/promotions/repositories/`

**Key design**: The `promotionReviewsRepository` uses JOINs to avoid N+1 queries. When fetching reviews (list or by ID), it performs:
1. One query for the review(s) from `promotion_reviews_v2`
2. One batched query per child table using `WHERE review_uuid IN (...)` — NOT one query per review

This means fetching 50 reviews = 1 review query + 7 child table queries = **8 total queries** instead of 50 × 7 = 350 queries.

For single review fetch (getById), the approach is even more optimized: use LEFT JOINs across all child tables in a single query and aggregate results in application code.

| File | Class | Key Methods |
|------|-------|-------------|
| `promoCriteriaMasterRepository.ts` | `PromoCriteriaMasterRepository` | `findAll()`, `findById()`, `findByCode()`, `create()`, `updateById()`, `softDeleteById()` |
| `promotionReviewsRepository.ts` | `PromotionReviewsRepository` | `findAll()`, `findById()`, `findByCrewMemberId()`, `findByCrewAndRank()`, `create()`, `updateById()`, `softDeleteById()` |
| `promoCriteriaStatusRepository.ts` | `PromoCriteriaStatusRepository` | `findByReviewUuids(reviewUuids[])` ← batch, `upsertByReviewAndCriteria()`, `softDeleteByReviewUuid()` |
| `promoCesTestsRepository.ts` | `PromoCesTestsRepository` | `findByReviewUuids(reviewUuids[])` ← batch, `syncForReview(reviewUuid, rows[])`, `softDeleteByReviewUuid()` |
| `promoCriteriaCommentsRepository.ts` | `PromoCriteriaCommentsRepository` | `findByReviewUuids(reviewUuids[])` ← batch, `syncForReview(reviewUuid, rows[])`, `softDeleteByReviewUuid()` |
| `promoTrainingCommentsRepository.ts` | `PromoTrainingCommentsRepository` | `findByReviewUuids(reviewUuids[])` ← batch, `syncForReview(reviewUuid, rows[])`, `softDeleteByReviewUuid()` |
| `promoTrainingNeedsRepository.ts` | `PromoTrainingNeedsRepository` | `findByReviewUuids(reviewUuids[])` ← batch, `syncForReview(reviewUuid, rows[])`, `softDeleteByReviewUuid()` |
| `promoApprovalsRepository.ts` | `PromoApprovalsRepository` | `findByReviewUuids(reviewUuids[])` ← batch, `syncForReview(reviewUuid, rows[])`, `softDeleteByReviewUuid()` |
| `promoChecklistProgressRepository.ts` | `PromoChecklistProgressRepository` | `findByReviewUuids(reviewUuids[])` ← batch, `upsertBySectionAndPoint()`, `softDeleteByReviewUuid()` |

**Batch query pattern** (avoids N+1):
```typescript
async findByReviewUuids(reviewUuids: string[]): Promise<Map<string, ChildRow[]>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(childTable)
    .where(and(
      inArray(childTable.reviewUuid, reviewUuids),
      eq(childTable.isDeleted, false)
    ));
  // Group by reviewUuid into Map
  const map = new Map<string, ChildRow[]>();
  for (const row of rows) {
    if (!map.has(row.reviewUuid)) map.set(row.reviewUuid, []);
    map.get(row.reviewUuid)!.push(row);
  }
  return map;
}
```

**File**: `server/v2/promotions/repositories/index.ts` — barrel export

---

### STEP 4: Backend — Services (V1-compatible response assembly)

**Directory**: `server/v2/promotions/services/`

Services wrap repositories with business logic and audit user handling via `applyAuditUser()` from `server/v2/admin/utils/auditUser.ts` (reused, not duplicated).

#### 4.1 `promoCriteriaMasterService.ts`
- CRUD for criteria master records
- `applyAuditUser()` on create/update

#### 4.2 `promotionReviewsService.ts` — **Core service** (most complex)

**Key responsibility**: Assemble V1-compatible response from normalized tables using batch queries (no N+1).

**GET methods** (all return V1-shaped response):
```typescript
async getAll(): Promise<V1PromotionReview[]> {
  // 1. Fetch all non-deleted reviews
  const reviews = await reviewsRepo.findAll();
  if (reviews.length === 0) return [];
  
  // 2. Batch-fetch all child data for ALL review UUIDs in parallel (no N+1)
  const reviewUuids = reviews.map(r => r.reviewUuid);
  const [criteriaStatuses, cesTests, criteriaComments, trainingComments, 
         trainingNeeds, approvals, checklistProgress] = await Promise.all([
    criteriaStatusRepo.findByReviewUuids(reviewUuids),
    cesTestsRepo.findByReviewUuids(reviewUuids),
    criteriaCommentsRepo.findByReviewUuids(reviewUuids),
    trainingCommentsRepo.findByReviewUuids(reviewUuids),
    trainingNeedsRepo.findByReviewUuids(reviewUuids),
    approvalsRepo.findByReviewUuids(reviewUuids),
    checklistProgressRepo.findByReviewUuids(reviewUuids),
  ]);
  
  // 3. Assemble V1-shaped response for each review
  return reviews.map(review => assembleV1Response(
    review, 
    criteriaStatuses.get(review.reviewUuid) || [],
    cesTests.get(review.reviewUuid) || [],
    criteriaComments.get(review.reviewUuid) || [],
    trainingComments.get(review.reviewUuid) || [],
    trainingNeeds.get(review.reviewUuid) || [],
    approvals.get(review.reviewUuid) || [],
    checklistProgress.get(review.reviewUuid) || [],
  ));
}
```

Total queries for getAll() with N reviews: **8 queries** (1 reviews + 7 child tables), regardless of N.

**POST/PATCH methods** (accept V1-format body):
```typescript
async createOrUpdate(data: any, existingId?: number): Promise<V1PromotionReview> {
  // 1. Extract flat fields → create/update promotion_reviews_v2
  // 2. Parse criteriaVerifiedStatus + criteriaMeetsStatus JSON → sync promo_criteria_status_v2
  // 3. Parse cesTestsData JSON → sync promo_ces_tests_v2
  // 4. Parse criteriaComments JSON → sync promo_criteria_comments_v2 + promo_training_comments_v2
  // 5. Parse trainingNeeds JSON → sync promo_training_needs_v2
  // 6. Parse approvalData JSON → sync promo_approvals_v2
  // 7. Parse checklistProgressData JSON → sync promo_checklist_progress_v2
  // 8. Return V1-shaped response (reassembled from child tables)
}
```

**V1-compatible response shape** (returned by all GET endpoints):
```typescript
function assembleV1Response(review, criteriaStatuses, cesTests, ...): V1PromotionReview {
  // Reassemble criteriaVerifiedStatus from promo_criteria_status_v2 rows
  const criteriaVerifiedStatus: Record<string, string> = {};
  const criteriaMeetsStatus: Record<string, string> = {};
  for (const cs of criteriaStatuses) {
    criteriaVerifiedStatus[cs.criteriaCode] = cs.verifiedStatus || '';
    criteriaMeetsStatus[cs.criteriaCode] = cs.meetsStatus || '';
  }

  // Reassemble cesTestsData from promo_ces_tests_v2 rows
  const cesTestsDataArr = cesTests.map(ct => ({
    id: ct.testId, description: ct.description, date: ct.date,
    minScore: ct.minScore, score: ct.score, result: ct.result
  }));

  // Reassemble criteriaComments from promo_criteria_comments_v2 + promo_training_comments_v2
  const criteriaCommentsObj: Record<string, any> = {};
  // Group criteria comments by criteriaCode
  for (const cc of criteriaComments) {
    if (!criteriaCommentsObj[cc.criteriaCode]) criteriaCommentsObj[cc.criteriaCode] = [];
    criteriaCommentsObj[cc.criteriaCode].push({ id: cc.commentId, user: cc.commentUser, text: cc.commentText });
  }
  // Group training comments under "a3" key by trainingRowId
  const a3Comments: Record<string, any[]> = {};
  for (const tc of trainingComments) {
    if (!a3Comments[tc.trainingRowId]) a3Comments[tc.trainingRowId] = [];
    a3Comments[tc.trainingRowId].push({ id: tc.commentId, user: tc.commentUser, text: tc.commentText });
  }
  if (Object.keys(a3Comments).length > 0) criteriaCommentsObj["a3"] = a3Comments;

  // Reassemble trainingNeeds from promo_training_needs_v2 rows
  const trainingNeedsArr = trainingNeeds.map(tn => ({
    id: tn.trainingRowId, training: tn.training, correspondingInDB: tn.correspondingInDb,
    category: tn.category, status: tn.status, completionDate: tn.completionDate
  }));

  // Reassemble approvalData from promo_approvals_v2 rows
  const approvalDataArr = approvals.map(ap => ({
    id: ap.approverId, date: ap.date, approver: ap.approver,
    status: ap.status, approval: ap.approval, comments: ap.comments,
    isFromPartA: ap.isFromPartA, isSelectedForSubmission: ap.isSelectedForSubmission
  }));

  // Reassemble selectedApproversForSubmission
  const selectedApprovers = approvals
    .filter(ap => ap.isSelectedForSubmission)
    .map(ap => ap.approver);

  // Reassemble checklistProgressData from promo_checklist_progress_v2 rows
  const checklistProgressObj: Record<string, any> = {};
  for (const cp of checklistProgress) {
    const key = `${cp.sectionId}:${cp.assessmentPointId}`;
    checklistProgressObj[key] = { verifierName: cp.verifierName, date: cp.date };
  }

  return {
    id: review.id,
    crewMemberId: review.crewMemberId,
    promotionToRank: review.promotionToRank,
    selectedVesselTypeForA2_3b: review.selectedVesselTypeForA23b,
    criteriaVerifiedStatus: JSON.stringify(criteriaVerifiedStatus),
    criteriaMeetsStatus: JSON.stringify(criteriaMeetsStatus),
    cesTestsData: JSON.stringify(cesTestsDataArr),
    criteriaComments: JSON.stringify(criteriaCommentsObj),
    trainingNeeds: JSON.stringify(trainingNeedsArr),
    approvalData: JSON.stringify(approvalDataArr),
    selectedApproversForSubmission: JSON.stringify(selectedApprovers),
    checklistProgressData: JSON.stringify(checklistProgressObj),
    promotionConfirmed: review.promotionConfirmed,
    vesselAssigned: review.vesselAssigned,
    promotionDate: review.promotionDate,
    promotionTiming: review.promotionTiming,
    partANotes: review.partANotes,
    partBNotes: review.partBNotes,
    partCNotes: review.partCNotes,
    status: review.status,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}
```

**Auto-sync (ensurePromotionReviewsForEligibleCrew V2 equivalent)**:
The V2 getAll endpoint includes the same auto-sync logic as V1, but references V2 tables:
- Reads crew members from V2 crew pool
- Reads promotion hierarchies from `adm_promotion_hierarchies_v2`
- Creates missing review records in `promotion_reviews_v2`

#### 4.3 `responseAssembler.ts`
**File**: `server/v2/promotions/utils/responseAssembler.ts`

Extracted utility that converts normalized child table rows back into V1-compatible JSON response. Used by all GET methods in `promotionReviewsService`.

**File**: `server/v2/promotions/services/index.ts` — barrel export

---

### STEP 5: Backend — Controllers & Routes

**Directory**: `server/v2/promotions/controllers/`

#### 5.1 `promoCriteriaMasterController.ts`
| Method | Endpoint | Handler |
|--------|----------|---------|
| GET | `/criteria-master` | getAll |
| GET | `/criteria-master/:id` | getById |
| POST | `/criteria-master` | create |
| PATCH | `/criteria-master/:id` | update |
| DELETE | `/criteria-master/:id` | softDelete |

#### 5.2 `promotionReviewsController.ts`
Maps V1 endpoint patterns under `/api/v2/promotions/`:

| Method | Endpoint | V1 Equivalent | Handler |
|--------|----------|---------------|---------|
| GET | `/reviews` | `/api/promotion-reviews` | getAll (with auto-sync) |
| GET | `/reviews/:id` | `/api/promotion-reviews/:id` | getById |
| GET | `/reviews/crew/:crewMemberId` | `/api/promotion-reviews/crew/:crewMemberId` | getByCrewMemberId |
| GET | `/reviews/crew/:crewMemberId/rank/:promotionToRank` | `/api/promotion-reviews/crew/:crewMemberId/rank/:promotionToRank` | getByCrewAndRank |
| POST | `/reviews` | `/api/promotion-reviews` | create (accepts V1 body with JSON fields) |
| PATCH | `/reviews/:id` | `/api/promotion-reviews/:id` | update (accepts V1 body with JSON fields) |
| DELETE | `/reviews/:id` | `/api/promotion-reviews/:id` | softDelete |

**Route ordering note**: `/reviews/crew/:crewMemberId/rank/:promotionToRank` and `/reviews/crew/:crewMemberId` must be registered BEFORE `/reviews/:id` to avoid route conflicts.

#### 5.3 Route Registration
**File**: `server/v2/promotions/routes.ts`
```typescript
const router = Router();

// Criteria Master
router.get("/criteria-master", criteriaMasterController.getAll);
router.get("/criteria-master/:id", criteriaMasterController.getById);
router.post("/criteria-master", criteriaMasterController.create);
router.patch("/criteria-master/:id", criteriaMasterController.update);
router.delete("/criteria-master/:id", criteriaMasterController.delete);

// Reviews (order matters: specific routes before parameterized)
router.get("/reviews", reviewsController.getAll);
router.get("/reviews/crew/:crewMemberId/rank/:promotionToRank", reviewsController.getByCrewAndRank);
router.get("/reviews/crew/:crewMemberId", reviewsController.getByCrewMemberId);
router.get("/reviews/:id", reviewsController.getById);
router.post("/reviews", reviewsController.create);
router.patch("/reviews/:id", reviewsController.update);
router.delete("/reviews/:id", reviewsController.delete);

export default router;
```

**File**: `server/routes.ts` — Register V2 router (at line ~1490 area, after other V2 routes):
```typescript
import promotionsV2Routes from "./v2/promotions/routes";
app.use("/api/v2/promotions", promotionsV2Routes);
```

---

### STEP 6: Frontend — V2 API Client & Hooks

**File**: `client/src/modules/promotions/v2/api/promotionsApiV2.ts`

```typescript
const V2_BASE = "/api/v2/promotions";

export const promotionsApiV2 = {
  // Criteria Master
  getCriteriaMaster: () => fetch(`${V2_BASE}/criteria-master`).then(r => r.json()),
  createCriteriaMaster: (data) => apiRequest("POST", `${V2_BASE}/criteria-master`, data),
  updateCriteriaMaster: (id, data) => apiRequest("PATCH", `${V2_BASE}/criteria-master/${id}`, data),
  deleteCriteriaMaster: (id) => apiRequest("DELETE", `${V2_BASE}/criteria-master/${id}`),

  // Reviews
  getReviews: () => fetch(`${V2_BASE}/reviews`).then(r => r.json()),
  getReviewById: (id) => fetch(`${V2_BASE}/reviews/${id}`).then(r => r.json()),
  getReviewsByCrewMember: (crewMemberId) => fetch(`${V2_BASE}/reviews/crew/${crewMemberId}`).then(r => r.json()),
  getReviewByCrewAndRank: (crewMemberId, rank) => 
    fetch(`${V2_BASE}/reviews/crew/${crewMemberId}/rank/${encodeURIComponent(rank)}`).then(r => r.json()),
  createReview: (data) => apiRequest("POST", `${V2_BASE}/reviews`, data),
  updateReview: (id, data) => apiRequest("PATCH", `${V2_BASE}/reviews/${id}`, data),
  deleteReview: (id) => apiRequest("DELETE", `${V2_BASE}/reviews/${id}`),
};
```

**File**: `client/src/modules/promotions/v2/hooks/usePromotionsV2.ts`

Hooks that mirror V1 query keys but point to V2 endpoints. All mutations wrap data with `auditUserUuid` from `localStorage.getItem('crewUserId')`.

```typescript
// Queries
usePromotionReviewsV2()           → queryKey: ["/api/v2/promotions/reviews"]
usePromotionReviewByIdV2(id)      → queryKey: ["/api/v2/promotions/reviews", id]
usePromotionReviewByCrewV2(crewId) → queryKey: ["/api/v2/promotions/reviews/crew", crewId]
usePromotionReviewByCrewAndRankV2(crewId, rank) → queryKey: ["/api/v2/promotions/reviews/crew", crewId, "rank", rank]
useCriteriaMasterV2()             → queryKey: ["/api/v2/promotions/criteria-master"]

// Mutations (all include auditUserUuid)
useCreatePromotionReviewV2()      → POST /reviews with { ...data, auditUserUuid }
useUpdatePromotionReviewV2()      → PATCH /reviews/:id with { ...data, auditUserUuid }
useDeletePromotionReviewV2()      → DELETE /reviews/:id
```

**File**: `client/src/modules/promotions/v2/hooks/usePromotionsVersion.ts`
Same pattern as `useAdminVersion` — reads/writes localStorage key `promotions_module_version`:
```typescript
export function usePromotionsVersion() {
  const [version, setVersionState] = useState<'v1'|'v2'>(() => {
    return (localStorage.getItem('promotions_module_version') as 'v1'|'v2') || 'v1';
  });
  // toggle, setVersion, isV2 computed
}
```

---

### STEP 7: Frontend — V2 Promotions Module

**File**: `client/src/modules/promotions/v2/PromotionsModule_v2.tsx`

Copy of V1 `PromotionsModule.tsx` but with V2 data sources:

| V1 Query | V2 Replacement |
|-----------|---------------|
| `queryKey: ['/api/promotion-reviews']` | `queryKey: ['/api/v2/promotions/reviews']` |
| `queryKey: ['/api/promotion-hierarchies']` | `queryKey: ['/api/v2/admin/promotion-hierarchies']` |
| `queryKey: ['/api/forms']` | `queryKey: ['/api/v2/admin/forms']` |
| `queryKey: ['/api/rank-groups']` | `queryKey: ['/api/v2/admin/rank-groups']` |
| `queryKey: ['/api/crew-members']` | `queryKey: ['/api/v2/crew-pool']` |
| `apiRequest('PATCH', '/api/promotion-reviews/...')` | `apiRequest('PATCH', '/api/v2/promotions/reviews/...')` |

The existing `PromotionsTable.tsx`, `PromotionReviewForm.tsx`, and `PromotionChecklistForm.tsx` components receive data in the same V1-compatible JSON shape, so they work unchanged. The only change is which hooks/endpoints provide the data.

**Version Toggle UI**: `client/src/modules/promotions/v2/components/PromotionsVersionToggle.tsx`
Same pattern as `AdminVersionToggle`.

**File**: `client/src/modules/promotions/index.tsx`

Version toggle router (same pattern as `client/src/modules/admin/index.tsx`):
```typescript
import { usePromotionsVersion } from './v2/hooks/usePromotionsVersion';
import { PromotionsModule } from './PromotionsModule';
import { PromotionsModule_v2 } from './v2/PromotionsModule_v2';

export default function PromotionsRouter() {
  const { isV2 } = usePromotionsVersion();
  return isV2 ? <PromotionsModule_v2 /> : <PromotionsModule />;
}
```

---

## Data Flow Summary

### Save (POST/PATCH) — Frontend → Backend
```
Frontend sends V1-shaped body:
{
  crewMemberId, promotionToRank,
  criteriaVerifiedStatus: "{...}",     ← JSON string
  criteriaMeetsStatus: "{...}",        ← JSON string
  cesTestsData: "[...]",              ← JSON string
  criteriaComments: "{...}",           ← JSON string
  trainingNeeds: "[...]",              ← JSON string
  approvalData: "[...]",               ← JSON string
  checklistProgressData: "{...}",      ← JSON string
  ...flat fields,
  auditUserUuid: "..."                ← from localStorage.crewUserId
}

Backend promotionReviewsService.createOrUpdate():
  1. Extract auditUserUuid via applyAuditUser()
  2. Upsert promotion_reviews_v2 (flat fields only)
  3. Parse criteriaVerifiedStatus + criteriaMeetsStatus JSON → upsert promo_criteria_status_v2 rows
  4. Parse cesTestsData JSON → sync promo_ces_tests_v2 rows (delete old + insert new)
  5. Parse criteriaComments JSON → sync promo_criteria_comments_v2 + promo_training_comments_v2
  6. Parse trainingNeeds JSON → sync promo_training_needs_v2 rows
  7. Parse approvalData JSON → sync promo_approvals_v2 rows
  8. Parse checklistProgressData JSON → sync promo_checklist_progress_v2 rows
  9. Return V1-shaped response (reassembled from child tables)
```

### Read (GET) — Backend → Frontend
```
Backend promotionReviewsService.getAll():
  1. Fetch all reviews from promotion_reviews_v2 (1 query)
  2. Extract all review UUIDs
  3. Batch-fetch ALL child rows using WHERE review_uuid IN (...) (7 parallel queries)
  4. Group child rows by review_uuid using Map
  5. For each review, assemble V1-compatible response via responseAssembler
  Total: 8 queries regardless of number of reviews (no N+1)

Backend promotionReviewsService.getById():
  1. Fetch single review from promotion_reviews_v2
  2. Batch-fetch child rows for single review_uuid (7 parallel queries)
  3. Assemble V1-compatible response
  Total: 8 queries for single review fetch
```

---

## Folder Structure (Final)

```
server/v2/promotions/
├── repositories/
│   ├── promoCriteriaMasterRepository.ts
│   ├── promotionReviewsRepository.ts
│   ├── promoCriteriaStatusRepository.ts
│   ├── promoCesTestsRepository.ts
│   ├── promoCriteriaCommentsRepository.ts
│   ├── promoTrainingCommentsRepository.ts
│   ├── promoTrainingNeedsRepository.ts
│   ├── promoApprovalsRepository.ts
│   ├── promoChecklistProgressRepository.ts
│   └── index.ts
├── services/
│   ├── promoCriteriaMasterService.ts
│   ├── promotionReviewsService.ts
│   └── index.ts
├── controllers/
│   ├── promoCriteriaMasterController.ts
│   ├── promotionReviewsController.ts
│   └── index.ts
├── utils/
│   └── responseAssembler.ts          ← V1-compatible response builder
├── routes.ts
└── index.ts

shared/v2/promotions/
├── schema.ts                          ← Drizzle table definitions (9 tables)
└── types.ts                           ← Insert schemas, select types

client/src/modules/promotions/
├── v2/
│   ├── api/
│   │   └── promotionsApiV2.ts
│   ├── hooks/
│   │   ├── usePromotionsV2.ts
│   │   └── usePromotionsVersion.ts
│   ├── components/
│   │   └── PromotionsVersionToggle.tsx
│   └── PromotionsModule_v2.tsx
├── index.tsx                          ← Version router (V1/V2 toggle)
├── PromotionsModule.tsx               ← V1 (unchanged)
├── PromotionsTable.tsx                ← Shared (unchanged, works with both)
├── PromotionReviewForm.tsx            ← Shared (unchanged)
├── PromotionChecklistForm.tsx         ← Shared (unchanged)
└── ...
```

---

## Key Design Decisions

1. **V1-compatible API responses**: The service layer reassembles normalized data back into JSON strings matching V1 response shape. This means all existing frontend components work without modification.

2. **V1-compatible request body**: The service accepts V1-format request bodies (with JSON string fields) and decomposes them into child table rows. Frontend save/submit logic doesn't need changes.

3. **All table names end with `_v2`**: Including `promo_criteria_master_v2` — consistent naming convention.

4. **No backfill**: V2 starts with empty tables. New promotions created in V2 mode go to V2 tables.

5. **Promotion Hierarchies already in V2**: The admin module already has `adm_promotion_hierarchies_v2` with full CRUD at `/api/v2/admin/promotion-hierarchies`. V2 promotions module references these.

6. **V2 Admin/Crew Pool references**: The V2 PromotionsModule uses V2 endpoints for forms, rank groups, hierarchies, and crew pool instead of V1 endpoints.

7. **JOIN/batch optimization (no N+1)**: All child table reads use `WHERE review_uuid IN (...)` batch pattern. Total queries = 1 (reviews) + 7 (child tables) = 8, regardless of number of reviews returned. All 7 child queries run in parallel via `Promise.all()`.

8. **Criteria Code vs Criteria UUID**: Child tables use `criteria_code` (text like "a2.1") rather than FK to `promo_criteria_master_v2`, because dynamic criteria (a2.6a, a2.6b from rank group config) don't exist in the master table. The master table serves as reference/documentation only.

9. **Audit user flow**: Frontend wraps mutations with `auditUserUuid` from `localStorage.crewUserId` → service extracts via `applyAuditUser()` → sets `created_by_uuid`/`updated_by_uuid` on all tables.

---

## Dependencies & References

- **Promotion Hierarchies**: V2 admin module → `adm_promotion_hierarchies_v2` → `/api/v2/admin/promotion-hierarchies`
- **Forms**: V2 admin module → `adm_forms_v2` → `/api/v2/admin/forms`
- **Rank Groups**: V2 admin module → `adm_rank_groups_v2` → `/api/v2/admin/rank-groups`
- **Available Ranks**: V2 admin module → `adm_available_ranks_v2` → `/api/v2/admin/available-ranks`
- **Company Ranks**: V2 admin module → `adm_company_ranks_v2` → `/api/v2/admin/company-ranks`
- **Crew Members**: V2 crew pool → `/api/v2/crew-pool`
- **Vessel Master**: Master data → `/api/masters/014/data` (shared V1/V2, external API)
- **License Master**: Master data → `/api/masters/016/data` (shared V1/V2, external API)
- **Vessel Types**: Master data → `/api/masters/004/data` (shared V1/V2, external API)
- **Audit User Utility**: Reused from `server/v2/admin/utils/auditUser.ts` (not duplicated)
