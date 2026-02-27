# Change Log – Manual Entry ID Fix, Sign-On Conflict Update & Rotation Plan Crew Color-Coding Enhancement

## 1. Frontend Code Changes

- **NewPlanDialog_v2.tsx** — Enhanced crew color-coding logic in rotation plan dialog:
  - `getCrewNameColor()` — Updated priority order for crew name colors:
    - **Red (highest priority):** Crew is actively on another vessel — detected via two conditions:
      - Reliever in transit: `relieverCrewId` matches + `joiningStatus === 'In Transit'`
      - Signed on: `crewMemberId` matches + `signOnDate` is set + `joiningStatus` is `null` (after sign-on, backend clears `joiningStatus` and moves crew from `relieverCrewUuid` to `crewUuid`)
    - **Purple (second priority):** Crew is a deployed reliever with `joiningStatus` of "Planned" or "Confirmed" (unchanged)
    - **Red (third priority):** Overlapping deployment date range on another vessel (unchanged)
    - Brown/Blue priorities unchanged
  - `getCrewVesselInfo()` — Updated tooltip to show specific status:
    - "Deployed: VesselName (Signed On)" for crew who completed sign-on
    - "Deployed: VesselName (In Transit)" for crew still traveling
    - "Deployed (Awaiting Sign On): VesselName" for Planned/Confirmed (unchanged)

- **CrewInfoForm_v2.tsx** — No changes needed (verified):
  - `{license.licenseId || '-'}` already displays "-" for empty/null license IDs
  - `{course.courseId || '-'}` already displays "-" for empty/null course IDs
  - `fromDatabase` flag logic correctly evaluates to `false` for empty IDs, keeping manual entries editable

## 2. Backend Code Changes

- **crewCertificatesService.ts** — Stopped auto-generating IDs for manual "+ADD" entries:
  - `createLicense()` — Changed from calling `generateLicenseId()` when `licenseId` is empty to setting `licenseId = data.licenseId || null`. Manual entries now save with null ID
  - `createTraining()` — Changed from calling `generateCourseId()` when `courseId` is empty to setting `courseId = data.courseId || null`. Manual entries now save with null ID
  - `generateLicenseId()` and `generateCourseId()` functions retained — still used by `crewTransferService.ts` for candidate transfers from recruitment

- **crewAvailabilityService.ts** — Fixed duplicate crew members in rotation plan dialog:
  - `getCrewByRank()` — Changed `.select()` to `.selectDistinctOn([crewMembersV2.crewUuid], ...)` to deduplicate when LEFT JOIN on `crewAssignments` produces multiple rows per crew member (multiple `is_current = true` assignments)
  - `searchCrewByRank()` — Same `.selectDistinctOn()` fix applied

- **vesselPlanningService.ts** — Relaxed sign-on conflict detection:
  - `checkSignOnConflict()` — Commented out `if (p.crewStatus === "primary") return true` condition. Being marked as "primary" on another vessel's plan no longer triggers a conflict. Conflicts still trigger for "In Transit" and "Signed On" `joiningStatus` values and for active current assignments on other vessels

## 3. Database Level Changes

- No schema changes
- No migrations required
- No new tables or columns

## Additional Notes

- No environment changes required
- No deployment-specific steps needed
- The `generateLicenseId()` / `generateCourseId()` functions are intentionally preserved for the crew transfer workflow (`crewTransferService.ts`) which auto-assigns IDs when transferring candidates from recruitment to the crew pool
- The sign-on conflict relaxation (commenting out `crewStatus === 'primary'` check) means crew marked as primary on another vessel can now be signed on to a new vessel without a conflict warning — only active assignments and in-transit/signed-on joining statuses still block
- The crew color-coding fix accounts for the backend sign-on behavior where `joiningStatus` is cleared to `null` (not set to "Signed On") and `relieverCrewUuid` is cleared when a reliever signs on and becomes primary/secondary crew
