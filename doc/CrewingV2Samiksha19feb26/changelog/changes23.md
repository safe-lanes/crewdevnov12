# Change 23: Training Course Admin-Defined Sort Order

## Date: 2026-02-26

## Summary
Enforced Admin Training Matrix ordering throughout the Training Course "Add from Database" flow in both Crew Pool and Recruitment forms. The Admin Training Matrix now serves as the single source of truth for training course ordering.

## Requirements Addressed
1. Training list in the selection dialog displays in the exact Admin-defined sequence
2. Admin sequence changes immediately reflect in both forms (live from API)
3. After selection, courses in the table auto-sort by Admin-defined sequence
4. Each training course is selectable only once — already-added courses are visible but disabled with "(already added)" indication

## Changes

### Backend: API Sort Order (`companyTrainingsRepository.ts`)
- Changed `findAll()` from `ORDER BY created_at DESC` to join with `adm_company_training_groups_v2` and order by `groups.display_order ASC, trainings.sort_order ASC`
- This ensures the API response is pre-sorted in Admin Training Matrix sequence (group order first, then sort order within group)
- Trainings without a group or sort order default to end of list via `COALESCE(..., 999)`

### Dialog: Duplicate Check Fix & Sort Metadata (`TrainingCourseSelectionDialog.tsx`)
- **Fixed broken duplicate detection**: Changed `alreadyAddedIds` check from `template.id` (DB primary key) to `template.companyId` (e.g., `SC001`). Previously, the check compared `SC001` against `"42"` and never matched, so duplicates were not prevented.
- Now correctly dims already-added courses, shows "(already added)" text, and disables their checkboxes
- Added `sortOrder` (positional index from API response order) to the `TrainingCourseTemplate` type and template mapping, so sort metadata is available to forms after selection

### Type Updates (`trainingCourseTemplates.ts`)
- Added `sortOrder?: number` to the `TrainingCourseTemplate` interface

### Crew Pool Form (`CrewInfoForm_v2.tsx`)
- Added `sortOrder?: number` to the `TrainingCourse` interface
- `addTrainingCoursesFromDatabase`: Stores `sortOrder` from template, then sorts the entire training courses array by `sortOrder` ascending (manual entries without `sortOrder` sort to end)
- Added `useQuery` for `/api/v2/admin/company-trainings` at form level
- Hydration: When loading training courses from server, derives `sortOrder` from current admin company trainings data and sorts accordingly

### Recruitment Form (`RecruitmentApplicationForm_v2.tsx`)
- Added `sortOrder?: number` to the training course type definition
- `addTrainingCoursesFromDatabase`: Same sorting logic as Crew Pool — stores `sortOrder`, sorts all courses by admin sequence
- Added `useQuery` for `/api/v2/admin/company-trainings` at form level
- Hydration: Derives `sortOrder` from admin data and sorts training courses by admin sequence instead of by expiry date

## Sorting Rules
| Source | Sort Behavior |
|---|---|
| Added from Database | Sorted by Admin Training Matrix sequence (group display order → sort order within group) |
| Manually added | Appear at end of list (no `sortOrder`) |
| Mixed (DB + manual) | DB entries in admin sequence first, manual entries at end |

## Files Modified
- `server/v2/admin/repositories/companyTrainingsRepository.ts` — API sort order
- `client/src/modules/crew-pool/TrainingCourseSelectionDialog.tsx` — Duplicate check fix, sort metadata
- `client/src/utils/data/trainingCourseTemplates.ts` — Type update
- `client/src/modules/crew-pool/CrewInfoForm_v2.tsx` — Sort on add and hydration
- `client/src/modules/recruitment/RecruitmentApplicationForm_v2.tsx` — Sort on add and hydration
