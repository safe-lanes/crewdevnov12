# Client Raw Fetch Authentication Audit

## Scope and stop point

This is the report-only approval gate for Task #301. No application source, server behavior, authentication logic, or request behavior was changed. Conversion must wait for explicit confirmation.

## Executive findings

- **274 executable direct `fetch()` calls across 76 frontend files.**
- The reproducible text search returns **277** matches; three are comment-only references and are excluded from the executable inventory.
- **260** calls target tenant-scoped application APIs; the remaining 14 calls are shared/helper implementations, external URLs, or a configured micro-frontend URL.
- At the individual call site, none of the 260 tenant-scoped raw calls manually constructs both `Authorization` and `x-tenant-id`. The two calls inside `queryClient.ts` conditionally construct and pass each header through their local `headers` maps when the corresponding token or tenant value is available, because they are the shared client implementation itself.
- However, `main.tsx` imports `tenantFetch.ts` before rendering. That module patches `window.fetch`; for every runtime URL beginning with `/api`, it conditionally adds `x-tenant-id` and `Authorization`. Therefore relative raw `/api` calls are **effectively routed through the global patch today**, even though they do not use the explicit shared-client API and violate the project convention.
- The restart-time `no_authenticated_user` responses prove the server received requests without a resolved user. They do **not** prove raw `fetch()` bypassed authentication: the global patch adds no bearer header when `getAuthToken()` returns no token, and the explicit shared client uses the same token source.
- Converting calls to the explicit shared client will centralize status/error/credentials behavior and satisfy the documented convention. By itself, it is not sufficient evidence that the restart identity-readiness issue is fixed; that must be retested independently after conversion.

## Reproducible inventory commands

```bash
# Textual candidates (includes comments)
rg -n --glob '*.{ts,tsx,js,jsx}' '\bfetch\s*\(' client/src

# Candidate totals
rg -n --glob '*.{ts,tsx,js,jsx}' '\bfetch\s*\(' client/src | wc -l  # 277
rg -l --glob '*.{ts,tsx,js,jsx}' '\bfetch\s*\(' client/src | wc -l  # 76
```

The executable count was verified with the TypeScript parser by counting `CallExpression` nodes whose callee is the identifier `fetch`: **274**. The three textual-only matches are comments in `FileAttachmentDialog.tsx`, `VesselZipUploadDialog.tsx`, and `ViolationsDetailDialog.tsx`.

## Classification totals

| Classification | Calls |
|---|---:|
| Tenant-scoped app API | 260 |
| External URL | 9 |
| Shared authenticated client implementation | 2 |
| Infrastructure helper | 1 |
| Micro-frontend configured API URL | 1 |
| Generic HTTP helper | 1 |

## Critical flow findings

### Permissions provider

- `PermissionsContext.tsx` contains **no direct raw fetch call**.
- It calls `adminApiV2.getMyPermissions()`, whose direct fetch is `adminApiV2.ts:543` to `${V2_BASE}/access-control/my-permissions`. No headers are manually supplied there; the relative `/api` URL is intercepted by the global `tenantFetch` patch.
- The 403 therefore means no token/user was available to the effective request at that moment, not that this particular call necessarily bypassed the installed patch.

### Admin module and hooks

- `adminApiV2.ts`: **43** direct calls.
- `AdminModule.tsx`: **14** direct calls.
- All files under `client/src/modules/admin/`: **58** direct calls total, including the ZIP-download call.
- Additional Admin/master hooks also contain direct calls and are listed in the full matrix below.

### Generic Form Editor

- `GenericFormEditor.tsx` contains **7** direct calls: form parts, rank groups, versions, roles, departments, vessel types, and per-part structure loading.
- They supply no auth or tenant headers manually. Their relative `/api` URLs receive conditional headers from the global patch.

### Three live submission hosts

- Briefing, Debriefing, and Interview each contain **one** direct GET used by their local `getJson` loader.
- None manually supplies auth or tenant headers. All three URLs begin with `/api`, so the global patch applies.
- Their write operations (create/update/save/submit/signature actions) already use `apiRequest`; only the initial submission GET remains direct in each host.

### Shared and exceptional fetches

- `queryClient.ts` has two direct fetch calls and is the explicit shared authenticated client. Both conditionally pass locally constructed Authorization and tenant headers when those values are available, and then also pass through the global patch for relative `/api` URLs.
- `utils/http.ts` is a generic helper: it adds JSON content type but relies on the global patch only when the caller URL begins with `/api`.
- `MicroFrontendWrapper.tsx` installs a separate interceptor that adds Authorization but not `x-tenant-id`; its configured URL may be absolute, in which case `tenantFetch` does not apply.
- Blob downloads and multipart uploads under `/api/v2` remain tenant-scoped and authenticated; their response/body handling must be preserved during conversion. Truly external URLs remain separate and should not be blindly converted.

## File totals

| File | Calls |
|---|---:|
| `client/src/components/FileAttachmentDialog.tsx` | 1 |
| `client/src/components/GenericFormEditor.tsx` | 7 |
| `client/src/components/HandoverAttachmentsDialog.tsx` | 2 |
| `client/src/components/ui/SearchablePortCombobox.tsx` | 2 |
| `client/src/hooks/useCompanyRanks.ts` | 4 |
| `client/src/hooks/useDataMasters.ts` | 4 |
| `client/src/hooks/useExternalAdditionalGroups.tsx` | 1 |
| `client/src/hooks/useExternalCountries.tsx` | 1 |
| `client/src/hooks/useExternalFleetGroups.tsx` | 2 |
| `client/src/hooks/useExternalLanguages.tsx` | 1 |
| `client/src/hooks/useExternalNationalities.tsx` | 1 |
| `client/src/hooks/useExternalPorts.tsx` | 1 |
| `client/src/hooks/useExternalUsers.tsx` | 1 |
| `client/src/hooks/useExternalVesselTypes.tsx` | 1 |
| `client/src/hooks/useExternalVessels.tsx` | 1 |
| `client/src/hooks/useLocalMasterApi.tsx` | 2 |
| `client/src/hooks/usePayrollData.ts` | 5 |
| `client/src/hooks/useRankOrdering.ts` | 1 |
| `client/src/hooks/useTenantInit.ts` | 1 |
| `client/src/hooks/useTrainingMaster.ts` | 3 |
| `client/src/lib/queryClient.ts` | 2 |
| `client/src/micro-frontend/MicroFrontendWrapper.tsx` | 1 |
| `client/src/modules/admin/AdminModule.tsx` | 14 |
| `client/src/modules/admin/api/adminApiV2.ts` | 43 |
| `client/src/modules/admin/components/VesselZipUploadDialog.tsx` | 1 |
| `client/src/modules/crew-pool/CrewImportDialog.tsx` | 1 |
| `client/src/modules/crew-pool/CrewInfoForm_v2.tsx` | 6 |
| `client/src/modules/crew-pool/LicenseSelectionDialog.tsx` | 1 |
| `client/src/modules/crew-pool/TravelDocumentSelectionDialog.tsx` | 1 |
| `client/src/modules/crew-pool/VesselAssignmentImportDialog.tsx` | 3 |
| `client/src/modules/crew-pool/VisaSelectionDialog.tsx` | 1 |
| `client/src/modules/crew-pool/api/crewPoolApiV2.ts` | 24 |
| `client/src/modules/crew-pool/components/BriefingLiveSubmissionHost.tsx` | 1 |
| `client/src/modules/crew-pool/components/DebriefingLiveSubmissionHost.tsx` | 1 |
| `client/src/modules/crewing/AppraisalForm_v2.tsx` | 1 |
| `client/src/modules/crewing/ElementCrewAppraisals_v2.tsx` | 1 |
| `client/src/modules/crewing/api/appraisalsApiV2.ts` | 4 |
| `client/src/modules/dashboard/CrewAppraisalsDrilldownDialog.tsx` | 1 |
| `client/src/modules/dashboard/CrewAppraisalsRankChart.tsx` | 1 |
| `client/src/modules/dashboard/CrewPoolDrilldownDialog.tsx` | 2 |
| `client/src/modules/dashboard/CrewPoolRankChart.tsx` | 2 |
| `client/src/modules/dashboard/CrewRetentionDrilldownDialog.tsx` | 1 |
| `client/src/modules/dashboard/CrewRetentionMetrics.tsx` | 1 |
| `client/src/modules/dashboard/DAAnalysisMetrics.tsx` | 1 |
| `client/src/modules/dashboard/DAViolationsDrilldownDialog.tsx` | 1 |
| `client/src/modules/drugs-alcohol/AnnualTestTable_v2.tsx` | 1 |
| `client/src/modules/drugs-alcohol/HistoryTable_v2.tsx` | 1 |
| `client/src/modules/drugs-alcohol/MonthlyTestTable_v2.tsx` | 1 |
| `client/src/modules/drugs-alcohol/OtherTestsTable_v2.tsx` | 1 |
| `client/src/modules/drugs-alcohol/PeriodicTestTable_v2.tsx` | 1 |
| `client/src/modules/drugs-alcohol/PostIncidentTestTable_v2.tsx` | 1 |
| `client/src/modules/drugs-alcohol/SummaryTable_v2.tsx` | 1 |
| `client/src/modules/drugs-alcohol/api/drugsAlcoholApiV2.ts` | 5 |
| `client/src/modules/promotions/PromotionReviewForm.tsx` | 1 |
| `client/src/modules/recruitment/ComplianceScreening.tsx` | 3 |
| `client/src/modules/recruitment/RecruitmentApplicationForm_v2.tsx` | 5 |
| `client/src/modules/recruitment/VesselSearchDialog.tsx` | 1 |
| `client/src/modules/recruitment/api/candidateApi.ts` | 22 |
| `client/src/modules/recruitment/components/InterviewLiveSubmissionHost.tsx` | 1 |
| `client/src/modules/recruitment/hooks/useRecruitmentV2.ts` | 5 |
| `client/src/modules/rest-hours/api/restHoursApiV2.ts` | 30 |
| `client/src/modules/rest-hours/components/RHCrewRecordsTable.tsx` | 1 |
| `client/src/modules/rest-hours/components/RHRecordingForm.tsx` | 1 |
| `client/src/modules/rest-hours/components/RestHoursVesselOverview.tsx` | 1 |
| `client/src/modules/rest-hours/components/ViolationsDetailDialog.tsx` | 1 |
| `client/src/modules/rotation/ApprovalTable_v2.tsx` | 1 |
| `client/src/modules/rotation/DueCrewTable_v2.tsx` | 1 |
| `client/src/modules/rotation/NewPlanDialog_v2.tsx` | 4 |
| `client/src/modules/rotation/api/rotationApiV2.ts` | 6 |
| `client/src/modules/training-retention/components/Retention.tsx` | 1 |
| `client/src/modules/vessel/VesselModule_v2.tsx` | 9 |
| `client/src/modules/vessel/api/vesselApiV2.ts` | 6 |
| `client/src/modules/vessel/components/OnBoardStatusEditDialog_v2.tsx` | 1 |
| `client/src/modules/vessel/components/ReliefStatusEditDialog_v2.tsx` | 1 |
| `client/src/utils/formCommands.ts` | 1 |
| `client/src/utils/http.ts` | 1 |

## Complete call-by-call matrix

**Manual Auth/Tenant** describes headers supplied at that direct call site. **Effective path** describes the current runtime interception behavior. Dynamic endpoint expressions are shown exactly as written so they are not falsely reduced to a guessed URL.

### `client/src/components/FileAttachmentDialog.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 211 | `url` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/components/GenericFormEditor.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 604 | `\`/api/v2/admin/forms/${realFormId}/parts\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 623 | `\`/api/v2/admin/rank-groups/form/${realFormId}?includeArchived=true\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 639 | `\`/api/v2/admin/forms/${realFormId}/versions${query}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 649 | `"/api/v2/admin/access-control/roles?includeInactive=true"` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 658 | `"/api/v2/masters/departments"` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 666 | `"/api/v2/masters/vessel-types"` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 746 | `\`/api/v2/admin/form-versions/${selectedVersion.fvUuid}/parts/${part.formPartUuid}/structure\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/components/HandoverAttachmentsDialog.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 71 | `getEndpointBase()` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 207 | `attachment.viewUrl` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/components/ui/SearchablePortCombobox.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 80 | `\`/api/v2/ports/search?q=${encodeURIComponent(debouncedSearch)}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 92 | `\`/api/v2/ports/${value}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/hooks/useCompanyRanks.ts`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 65 | `"/api/v2/admin/available-ranks"` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 95 | `"/api/v2/admin/available-ranks?companyOnly=true"` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 130 | `"/api/v2/admin/company-ranks"` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 275 | `\`/api/v2/admin/vessel-drafts/by-vessel/${vesselId}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/hooks/useDataMasters.ts`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 11 | `\`${V2_BASE}/data\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 26 | `\`${V2_BASE}/data/${id}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 81 | `\`${V2_BASE}/data/${masterId}/entries\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 95 | `\`${V2_BASE}/data-entries/${id}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/hooks/useExternalAdditionalGroups.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 14 | `\`${API_BASE_URL}/crewmasterdata/getallmasterdata/additionalgroups?domain=${domain}\`` | GET | External URL | No | No | No global tenant headers unless runtime URL begins /api |

### `client/src/hooks/useExternalCountries.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 14 | `\`${API_BASE_URL}/crewmasterdata/getallmasterdata/countries?domain=${domain}\`` | GET | External URL | No | No | No global tenant headers unless runtime URL begins /api |

### `client/src/hooks/useExternalFleetGroups.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 15 | `'/api/v2/recruitment/fleet-groups'` | GET | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 32 | `\`${API_BASE_URL}/crewmasterdata/getallmasterdata/fleetgroups?domain=${domain}\`` | GET | External URL | No | No | No global tenant headers unless runtime URL begins /api |

### `client/src/hooks/useExternalLanguages.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 14 | `\`${API_BASE_URL}/crewmasterdata/getallmasterdata/languages?domain=${domain}\`` | GET | External URL | No | No | No global tenant headers unless runtime URL begins /api |

### `client/src/hooks/useExternalNationalities.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 14 | `\`${API_BASE_URL}/crewmasterdata/getallmasterdata/nationalities?domain=${domain}\`` | GET | External URL | No | No | No global tenant headers unless runtime URL begins /api |

### `client/src/hooks/useExternalPorts.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 14 | `\`${API_BASE_URL}/crewmasterdata/getallmasterdata/ports?domain=${domain}\`` | GET | External URL | No | No | No global tenant headers unless runtime URL begins /api |

### `client/src/hooks/useExternalUsers.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 24 | `\`${API_BASE_URL}/crewmasterdata/getallmasterdata/users?domain=${domain}\`` | GET | External URL | No | No | No global tenant headers unless runtime URL begins /api |

### `client/src/hooks/useExternalVesselTypes.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 15 | `\`${API_BASE_URL}/crewmasterdata/getallmasterdata/vesseltypes?domain=${domain}\`` | GET | External URL | No | No | No global tenant headers unless runtime URL begins /api |

### `client/src/hooks/useExternalVessels.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 14 | `\`${API_BASE_URL}/crewmasterdata/getallmasterdata/vessels?domain=${domain}\`` | GET | External URL | No | No | No global tenant headers unless runtime URL begins /api |

### `client/src/hooks/useLocalMasterApi.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 38 | `\`${V2_BASE}/external/${type}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 54 | `\`${V2_BASE}/external/sync-all\`` | POST | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/hooks/usePayrollData.ts`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 60 | `\`/api/v2/accounts/contract-data/${crewMemberId}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 67 | `\`/api/v2/crew-pool/crew\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 185 | `\`/api/v2/accounts/allotments/crew/${crewMemberId}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 197 | `\`/api/v2/accounts/advances/crew/${crewMemberId}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 209 | `\`/api/v2/accounts/bond-items/crew/${crewMemberId}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/hooks/useRankOrdering.ts`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 27 | `\`/api/v2/admin/vessel-revisions/ranks/${vesselId}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/hooks/useTenantInit.ts`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 82 | `"/api/v2/tenant/init"` | POST | Infrastructure helper | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/hooks/useTrainingMaster.ts`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 9 | `'/api/v2/admin/training-master'` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 23 | `\`/api/v2/admin/training-master/${id}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 146 | `'/api/v2/admin/company-training-requirements'` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/lib/queryClient.ts`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 25 | `url` | GET/default | Shared authenticated client implementation | Yes — conditional local headers map | Yes — conditional local headers map | Shared query client, then global tenantFetch patch for relative /api URLs |
| 46 | `queryKey[0] as string` | GET/default | Shared authenticated client implementation | Yes — conditional local headers map | Yes — conditional local headers map | Shared query client, then global tenantFetch patch for relative /api URLs |

### `client/src/micro-frontend/MicroFrontendWrapper.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 88 | `url` | GET/default | Micro-frontend configured API URL | No | No | Micro-frontend interceptor adds Authorization; no x-tenant-id there; global tenantFetch applies only if URL starts /api |

### `client/src/modules/admin/AdminModule.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 819 | `\`/api/v2/admin/training-matrix-vessel-revisions/by-vessel/${vesselId}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 833 | `\`/api/v2/admin/training-matrix-vessel-revisions/next-revision/${vesselId}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 849 | `\`/api/v2/admin/training-matrix-vessel-drafts/by-vessel/${vesselId}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 2026 | `\`/api/v2/admin/vessel-drafts/by-vessel/${vesselId}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 2109 | `\`/api/v2/admin/vessel-revisions/by-vessel/${vesselId}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 3081 | `\`/api/v2/admin/vessel-revisions/next-revision/${selectedVessels[0]}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 3115 | `'/api/v2/admin/vessel-drafts/upsert'` | POST | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 3207 | `'/api/v2/admin/vessel-revisions/submit'` | POST | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 3349 | `"/api/v2/admin/forms"` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 3366 | `\`/api/v2/admin/forms/${formId}/parts\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 3386 | `"/api/v2/admin/rank-groups?includeArchived=true"` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 3401 | `\`/api/v2/admin/forms/${fid}/versions\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 3549 | `"/api/v2/admin/available-ranks"` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 9160 | `url` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/admin/api/adminApiV2.ts`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 7 | `\`${V2_BASE}/forms\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 13 | `\`${V2_BASE}/forms/${id}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 36 | `\`${V2_BASE}/forms/for-rank/${encodeURIComponent(rankLabel)}?${params}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 49 | `\`${V2_BASE}/forms/${formId}/versions?${params}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 60 | `\`${V2_BASE}/rank-groups\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 68 | `\`${V2_BASE}/rank-groups/form/${formId}?${params}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 75 | `\`${V2_BASE}/rank-groups/check-assignment?${params}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 81 | `\`${V2_BASE}/rank-groups/${id}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 87 | `\`${V2_BASE}/rank-groups/${id}/copy-sources\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 133 | `\`${V2_BASE}/rank-groups/form/${formId}/rank-conflicts?${params}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 141 | `\`${V2_BASE}/available-ranks?${params}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 172 | `\`${V2_BASE}/promotion-hierarchies\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 178 | `\`${V2_BASE}/promotion-hierarchies/${id}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 199 | `\`${V2_BASE}/training-master\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 205 | `\`${V2_BASE}/training-master/${id}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 236 | `\`${V2_BASE}/company-training-groups\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 247 | `\`${V2_BASE}/company-trainings\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 253 | `\`${V2_BASE}/company-trainings/${id}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 284 | `\`${V2_BASE}/company-training-requirements\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 295 | `\`${V2_BASE}/company-ranks\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 306 | `\`${V2_BASE}/company-ranks/by-name/${encodeURIComponent(rankName)}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 312 | `\`${V2_BASE}/vessel-groups\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 318 | `\`${V2_BASE}/vessel-groups/${id}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 339 | `\`${V2_BASE}/vessel-drafts\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 345 | `\`${V2_BASE}/vessel-drafts/${id}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 351 | `\`${V2_BASE}/vessel-drafts/by-vessel/${encodeURIComponent(vesselId)}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 377 | `\`${V2_BASE}/vessel-revisions\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 383 | `\`${V2_BASE}/vessel-revisions/${id}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 389 | `\`${V2_BASE}/vessel-revisions/by-vessel/${encodeURIComponent(vesselId)}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 395 | `\`${V2_BASE}/vessel-revisions/next-revision/${encodeURIComponent(vesselId)}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 411 | `\`${V2_BASE}/training-matrix-vessel-drafts\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 417 | `\`${V2_BASE}/training-matrix-vessel-drafts/${id}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 423 | `\`${V2_BASE}/training-matrix-vessel-drafts/by-vessel/${encodeURIComponent(vesselId)}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 449 | `\`${V2_BASE}/training-matrix-vessel-revisions\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 455 | `\`${V2_BASE}/training-matrix-vessel-revisions/${id}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 461 | `\`${V2_BASE}/training-matrix-vessel-revisions/by-vessel/${encodeURIComponent(vesselId)}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 467 | `\`${V2_BASE}/training-matrix-vessel-revisions/next-revision/${encodeURIComponent(vesselId)}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 483 | `\`/api/v2/masters/external/${encodeURIComponent(type)}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 490 | `\`${V2_BASE}/access-control/menus\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 511 | `\`${V2_BASE}/access-control/roles\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 532 | `\`${V2_BASE}/access-control/roles/${ruid}/permissions\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 543 | `\`${V2_BASE}/access-control/my-permissions\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 556 | `\`${V2_BASE}/vessel-org-chart/rank-scope?${searchParams.toString()}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/admin/components/VesselZipUploadDialog.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 85 | `"/api/v2/vessel/import/generate-workbook"` | POST | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/crew-pool/CrewImportDialog.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 249 | `"/api/v2/vessel/import/generate-workbook-from-db"` | POST | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/crew-pool/CrewInfoForm_v2.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 417 | `\`/api/v2/briefings/submissions/crew/${crewUuid}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 422 | `\`/api/v2/briefings/submissions/${row.briefing_submission_uuid}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 507 | `\`/api/v2/debriefings/submissions/crew/${crewUuid}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 512 | `\`/api/v2/debriefings/submissions/${row.debriefing_submission_uuid}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 705 | `\`/api/v2/crew-pool/crew/${crewUuid}/dashboard\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 750 | `\`/api/v2/crew-pool/crew/${crewUuid}/assignments\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/crew-pool/LicenseSelectionDialog.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 82 | `'/api/v2/masters/data/016/entries'` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/crew-pool/TravelDocumentSelectionDialog.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 42 | `'/api/v2/masters/data/018/entries'` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/crew-pool/VesselAssignmentImportDialog.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 179 | `"/api/v2/vessel/import/generate-workbook"` | POST | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 241 | `"/api/v2/vessel/import/hierarchy"` | POST | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 281 | `"/api/v2/vessel/import/assignments"` | POST | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/crew-pool/VisaSelectionDialog.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 46 | `'/api/v2/masters/data/001/entries'` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/crew-pool/api/crewPoolApiV2.ts`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 25 | `url` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 31 | `\`${V2_BASE}/crew/details?view=terminated\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 46 | `\`${V2_BASE}/crew/${crewUuid}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 52 | `\`${V2_BASE}/crew/${crewUuid}/profile\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 85 | `\`${V2_BASE}/crew/${crewUuid}/personal\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 97 | `\`${V2_BASE}/crew/${crewUuid}/address\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 109 | `\`${V2_BASE}/crew/${crewUuid}/family\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 121 | `\`${V2_BASE}/crew/${crewUuid}/children\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 142 | `\`${V2_BASE}/crew/${crewUuid}/next-of-kin\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 153 | `\`${V2_BASE}/crew/${crewUuid}/documents\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 184 | `\`${V2_BASE}/crew/${crewUuid}/visas\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 215 | `\`${V2_BASE}/crew/${crewUuid}/education\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 246 | `\`${V2_BASE}/crew/${crewUuid}/licenses\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 282 | `\`${V2_BASE}/crew/${crewUuid}/training\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 313 | `\`${V2_BASE}/crew/${crewUuid}/sea-service\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 344 | `\`${V2_BASE}/crew/${crewUuid}/medicals\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 375 | `\`${V2_BASE}/crew/${crewUuid}/doctor-visits\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 406 | `\`${V2_BASE}/crew/${crewUuid}/briefings\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 437 | `\`${V2_BASE}/crew/${crewUuid}/debriefings\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 468 | `\`${V2_BASE}/crew/${crewUuid}/vessel-types\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 479 | `\`${V2_BASE}/crew/${crewUuid}/assignments\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 495 | `\`${V2_BASE}/import/template\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 505 | `\`${V2_BASE}/import/validate\`` | POST | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 518 | `\`${V2_BASE}/import/execute\`` | POST | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/crew-pool/components/BriefingLiveSubmissionHost.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 10 | `url` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/crew-pool/components/DebriefingLiveSubmissionHost.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 10 | `url` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/crewing/AppraisalForm_v2.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 613 | `\`/api/v2/crew-pool/crew/${crewMember!.id}/training\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/crewing/ElementCrewAppraisals_v2.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 271 | `"/api/v2/appraisals"` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/crewing/api/appraisalsApiV2.ts`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 6 | `\`${V2_BASE}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 7 | `\`${V2_BASE}/${id}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 8 | `\`${V2_BASE}/crew/${crewMemberId}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 10 | `\`${V2_BASE}/crew/${crewMemberId}/promotion-recommendations?rank=${encodeURIComponent(rank)}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/dashboard/CrewAppraisalsDrilldownDialog.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 174 | `\`/api/v2/crew-pool/crew/details?view=all&limit=${PAGE_SIZE}&offset=${offset}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/dashboard/CrewAppraisalsRankChart.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 150 | `\`/api/v2/crew-pool/crew/details?view=all&limit=${PAGE_SIZE}&offset=${offset}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/dashboard/CrewPoolDrilldownDialog.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 143 | `\`/api/v2/crew-pool/crew/details?view=all&limit=${PAGE_SIZE}&offset=${offset}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 182 | `"/api/v2/crew-pool/dashboard/ranks-as-of"` | POST | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/dashboard/CrewPoolRankChart.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 150 | `\`/api/v2/crew-pool/crew/details?view=all&limit=${PAGE_SIZE}&offset=${offset}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 187 | `"/api/v2/crew-pool/dashboard/ranks-as-of"` | POST | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/dashboard/CrewRetentionDrilldownDialog.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 94 | `\`/api/v2/training-retention/retention?${qp.toString()}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/dashboard/CrewRetentionMetrics.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 87 | `\`/api/v2/training-retention/retention?${qp.toString()}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/dashboard/DAAnalysisMetrics.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 79 | `\`/api/v2/drugs-alcohol/stats/violations?${qp.toString()}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/dashboard/DAViolationsDrilldownDialog.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 108 | `\`/api/v2/drugs-alcohol/test-records/violations?${qp.toString()}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/drugs-alcohol/AnnualTestTable_v2.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 42 | `apiBase` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/drugs-alcohol/HistoryTable_v2.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 273 | `'/api/v2/drugs-alcohol/test-records'` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/drugs-alcohol/MonthlyTestTable_v2.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 41 | `apiBase` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/drugs-alcohol/OtherTestsTable_v2.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 180 | `apiBase` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/drugs-alcohol/PeriodicTestTable_v2.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 41 | `apiBase` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/drugs-alcohol/PostIncidentTestTable_v2.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 147 | `apiBase` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/drugs-alcohol/SummaryTable_v2.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 212 | `apiBase` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/drugs-alcohol/api/drugsAlcoholApiV2.ts`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 34 | `url` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 40 | `\`${V2_BASE}/test-records/${uuid}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 49 | `url` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 93 | `\`${V2_BASE}/attachments/${encodeURIComponent(testRecordUuid)}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 119 | `\`${V2_BASE}/crew/vessel/${encodeURIComponent(vesselUuid)}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/promotions/PromotionReviewForm.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 809 | `\`/api/v2/admin/vessel-revisions/ranks/${currentVesselUuid}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/recruitment/ComplianceScreening.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 74 | `\`${SCREENING_API}/candidates/${recCanUuid}/compliance-screening\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 83 | `\`${SCREENING_API}/candidates/${recCanUuid}/compliance-screening/screen\`` | POST | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 103 | `\`${SCREENING_API}/candidates/${recCanUuid}/compliance-screening/remark\`` | PUT | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/recruitment/RecruitmentApplicationForm_v2.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 565 | `\`/api/v2/interviews/submissions/candidate/${recCanUuid}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 919 | `'/api/v2/masters/data/001/entries'` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 3360 | `'/api/v2/recruitment/candidates/next-file-number'` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 3386 | `\`/api/v2/recruitment/candidates/${currentUuid}/compliance-screening/screen\`` | POST | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 4160 | `'/api/v2/crew-pool/transfer/recruitment'` | POST | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/recruitment/VesselSearchDialog.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 113 | `\`/api/v2/recruitment/vessel-search?${params}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/recruitment/api/candidateApi.ts`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 42 | `\`${BASE_URL}/candidates\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 47 | `\`${BASE_URL}/candidates/${id}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 52 | `\`${BASE_URL}/candidates\`` | POST | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 61 | `\`${BASE_URL}/candidates/${id}\`` | PUT | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 70 | `\`${BASE_URL}/candidates/${id}\`` | DELETE | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 83 | `\`${BASE_URL}/candidates/${candidateId}/vessel-types-applied\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 88 | `\`${BASE_URL}/candidates/${candidateId}/vessel-types-applied\`` | POST | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 97 | `\`${BASE_URL}/candidates/${candidateId}/vessel-types-applied/${vtaId}\`` | DELETE | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 110 | `\`${BASE_URL}/candidates/${candidateId}/personal-details\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 116 | `\`${BASE_URL}/candidates/${candidateId}/personal-details\`` | PUT | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 131 | `\`${BASE_URL}/candidates/${candidateId}/addresses\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 137 | `\`${BASE_URL}/candidates/${candidateId}/addresses\`` | PUT | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 152 | `\`${BASE_URL}/candidates/${candidateId}/family-info\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 158 | `\`${BASE_URL}/candidates/${candidateId}/family-info\`` | PUT | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 173 | `\`${BASE_URL}/candidates/${candidateId}/children\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 178 | `\`${BASE_URL}/candidates/${candidateId}/children\`` | POST | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 187 | `\`${BASE_URL}/candidates/${candidateId}/children/${childId}\`` | PUT | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 196 | `\`${BASE_URL}/candidates/${candidateId}/children/${childId}\`` | DELETE | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 209 | `\`${BASE_URL}/candidates/${candidateId}/next-of-kin\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 214 | `\`${BASE_URL}/candidates/${candidateId}/next-of-kin\`` | POST | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 223 | `\`${BASE_URL}/candidates/${candidateId}/next-of-kin/${nokId}\`` | PUT | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 232 | `\`${BASE_URL}/candidates/${candidateId}/next-of-kin/${nokId}\`` | DELETE | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/recruitment/components/InterviewLiveSubmissionHost.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 11 | `url` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/recruitment/hooks/useRecruitmentV2.ts`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 68 | `\`${API_BASE}${endpoint}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 76 | `\`${API_BASE}${endpoint}\`` | POST | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 88 | `\`${API_BASE}${endpoint}\`` | PUT | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 100 | `\`${API_BASE}${endpoint}\`` | PATCH | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 112 | `\`${API_BASE}${endpoint}\`` | DELETE | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/rest-hours/api/restHoursApiV2.ts`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 43 | `url` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 49 | `\`${V2_BASE}/vessel-records/${uuid}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 132 | `url` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 138 | `\`${V2_BASE}/crew-records/${uuid}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 187 | `url` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 209 | `url` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 223 | `url` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 229 | `\`${V2_BASE}/daily-records/${uuid}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 240 | `url` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 288 | `url` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 294 | `\`${V2_BASE}/vessel-comments/${uuid}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 333 | `url` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 339 | `\`${V2_BASE}/office-comments/${uuid}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 375 | `\`${V2_BASE}/nc-reports/all\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 387 | `url` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 393 | `\`${V2_BASE}/nc-reports/${uuid}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 432 | `url` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 438 | `\`${V2_BASE}/fixed-tasks/${uuid}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 445 | `url` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 485 | `url` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 494 | `url` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 500 | `\`${V2_BASE}/variable-tasks/${uuid}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 513 | `\`${V2_BASE}/variable-tasks/ranks-as-of-date?${searchParams}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 563 | `url` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 569 | `\`${V2_BASE}/dateline/${uuid}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 605 | `\`${V2_BASE}/masters/vessels\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 615 | `url` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 626 | `url` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 632 | `\`/api/v2/masters/fleet-groups\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 638 | `\`/api/v2/masters/additional-groups\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/rest-hours/components/RHCrewRecordsTable.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 387 | `\`/api/v2/admin/vessel-revisions/ranks/${vesselId}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/rest-hours/components/RHRecordingForm.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 345 | `\`/api/v2/admin/vessel-revisions/ranks/${selectedVesselId}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/rest-hours/components/RestHoursVesselOverview.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 259 | `\`/api/v2/rest-hours/daily-records/by-key/${crewMemberId}/${vesselId}/${monthYear}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/rest-hours/components/ViolationsDetailDialog.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 52 | `\`/api/v2/rest-hours/daily-records/by-key/${crewMemberId}/${vesselId}/${monthValue}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/rotation/ApprovalTable_v2.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 53 | `\`/api/v2/rotation/proposals?${queryParams.toString()}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/rotation/DueCrewTable_v2.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 212 | `\`/api/v2/rotation/due-crew?${queryParams.toString()}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/rotation/NewPlanDialog_v2.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 1594 | `\`/api/v2/rotation/due-crew?${queryParams.toString()}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 2160 | `\`/api/v2/rotation/drafts/${editPlan.draftUuid}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 2219 | `\`/api/v2/admin/vessel-revisions/ranks/${vesselId}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 2422 | `\`/api/v2/rotation/due-crew?${queryParams.toString()}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/rotation/api/rotationApiV2.ts`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 127 | `\`${V2_BASE}/crew/by-rank/${encodedRank}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 133 | `\`${V2_BASE}/drafts\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 143 | `\`${V2_BASE}/drafts/${draftUuid}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 237 | `url` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 243 | `\`${V2_BASE}/entries/${entryUuid}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 304 | `url` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/training-retention/components/Retention.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 374 | `\`/api/v2/training-retention/retention?${params.toString()}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/vessel/VesselModule_v2.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 248 | `'/api/v2/vessel/list'` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 271 | `\`/api/v2/admin/vessel-revisions/ranks/${vesselId}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 309 | `'/api/v2/admin/company-trainings'` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 320 | `'/api/v2/admin/company-training-groups'` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 331 | `'/api/v2/admin/company-training-requirements'` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 343 | `\`/api/v2/admin/training-matrix-vessel-revisions/by-vessel/${vesselId}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 356 | `\`/api/v2/admin/training-matrix-vessel-drafts/by-vessel/${vesselId}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 380 | `\`/api/v2/vessel/training/${vesselUuid}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 1470 | `\`/api/v2/admin/rank-groups/check-assignment?rank=${encodeURIComponent(crewRank)}&formName=${encodeURIComponent('Crew Appraisal Form')}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/vessel/api/vesselApiV2.ts`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 154 | `\`${V2_BASE}/${encodeURIComponent(vesselUuid)}/crew-list-export\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 163 | `\`${V2_BASE}/${encodeURIComponent(vesselCode)}/planning\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 169 | `\`${V2_BASE}/planning/${planUuid}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 205 | `\`${V2_BASE}/planning/${planUuid}/attachments\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 215 | `\`${V2_BASE}/planning/${planUuid}/attachments\`` | POST | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |
| 285 | `\`${V2_BASE}/officer-matrix/${crewUuid}?${params.toString()}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/vessel/components/OnBoardStatusEditDialog_v2.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 98 | `\`/api/v2/ports/${signOnPortUuid}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/modules/vessel/components/ReliefStatusEditDialog_v2.tsx`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 187 | `\`/api/v2/vessel/planning/check-sign-on-conflict/${crewUuid}?vesselUuid=${encodeURIComponent(vesselUuid)}${planUuidParam}\`` | GET/default | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/utils/formCommands.ts`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 39 | `'/api/v2/admin/forms'` | POST | Tenant-scoped app API | No | No | Global tenantFetch patch for URLs beginning /api (conditional on token/tenant availability) |

### `client/src/utils/http.ts`

| Line | Endpoint expression | Method | Classification | Manual Authorization | Manual x-tenant-id | Effective header path |
|---:|---|---|---|---|---|---|
| 30 | `input` | dynamic/init | Generic HTTP helper | No | No | Global tenantFetch patch only when caller URL begins /api |

## Decision boundary for the next stage

If conversion is approved, the implementation stage should target the 260 tenant-scoped raw calls. Blob downloads and multipart uploads remain in scope but require response/body-preserving treatment; truly external URLs and micro-frontend absolute URLs should remain separate. Acceptance must test header presence and restart readiness separately, because standardizing the call helper and resolving token-readiness are related but not equivalent guarantees.
