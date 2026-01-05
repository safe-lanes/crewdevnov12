# API Documentation

## Overview

The Seafarer Performance Management System exposes 253 RESTful API endpoints via Express.js. All endpoints are prefixed with `/api/` and return JSON responses.

## Base URL

- **Development:** `http://localhost:5000`
- **Replit:** `https://{repl-name}.replit.dev`

## Authentication

Currently, no authentication is implemented. All endpoints are publicly accessible.

## Response Format

### Success Response
```json
{
  "id": 1,
  "name": "Example",
  ...
}
```

### Error Response
```json
{
  "error": "Error message",
  "message": "Detailed description (optional)"
}
```

## HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 304 | Not Modified (cached) |
| 400 | Bad Request (validation error) |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## API Endpoints by Category

### Health & System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/db-test` | Database connection test |

---

### Crew Members

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/crew-members` | Get all crew members |
| GET | `/api/crew-members/:id` | Get crew member by ID |
| POST | `/api/crew-members` | Create crew member |
| PUT | `/api/crew-members/:id` | Update crew member |
| DELETE | `/api/crew-members/:id` | Delete crew member |
| GET | `/api/crew-members/:id/dashboard` | Get crew dashboard data |

#### Example: Get All Crew Members
```http
GET /api/crew-members

Response: 200 OK
[
  {
    "id": "A000452",
    "firstName": "John",
    "familyName": "Smith",
    "presentRank": "Master",
    "presentVessel": "7440571a-841a-11ed-aa7c-7003bca91a86",
    "status": "On Board",
    ...
  }
]
```

---

### Forms Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/forms` | Get all forms |
| GET | `/api/forms/:id` | Get form by ID |
| POST | `/api/forms` | Create form |
| PUT | `/api/forms/:id` | Update form |
| DELETE | `/api/forms/:id` | Delete form |
| GET | `/api/forms/for-rank/:rankLabel` | Get form for specific rank |
| POST | `/api/forms/cleanup-duplicates` | Clean up duplicate forms |

---

### Form Versions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/forms/:formId/versions` | Get versions for form |
| GET | `/api/form-versions/:id` | Get specific version |
| POST | `/api/forms/:formId/versions` | Create new version |
| PUT | `/api/form-versions/:id` | Update version |
| POST | `/api/form-versions/:id/release` | Release version |
| DELETE | `/api/form-versions/:id` | Delete version |

---

### Rank Groups

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rank-groups` | Get all rank groups |
| GET | `/api/rank-groups/form/:formId` | Get rank groups for form |
| GET | `/api/rank-groups/check-assignment` | Check rank assignments |
| GET | `/api/rank-groups/:id` | Get rank group by ID |
| POST | `/api/rank-groups` | Create rank group |
| PUT | `/api/rank-groups/:id` | Update rank group |
| PUT | `/api/rank-groups/:id/configuration` | Update configuration |
| POST | `/api/rank-groups/:id/archive` | Archive rank group |
| POST | `/api/rank-groups/:id/unarchive` | Unarchive rank group |
| DELETE | `/api/rank-groups/:id` | Delete rank group |

---

### Available Ranks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/available-ranks` | Get all ranks |
| POST | `/api/available-ranks` | Create rank |
| PUT | `/api/available-ranks/:id` | Update rank |
| DELETE | `/api/available-ranks/:id` | Delete rank |
| DELETE | `/api/available-ranks` | Delete all ranks |
| POST | `/api/available-ranks/reorder` | Reorder ranks |

---

### Company Ranks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/company-ranks` | Get all company ranks |
| POST | `/api/company-ranks` | Create company rank |
| GET | `/api/company-ranks/by-name/:rankName` | Get by rank name |

---

### Appraisals

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/appraisals` | Get all appraisals |
| GET | `/api/appraisals/:id` | Get appraisal by ID |
| GET | `/api/appraisals/crew/:crewId` | Get appraisals for crew member |
| POST | `/api/appraisals` | Create appraisal |
| PUT | `/api/appraisals/:id` | Update appraisal |
| DELETE | `/api/appraisals/:id` | Delete appraisal |
| POST | `/api/appraisals/:id/submit-stage1` | Submit stage 1 |
| POST | `/api/appraisals/:id/submit-stage2` | Submit stage 2 |
| POST | `/api/appraisals/:id/submit-stage3` | Submit stage 3 |

---

### Promotions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/promotions` | Get all promotions |
| GET | `/api/promotions/:id` | Get promotion by ID |
| GET | `/api/promotions/crew/:crewMemberId` | Get promotions for crew |
| POST | `/api/promotions` | Create promotion |
| PATCH | `/api/promotions/:id` | Update promotion |
| DELETE | `/api/promotions/:id` | Delete promotion |
| POST | `/api/promotions/:id/approve` | Approve promotion |
| POST | `/api/promotions/:id/reject` | Reject promotion |

---

### Promotion Reviews

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/promotion-reviews` | Get all reviews |
| GET | `/api/promotion-reviews/:id` | Get review by ID |
| GET | `/api/promotion-reviews/crew/:crewMemberId` | Get reviews for crew |
| GET | `/api/promotion-reviews/crew/:crewMemberId/rank/:promotionToRank` | Get specific review |
| POST | `/api/promotion-reviews` | Create review |
| PATCH | `/api/promotion-reviews/:id` | Update review |

---

### Promotion Hierarchies

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/promotion-hierarchies` | Get all hierarchies |
| GET | `/api/promotion-hierarchies/:id` | Get hierarchy by ID |
| POST | `/api/promotion-hierarchies` | Create hierarchy |
| PATCH | `/api/promotion-hierarchies/:id` | Update hierarchy |
| DELETE | `/api/promotion-hierarchies/:id` | Delete hierarchy |

---

### Vessel Planning

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vessel-planning` | Get all planning records |
| GET | `/api/vessel-planning/:id` | Get planning by ID |
| GET | `/api/vessel-planning/vessel/:vesselId` | Get planning for vessel |
| POST | `/api/vessel-planning` | Create planning record |
| PATCH | `/api/vessel-planning/:id` | Update planning |
| DELETE | `/api/vessel-planning/:id` | Delete planning |
| GET | `/api/vessel-planning/:id/handover-attachments` | Get attachments |
| POST | `/api/vessel-planning/:id/handover-attachments` | Upload attachment |
| DELETE | `/api/vessel-planning/:id/handover-attachments/:attachmentId` | Delete attachment |

---

### Rotation Plans

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rotation-plans` | Get all plans |
| GET | `/api/rotation-plans/:id` | Get plan by ID |
| POST | `/api/rotation-plans` | Create plan |
| PATCH | `/api/rotation-plans/:id` | Update plan |
| DELETE | `/api/rotation-plans/:id` | Delete plan |
| POST | `/api/rotation-plans/:id/propose` | Propose for approval |
| GET | `/api/rotation/proposals` | Get pending proposals |
| POST | `/api/rotation/proposals/deploy` | Deploy proposal |
| POST | `/api/rotation/proposals/reject` | Reject proposal |
| GET | `/api/rotation/proposals/conflicts` | Check conflicts |
| GET | `/api/rotation/due-crew` | Get crew due for rotation |

---

### Drug & Alcohol Tests

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/drug-alcohol-tests` | Get all tests |
| GET | `/api/drug-alcohol-tests/:id` | Get test by ID |
| GET | `/api/drug-alcohol-tests/vessel/:vesselId` | Get tests for vessel |
| POST | `/api/drug-alcohol-tests` | Create test record |
| PUT | `/api/drug-alcohol-tests/:id` | Update test |
| DELETE | `/api/drug-alcohol-tests/:id` | Delete test |

---

### Rest Hours - Vessel Records

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rest-hours-vessel-records` | Get all vessel records |
| GET | `/api/rest-hours-vessel-records/:id` | Get record by ID |
| POST | `/api/rest-hours-vessel-records` | Create vessel record |
| PUT | `/api/rest-hours-vessel-records/:id` | Update vessel record |
| DELETE | `/api/rest-hours-vessel-records/:id` | Delete vessel record |
| POST | `/api/rest-hours-vessel-records/submit-review` | Submit vessel review |
| POST | `/api/rest-hours-vessel-records/submit-office-review` | Submit office review |
| GET | `/api/rest-hours-violations-by-rank` | Get violations by rank |
| GET | `/api/rest-hours-ncs-by-rank` | Get NCs by rank |

---

### Rest Hours - Crew Records

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rest-hours-crew-records` | Get all crew records |
| GET | `/api/rest-hours-crew-records/:id` | Get record by ID |
| POST | `/api/rest-hours-crew-records` | Create crew record |
| PUT | `/api/rest-hours-crew-records/:id` | Update crew record |
| DELETE | `/api/rest-hours-crew-records/:id` | Delete crew record |

---

### Rest Hours - Daily Records

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rest-hours-daily-records` | Get all daily records |
| GET | `/api/rest-hours-daily-records/by-key/:crewMemberId/:vesselId/:monthYear` | Get by composite key |
| GET | `/api/rest-hours-daily-records/:id` | Get record by ID |
| POST | `/api/rest-hours-daily-records` | Create/upsert daily record |
| PUT | `/api/rest-hours-daily-records/:id` | Update daily record |
| DELETE | `/api/rest-hours-daily-records/:id` | Delete daily record |
| POST | `/api/rest-hours-daily-records/backfill-violations` | Backfill violation calculations |

---

### Rest Hours - Comments & NC Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vessel-violation-comments` | Get vessel comments |
| POST | `/api/vessel-violation-comments` | Create/update vessel comments |
| GET | `/api/office-violation-comments` | Get office comments |
| POST | `/api/office-violation-comments` | Create/update office comments |
| GET | `/api/nc-reports/all` | Get all NC reports |
| GET | `/api/nc-reports` | Get NC reports with filters |
| POST | `/api/nc-reports` | Create NC report |
| PUT | `/api/nc-reports/:id` | Update NC report |
| DELETE | `/api/nc-reports/:id` | Delete NC report |

---

### Rest Hours - Date Line Adjustments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vessel-dateline-adjustments/:vesselId/:monthValue` | Get adjustments |
| PUT | `/api/vessel-dateline-adjustments/:vesselId/:monthValue` | Update adjustments |
| DELETE | `/api/vessel-dateline-adjustments/:vesselId/:monthValue` | Delete adjustments |

---

### Rest Hours - Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/fixed-tasks` | Get all fixed tasks |
| POST | `/api/fixed-tasks` | Create fixed task |
| PUT | `/api/fixed-tasks/:id` | Update fixed task |
| DELETE | `/api/fixed-tasks/:id` | Delete fixed task |
| GET | `/api/variable-tasks` | Get all variable tasks |
| POST | `/api/variable-tasks` | Create variable task |
| PUT | `/api/variable-tasks/:id` | Update variable task |
| DELETE | `/api/variable-tasks/:id` | Delete variable task |

---

### Recruitment

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/recruitment` | Get all candidates |
| GET | `/api/recruitment/:id` | Get candidate by ID |
| POST | `/api/recruitment` | Create candidate |
| PUT | `/api/recruitment/:id` | Update candidate |
| DELETE | `/api/recruitment/:id` | Soft delete candidate |

---

### Master Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/masters` | Get all masters |
| GET | `/api/masters/:masterId` | Get master by ID |
| POST | `/api/masters` | Create master |
| PUT | `/api/masters/:masterId` | Update master |
| DELETE | `/api/masters/:masterId` | Delete master |
| GET | `/api/masters/:masterId/data` | Get master data entries |
| POST | `/api/masters/:masterId/data` | Create master data entry |
| PUT | `/api/masters/:masterId/data/:entryId` | Update entry |
| DELETE | `/api/masters/:masterId/data/:entryId` | Delete entry |

---

### Training

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/training-master` | Get all training masters |
| POST | `/api/training-master` | Create training master |
| PUT | `/api/training-master/:id` | Update training master |
| DELETE | `/api/training-master/:id` | Delete training master |
| GET | `/api/company-trainings` | Get company trainings |
| POST | `/api/company-trainings` | Create company training |
| PUT | `/api/company-trainings/:id` | Update company training |
| DELETE | `/api/company-trainings/:id` | Delete company training |
| GET | `/api/company-training-groups` | Get training groups |
| PUT | `/api/company-training-groups/:code` | Update training group |
| GET | `/api/company-training-requirements` | Get requirements |
| POST | `/api/company-training-requirements/batch` | Batch update requirements |

---

### Vessel Configuration

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vessel-drafts` | Get all vessel drafts |
| GET | `/api/vessel-drafts/:vesselId` | Get draft for vessel |
| POST | `/api/vessel-drafts` | Create vessel draft |
| PUT | `/api/vessel-drafts/:id` | Update vessel draft |
| DELETE | `/api/vessel-drafts/:id` | Delete vessel draft |
| GET | `/api/vessel-revisions` | Get all revisions |
| GET | `/api/vessel-revisions/:vesselId` | Get revisions for vessel |
| POST | `/api/vessel-revisions` | Create vessel revision |

---

### Oil Major Compliance

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/oil-major-rules` | Get all rules |
| GET | `/api/oil-major-rules/:oilMajorName` | Get rules by oil major |
| POST | `/api/oil-major-rules` | Create rules |
| PUT | `/api/oil-major-rules/:oilMajorName` | Update rules |
| DELETE | `/api/oil-major-rules/:oilMajorName` | Delete rules |
| POST | `/api/oil-major-rules/import-csv` | Import from CSV |
| POST | `/api/oil-major-rules/validate` | Validate crew against rules |

---

## Query Parameters

### Filtering

Many GET endpoints support query parameters for filtering:

```http
GET /api/rest-hours-crew-records?vesselId=7440571a-841a-11ed-aa7c-7003bca91a86&monthValue=2025-01

GET /api/crew-members?status=On Board&presentRank=Master
```

### Pagination

Currently, no built-in pagination. All records are returned.

---

## Request Validation

Request bodies are validated using Zod schemas derived from Drizzle table definitions:

```typescript
// Schema from shared/schema.ts
export const insertCrewMemberSchema = createInsertSchema(crewMembers).pick({
  firstName: true,
  nationality: true,
  // ... other fields
});

// Validation in routes.ts
app.post("/api/crew-members", async (req, res) => {
  const result = insertCrewMemberSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.message });
  }
  // ... proceed with creation
});
```
