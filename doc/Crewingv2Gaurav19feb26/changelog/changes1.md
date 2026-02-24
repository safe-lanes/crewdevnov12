# Change Log – Rotation Plan Archive & Unarchive

## 1. Frontend Code Changes

- **RotationPlanTable_v2.tsx** — Complete UI overhaul for archive/unarchive support:
  - Added "Show Archived" checkbox (styled with border, matching Approval screen pattern) in the header next to "+ New Plan" button
  - Client-side filtering: active drafts (`planStatus !== 'Archived'`) shown by default; archived drafts shown when checkbox is checked
  - Archive icon (`Archive` from lucide-react) added between Edit and Delete icons in the actions column
  - When viewing archived plans: Edit icon is hidden, `ArchiveRestore` icon replaces Archive icon for unarchive action
  - Confirmation dialogs for both archive ("Archive Rotation Plan? Yes/No") and unarchive ("Unarchive Rotation Plan? Yes/No")
  - Empty state messages differ based on view: "No rotation plans found" vs "No archived rotation plans found"
  - Plan status column shows "Archived" explicitly in archived view

- **rotationApiV2.ts** — Added two new API methods:
  - `archiveDraft(draftUuid: string)` — POST to `/api/v2/rotation/drafts/:draftUuid/archive`
  - `unarchiveDraft(draftUuid: string)` — POST to `/api/v2/rotation/drafts/:draftUuid/unarchive`

- **useRotationV2.ts** — Added two new React Query mutation hooks:
  - `useArchiveDraftV2()` — Calls `archiveDraft`, invalidates `rotation-drafts-v2` cache on success
  - `useUnarchiveDraftV2()` — Calls `unarchiveDraft`, invalidates `rotation-drafts-v2` cache on success

## 2. Backend Code Changes

- **rotationDraftsService.ts** — Added two new service methods:
  - `archiveDraft(draftUuid)` — Validates draft exists and is not already archived, saves current `planStatus` into `previousPlanStatus`, sets `planStatus` to `'Archived'`
  - `unarchiveDraft(draftUuid)` — Validates draft exists and is currently archived, restores `planStatus` from `previousPlanStatus` (falls back to `'In Draft'` if null), clears `previousPlanStatus`

- **rotationController.ts** — Added two new controller handlers:
  - `archive(req, res)` — Extracts `draftUuid` from params, calls `archiveDraft`, returns updated draft
  - `unarchive(req, res)` — Extracts `draftUuid` from params, calls `unarchiveDraft`, returns updated draft

- **routes.ts** (rotation v2) — Added two new POST routes:
  - `POST /api/v2/rotation/drafts/:draftUuid/archive`
  - `POST /api/v2/rotation/drafts/:draftUuid/unarchive`

## 3. Database Level Changes

- **Migration:** `0095_add_previous_plan_status_to_rotation_drafts.sql`
  - Added column `previous_plan_status VARCHAR(50)` (nullable) to `rotation_drafts_v2` table
  - Uses `IF NOT EXISTS` guard for idempotent execution
  - Purpose: Stores the original `plan_status` value before archiving, enabling accurate restoration on unarchive

- **Schema:** `shared/v2/rotation/schema.ts`
  - Added `previousPlanStatus` field to `rotationDraftsV2` Drizzle table definition as `varchar('previous_plan_status', { length: 50 })`

## Additional Notes

- No environment changes required
- No deployment-specific steps needed — migration runs automatically on server startup
- The archive feature is purely additive and does not affect existing rotation plan workflows
- Pre-existing drafts that were never archived will have `previousPlanStatus = null`; unarchiving such drafts (if manually set to Archived) safely defaults to "In Draft"
