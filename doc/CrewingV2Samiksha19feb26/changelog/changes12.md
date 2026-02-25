# Changes 12 — E1 Auto-Entry from Vessel Tab Sign-On / Sign-Off Sync

## Summary
Automatically creates an E1 (Company Sea Service) record when a crew member is signed on from the Vessel tab, and updates the To Date when they are signed off. Auto-generated rows are visually distinguished and partially read-only in the Crew Pool crew form.

---

## Backend Changes

### `server/v2/vessel/services/vesselPlanningService.ts`

#### New imports
- Added `masterVessels` from `shared/schema` (was already a dynamic import, now static)
- Added `isNull` from `drizzle-orm`
- Added `resolveVesselTypeUuid` from `../../crew-pool/services/masterDataResolver`

#### `signOnReliever` — E1 auto-create on sign-on (T001)
After the main planning transaction completes, a try/catch block:
1. Looks up `master_vessels` by `vesselUuid` to get vessel name and vessel type name
2. Resolves vessel type name → `vesselTypeUuid` via `resolveVesselTypeUuid()`
3. **Duplicate check**: skips if a `crew_sea_service` record already exists for same `crewUuid + vesselUuid + fromDate + serviceType='company'`
4. **Overlap check**: skips if crew already has an open (null `toDate`) company sea service record
5. Inserts new `crew_sea_service` record: `{ serviceType: 'company', vesselUuid, vesselName, vesselTypeUuid, rank, fromDate: signOnDate, toDate: null }`
- On any error: logs warning (`console.warn`) and continues — sign-on workflow is never broken

#### `signOffCrew` — E1 toDate update on sign-off (T002)
After the main planning transaction completes, a try/catch block:
1. Finds the open (null `toDate`) company sea service record for the crew + vessel
2. Updates `toDate = data.signOffDate`
- On any error: logs warning and continues — sign-off workflow is never broken

---

## Frontend Changes

### `client/src/modules/crew-pool/CrewInfoForm_v2.tsx`

#### New query (T003)
Added `useQuery` for `GET /api/v2/crew-pool/crew/:crewUuid/assignments` (enabled when `crewUuid` is set and form is open).

#### New effect — isVesselSynced detection (T003)
After assignments data loads, a `useEffect` builds a Set of `"vesselUuid|signOnDate"` keys from all on-board assignments. For each DB-backed E1 row (has `seaUuid`), checks if the key matches → sets `isVesselSynced: true` on the row in `formData.currentCompanySeaService`. Manual rows (no `seaUuid`) are never marked synced.

#### E1 row rendering — partial read-only for synced rows (T004)
In `renderE1CurrentCompanySeaService`, each row now checks `isVesselSynced`:
- **Vessel Name** (synced): read-only text + small ship icon with "Auto-synced from Vessel tab" tooltip; row has a subtle blue-tinted background (`bg-blue-50/30`)
- **Vessel Type** (synced): read-only text
- **Rank** (synced): read-only text
- **From Date** (synced): read-only text
- **To Date** (synced): if active contract → existing blue "today" display; if completed → read-only text
- **Deadweight, Engine Type/Power, Owner/Operator**: always remain editable inputs (unchanged)
- Non-synced and manual rows: fully editable (unchanged behavior)

#### Save payload protection (T005)
In `handleSaveDraft` Batch 3 (E1 rows):
- For synced rows (`isVesselSynced && seaUuid`), the `seaData` object is flagged with `_skipLockedFields: true`

In `client/src/modules/crew-pool/hooks/useCrewPoolV2.ts` — `useSaveSeaServiceV2`:
- Before calling `withAuditUser()`, checks `(data as any)._skipLockedFields`
- If set, deletes `vesselName`, `vesselUuid`, `vesselTypeUuid`, `rank`, `fromDate`, `toDate` from the V2 payload before the API call
- Only `deadweight`, `engineTypePower`, `ownerOperator`, `periodMonths`, `experienceCategories` are sent to the server for synced rows

---

## Behavior Rules
- One E1 row per sign-on event; no duplicates and no overlapping open periods
- While on board: To Date displays current date (blue, read-only) — existing logic unchanged
- On sign-off: To Date updates to sign-off date automatically
- Auto-generated rows: Vessel, Type, Rank, From, To are read-only; DWT/Engine/Owner remain editable
- Manually added rows: fully editable as before
- All backend sync operations are non-breaking (errors are swallowed with warnings)
