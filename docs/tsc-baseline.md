# TypeScript Error Baseline

**Captured:** 2026-07-06 (re-verified 2026-07-07)
**Total errors:** 220
**Affected files:** 40

> Correction (2026-07-07): the original 2026-07-06 header said 40 files, but
> the capture's table listed 41 files summing to 228 — the header was a
> miscount at the time. Superseded by the re-baseline below.

> Re-baseline (2026-07-07): the baseline is now **220 errors across 40
> files**. The original capture listed 8 errors in
> `server/utils/tenantConnectionManager.ts` that are not reproducible
> against any committed tree: type-checking the capture commit itself
> (42b2d035), the pre-Task-#95 tree (fe25c406) and the pre-Task-#100 tree
> (3493afa9) with the current toolchain all yield exactly 220 errors in the
> 40 files below, and `tenantConnectionManager.ts` (unchanged since well
> before the capture) checks clean in every one. No dependency change is
> involved (`package.json`/`package-lock.json` untouched since before the
> capture). Conclusion: those 8 errors were an artifact of transient
> working-tree state at capture time, not of any commit — no task "fixed"
> them. The row has been removed from the table; all other 40 rows were
> verified identical, per-file, against a fresh run.

> Drift correction (2026-07-16): a full run found 231 errors across 43 files —
> 11 drift errors introduced by merged tasks after the capture. All 11 were
> fixed with runtime-neutral type-only changes, restoring the baseline to
> exactly **220 errors across 40 files** (per-file table verified identical):
> - 3 × TS7006 in `server/v2/masters/repositories/trainingStatusRepository.ts`
>   (introduced by Task #702, commit 82189215) — implicit-any callback params
>   on getDb() query results; fixed with explicit parameter annotations.
> - 3 × TS7006 in `server/v2/masters/repositories/trainingCategoryRepository.ts`
>   (Task #710, commit ceed7831) — same pattern, same fix.
> - 1 × TS7006 in `server/v2/training-needs/repository.ts` line 165
>   (Task #723, commit 5e3d3c95) — same pattern, same fix.
> - 4 × TS2322 in `client/src/modules/recruitment/RecruitmentApplicationForm_v2.tsx`
>   (55 → 59): 2 from the `status` field (Task #713, commit 6f66ab78) and 2 from
>   the `source` field (commit 23c9039c, B7 source tracking) — `x || null`
>   assigned to `Partial<ScreeningB7TrainingItem>` fields typed `string |
>   undefined`. Fixed by widening only `status` and `source` to `string | null`
>   in the interface (`useRecruitmentV2.ts`); the 10 identical baseline errors
>   on the adjacent fields were deliberately left untouched (fixing them is
>   baseline scope creep).
> Attribution method: swapped the capture-commit version of the recruitment
> form into the tree (55 errors reproduced), then git blame on each error line;
> ancestry checks confirmed all introducing commits merged after capture
> commit 42b2d035.

The dev workflow (`npm run dev`) runs the server via `tsx` and the client via
Vite — neither type-checks. These 220 errors predate current work and do not
block the running application. They are **not regressions**; they are a
pre-existing condition of this codebase under strict mode.

## Task summary convention

Every task summary **must** report tsc error counts relative to this baseline:

1. Run `./node_modules/.bin/tsc > /tmp/t.txt 2>&1; grep -c "error TS" /tmp/t.txt`
2. Count errors in your changed files: `grep "error TS" /tmp/t.txt | grep "<your file>"`
3. Report: **"Baseline 220 errors across 40 files — this task adds N new errors
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
