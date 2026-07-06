# TypeScript Error Baseline

**Captured:** 2026-07-06
**Total errors:** 228
**Affected files:** 40

The dev workflow (`npm run dev`) runs the server via `tsx` and the client via
Vite — neither type-checks. These 228 errors predate current work and do not
block the running application. They are **not regressions**; they are a
pre-existing condition of this codebase under strict mode.

## Task summary convention

Every task summary **must** report tsc error counts relative to this baseline:

1. Run `./node_modules/.bin/tsc > /tmp/t.txt 2>&1; grep -c "error TS" /tmp/t.txt`
2. Count errors in your changed files: `grep "error TS" /tmp/t.txt | grep "<your file>"`
3. Report: **"Baseline 228 errors across 40 files — this task adds N new errors
   in touched files (target: 0)."**
4. If a formerly-clean file now appears in the error list, or an existing file's
   error count grew, investigate before closing the task.

Do **not** attempt to fix unrelated baseline errors — that is scope creep.

## Baseline file list (file → error count)

| Errors | File |
|-------:|------|
| 55 | `client/src/modules/recruitment/RecruitmentApplicationForm_v2.tsx` |
| 19 | `client/src/modules/crewing/AppraisalForm_v2.tsx` |
| 16 | `client/src/modules/admin/hooks/useAdminV2.ts` |
| 15 | `server/storage.ts` |
| 11 | `server/v2/crew-pool/services/dashboardService.ts` |
| 10 | `client/src/modules/admin/AdminModule.tsx` |
|  9 | `server/v2/rotation/services/dueCrewService.ts` |
|  8 | `server/utils/tenantConnectionManager.ts` |
|  8 | `server/migrate-json-to-postgres.ts` |
|  6 | `server/v2/alerts/services/alertsService.ts` |
|  6 | `server/v2/admin/repositories/accessControlRepository.ts` |
|  6 | `client/src/modules/crew-pool/mappers/v2ToLegacyMapper.ts` |
|  5 | `server/v2/promotions/repositories/approvalsRepository.ts` |
|  4 | `server/v2/vessel/services/vesselPlanningService.ts` |
|  4 | `client/src/modules/vessel/VesselModule_v2.tsx` |
|  4 | `client/src/modules/rest-hours/components/RestHoursRecord.tsx` |
|  4 | `client/src/modules/admin/AccessControlPage.tsx` |
|  3 | `server/v2/promotions/repositories/trainingCommentsRepository.ts` |
|  3 | `server/v2/promotions/repositories/criteriaCommentsRepository.ts` |
|  3 | `server/v2/promotions/repositories/checklistProgressRepository.ts` |
|  3 | `server/v2/promotions/repositories/cesTestsRepository.ts` |
|  3 | `client/src/modules/crew-pool/CrewInfoForm_v2.tsx` |
|  2 | `server/v2/rest-hours/services/dailyRecordsService.ts` |
|  2 | `server/v2/admin/services/companyTrainingsService.ts` |
|  2 | `server/v2/admin/repositories/formVersionsRepository.ts` |
|  2 | `server/v2/admin/repositories/companyTrainingsRepository.ts` |
|  1 | `server/v2/vessel/repositories/vesselPlanningRepository.ts` |
|  1 | `server/v2/vessel/controllers/oilMajorRulesController.ts` |
|  1 | `server/v2/promotions/repositories/trainingNeedsRepository.ts` |
|  1 | `server/v2/crew-pool/services/crewMembersService.ts` |
|  1 | `server/v2/crew-pool/controllers/crewMembersController.ts` |
|  1 | `server/v2/admin/controllers/vesselOrgChartController.ts` |
|  1 | `server/migrations/repair-sea-service-records.ts` |
|  1 | `client/src/modules/recruitment/hooks/useProfile.ts` |
|  1 | `client/src/modules/recruitment/hooks/useCandidates.ts` |
|  1 | `client/src/modules/recruitment/api/mappers.ts` |
|  1 | `client/src/modules/recruitment/api/candidateApi.ts` |
|  1 | `client/src/modules/promotions/PromotionReviewForm.tsx` |
|  1 | `client/src/components/wage/ElementLineRow.tsx` |
|  1 | `client/src/components/AgGridTable.tsx` |
|  1 | `client/src/App.tsx` |

## Quick verification script

```bash
# Run from project root
./node_modules/.bin/tsc > /tmp/t.txt 2>&1
echo "Total errors: $(grep -c 'error TS' /tmp/t.txt)"
echo "Files affected:"
grep "error TS" /tmp/t.txt | sed -E 's/\(.*//' | sort | uniq -c | sort -rn

# Cross-check your changed files vs the error list:
comm -12 \
  <(git --no-optional-locks diff --name-only HEAD | sort -u) \
  <(grep "error TS" /tmp/t.txt | sed -E 's/\(.*//' | sort -u)
# Empty output = no new errors in your changed files (good)
```
