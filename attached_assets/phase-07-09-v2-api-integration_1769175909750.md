# Phase 7-9: V2 API Integration (Mirror Legacy UI)

## Prerequisites
- Phases 1-5 complete (V2 backend with `/api/v2/crew-pool/...` endpoints)
- Phase 12a complete (backend business logic)
- Legacy Crew Pool UI exists and works

## Objective
Mirror the existing Crew Pool UI for V2 by:
1. **Copying legacy files to V2 folder** - isolated V2 implementation
2. **Modifying V2 folder copies** to use V2 API endpoints
3. **Adding feature toggle** to switch between Legacy/V2 modules
4. **No changes to legacy files** - original module stays untouched

**CRITICAL: Legacy files remain unchanged.** V2 is a parallel implementation in its own folder.

---

## Folder Structure

```
client/src/modules/crew-pool/
├── CrewPoolModule.tsx              # Legacy (unchanged)
├── CrewInfoForm.tsx                # Legacy (unchanged)
├── hooks/
│   ├── useCrewPoolHooks.ts         # Legacy (unchanged)
│   └── useCrewPoolVersion.ts       # NEW: Feature toggle hook
├── v2/                             # NEW: V2 Implementation folder
│   ├── CrewPoolModule_v2.tsx       # Copy of CrewPoolModule.tsx (modified for V2 API)
│   ├── CrewInfoForm_v2.tsx         # Copy of CrewInfoForm.tsx (modified for V2 API)
│   ├── api/
│   │   └── crewPoolApiV2.ts        # V2 API client
│   ├── hooks/
│   │   └── useCrewPoolV2.ts        # V2 hooks (call V2 API)
│   ├── mappers/
│   │   └── v2ToLegacyMapper.ts     # V2 API ↔ Form data mappers
│   └── index.ts                    # V2 module exports
└── index.ts                        # Version-aware module router
```

---

## SECTION 1: Feature Toggle Hook

### 1.1 Create Version Toggle Hook

**File:** `client/src/modules/crew-pool/hooks/useCrewPoolVersion.ts`

```typescript
// client/src/modules/crew-pool/hooks/useCrewPoolVersion.ts

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'crew_pool_version';

export type CrewPoolVersion = 'legacy' | 'v2';

/**
 * Feature toggle hook for Crew Pool version switching
 * Mirrors Recruitment V2 pattern: useRecruitmentVersion
 */
export function useCrewPoolVersion() {
  const [version, setVersionState] = useState<CrewPoolVersion>('legacy');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'v2' || stored === 'legacy') {
      setVersionState(stored);
    }
  }, []);

  const setVersion = useCallback((newVersion: CrewPoolVersion) => {
    localStorage.setItem(STORAGE_KEY, newVersion);
    setVersionState(newVersion);
  }, []);

  const toggleVersion = useCallback(() => {
    const newVersion = version === 'legacy' ? 'v2' : 'legacy';
    setVersion(newVersion);
  }, [version, setVersion]);

  return {
    version,
    setVersion,
    toggleVersion,
    isV2: version === 'v2',
    isLegacy: version === 'legacy',
  };
}
```

---

## SECTION 2: Version-Aware Module Router

### 2.1 Create Module Router

**File:** `client/src/modules/crew-pool/index.ts`

```typescript
// client/src/modules/crew-pool/index.ts

import { lazy, Suspense } from 'react';
import { useCrewPoolVersion } from './hooks/useCrewPoolVersion';

// Lazy load both versions
const CrewPoolModuleLegacy = lazy(() => import('./CrewPoolModule'));
const CrewPoolModuleV2 = lazy(() => import('./v2/CrewPoolModule_v2'));

/**
 * Version-aware Crew Pool Module
 * Renders Legacy or V2 based on feature toggle
 */
export function CrewPoolModuleRouter() {
  const { isV2 } = useCrewPoolVersion();

  return (
    <Suspense fallback={<div className="p-4">Loading...</div>}>
      {isV2 ? <CrewPoolModuleV2 /> : <CrewPoolModuleLegacy />}
    </Suspense>
  );
}

// Re-export toggle hook for use in both versions
export { useCrewPoolVersion } from './hooks/useCrewPoolVersion';
```

---

## SECTION 3: Copy Legacy Files to V2 Folder

### 3.1 Files to Copy

| Source (Legacy) | Destination (V2) | Modifications |
|-----------------|------------------|---------------|
| `CrewPoolModule.tsx` | `v2/CrewPoolModule_v2.tsx` | Import V2 hooks, add version toggle UI |
| `CrewInfoForm.tsx` | `v2/CrewInfoForm_v2.tsx` | Import V2 hooks |

### 3.2 Copy Instructions

```bash
# Create V2 folder structure
mkdir -p client/src/modules/crew-pool/v2/{api,hooks,mappers}

# Copy legacy files to V2 folder
cp client/src/modules/crew-pool/CrewPoolModule.tsx \
   client/src/modules/crew-pool/v2/CrewPoolModule_v2.tsx

cp client/src/modules/crew-pool/CrewInfoForm.tsx \
   client/src/modules/crew-pool/v2/CrewInfoForm_v2.tsx
```

### 3.3 Modifications to V2 Copies

**In `CrewPoolModule_v2.tsx`:**

1. Rename component: `CrewPoolModule` → `CrewPoolModule_v2`
2. Update imports to use V2 hooks:
   ```tsx
   // BEFORE (in legacy):
   import { useCrewList, useDeleteCrew } from './hooks/useCrewPoolHooks';
   
   // AFTER (in V2):
   import { useCrewListV2, useDeleteCrewV2 } from './hooks/useCrewPoolV2';
   import { useCrewPoolVersion } from '../hooks/useCrewPoolVersion';
   ```
3. Add version toggle button in header
4. Update form import: `CrewInfoForm` → `CrewInfoForm_v2`

**In `CrewInfoForm_v2.tsx`:**

1. Rename component: `CrewInfoForm` → `CrewInfoForm_v2`
2. Update imports to use V2 hooks:
   ```tsx
   // BEFORE (in legacy):
   import { useCrewFullProfile, useSaveDocuments, ... } from './hooks/useCrewPoolHooks';
   
   // AFTER (in V2):
   import { 
     useCrewFullProfileV2, 
     useSaveDocumentsV2, 
     ... 
   } from './hooks/useCrewPoolV2';
   ```

---

## SECTION 4: V2 API Layer

**File:** `client/src/modules/crew-pool/v2/api/crewPoolApiV2.ts`

```typescript
// client/src/modules/crew-pool/v2/api/crewPoolApiV2.ts

import { apiRequest } from '@/lib/queryClient';

const V2_BASE = '/api/v2/crew-pool';

/**
 * V2 API client for Crew Pool
 * Calls normalized V2 endpoints
 */
export const crewPoolApiV2 = {
  // ========== CREW MEMBERS ==========
  
  async getCrewList(params?: {
    search?: string;
    rank?: string;
    nationality?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.rank) searchParams.set('rank', params.rank);
    if (params?.nationality) searchParams.set('nationality', params.nationality);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    
    const url = `${V2_BASE}/crew-members${searchParams.toString() ? '?' + searchParams : ''}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch crew list');
    return response.json();
  },

  async getCrewById(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}`);
    if (!response.ok) throw new Error('Failed to fetch crew member');
    return response.json();
  },

  async getCrewFullProfile(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/full-profile`);
    if (!response.ok) throw new Error('Failed to fetch crew profile');
    return response.json();
  },

  async createCrew(data: any) {
    return apiRequest('POST', `${V2_BASE}/crew-members`, data);
  },

  async updateCrew(crewUuid: string, data: any) {
    return apiRequest('PATCH', `${V2_BASE}/crew-members/${crewUuid}`, data);
  },

  async deleteCrew(crewUuid: string) {
    return apiRequest('DELETE', `${V2_BASE}/crew-members/${crewUuid}`);
  },

  // ========== PERSONAL DETAILS ==========
  
  async getPersonalDetails(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/personal-details`);
    if (!response.ok) throw new Error('Failed to fetch personal details');
    return response.json();
  },

  async savePersonalDetails(crewUuid: string, data: any) {
    return apiRequest('PUT', `${V2_BASE}/crew-members/${crewUuid}/personal-details`, data);
  },

  // ========== ADDRESS ==========
  
  async getAddress(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/address`);
    if (!response.ok) throw new Error('Failed to fetch address');
    return response.json();
  },

  async saveAddress(crewUuid: string, data: any) {
    return apiRequest('PUT', `${V2_BASE}/crew-members/${crewUuid}/address`, data);
  },

  // ========== FAMILY INFO ==========
  
  async getFamilyInfo(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/family-info`);
    if (!response.ok) throw new Error('Failed to fetch family info');
    return response.json();
  },

  async saveFamilyInfo(crewUuid: string, data: any) {
    return apiRequest('PUT', `${V2_BASE}/crew-members/${crewUuid}/family-info`, data);
  },

  // ========== CHILDREN ==========
  
  async getChildren(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/children`);
    if (!response.ok) throw new Error('Failed to fetch children');
    return response.json();
  },

  async saveChildren(crewUuid: string, data: any[]) {
    return apiRequest('PUT', `${V2_BASE}/crew-members/${crewUuid}/children`, data);
  },

  // ========== NEXT OF KIN ==========
  
  async getNextOfKin(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/next-of-kin`);
    if (!response.ok) throw new Error('Failed to fetch next of kin');
    return response.json();
  },

  async saveNextOfKin(crewUuid: string, data: any) {
    return apiRequest('PUT', `${V2_BASE}/crew-members/${crewUuid}/next-of-kin`, data);
  },

  // ========== DOCUMENTS ==========
  
  async getDocuments(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/documents`);
    if (!response.ok) throw new Error('Failed to fetch documents');
    return response.json();
  },

  async saveDocuments(crewUuid: string, data: any[]) {
    return apiRequest('PUT', `${V2_BASE}/crew-members/${crewUuid}/documents`, data);
  },

  // ========== VISAS ==========
  
  async getVisas(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/visas`);
    if (!response.ok) throw new Error('Failed to fetch visas');
    return response.json();
  },

  async saveVisas(crewUuid: string, data: any[]) {
    return apiRequest('PUT', `${V2_BASE}/crew-members/${crewUuid}/visas`, data);
  },

  // ========== EDUCATION ==========
  
  async getEducation(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/education`);
    if (!response.ok) throw new Error('Failed to fetch education');
    return response.json();
  },

  async saveEducation(crewUuid: string, data: any[]) {
    return apiRequest('PUT', `${V2_BASE}/crew-members/${crewUuid}/education`, data);
  },

  // ========== LICENSES ==========
  
  async getLicenses(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/licenses`);
    if (!response.ok) throw new Error('Failed to fetch licenses');
    return response.json();
  },

  async saveLicenses(crewUuid: string, data: any[]) {
    return apiRequest('PUT', `${V2_BASE}/crew-members/${crewUuid}/licenses`, data);
  },

  // ========== TRAINING COURSES ==========
  
  async getTrainingCourses(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/training-courses`);
    if (!response.ok) throw new Error('Failed to fetch training courses');
    return response.json();
  },

  async saveTrainingCourses(crewUuid: string, data: any[]) {
    return apiRequest('PUT', `${V2_BASE}/crew-members/${crewUuid}/training-courses`, data);
  },

  // ========== SEA SERVICE ==========
  
  async getSeaService(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/sea-service`);
    if (!response.ok) throw new Error('Failed to fetch sea service');
    return response.json();
  },

  async saveSeaService(crewUuid: string, data: any[]) {
    return apiRequest('PUT', `${V2_BASE}/crew-members/${crewUuid}/sea-service`, data);
  },

  // ========== PRE-JOINING MEDICALS ==========
  
  async getPreJoiningMedicals(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/pre-joining-medicals`);
    if (!response.ok) throw new Error('Failed to fetch pre-joining medicals');
    return response.json();
  },

  async savePreJoiningMedicals(crewUuid: string, data: any[]) {
    return apiRequest('PUT', `${V2_BASE}/crew-members/${crewUuid}/pre-joining-medicals`, data);
  },

  // ========== DOCTOR VISITS ==========
  
  async getDoctorVisits(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/doctor-visits`);
    if (!response.ok) throw new Error('Failed to fetch doctor visits');
    return response.json();
  },

  async saveDoctorVisits(crewUuid: string, data: any[]) {
    return apiRequest('PUT', `${V2_BASE}/crew-members/${crewUuid}/doctor-visits`, data);
  },

  // ========== ASSIGNMENTS ==========
  
  async getAssignments(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/assignments`);
    if (!response.ok) throw new Error('Failed to fetch assignments');
    return response.json();
  },

  async assignToVessel(crewUuid: string, data: any) {
    return apiRequest('POST', `${V2_BASE}/crew-members/${crewUuid}/assign`, data);
  },

  async signOff(crewUuid: string, data: any) {
    return apiRequest('POST', `${V2_BASE}/crew-members/${crewUuid}/sign-off`, data);
  },

  // ========== VESSEL TYPES APPLIED ==========
  
  async getVesselTypesApplied(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/vessel-types-applied`);
    if (!response.ok) throw new Error('Failed to fetch vessel types applied');
    return response.json();
  },

  async saveVesselTypesApplied(crewUuid: string, data: any[]) {
    return apiRequest('PUT', `${V2_BASE}/crew-members/${crewUuid}/vessel-types-applied`, data);
  },
};
```

---

## SECTION 5: V2 → Legacy Mappers

### 5.1 Field Mapping Reference (ERD → Legacy Form)

| V2 Table/Field | Legacy FormData Field |
|----------------|----------------------|
| `crew_members_v2.emp_no` | `empNo` |
| `crew_members_v2.first_name` | `firstName` |
| `crew_members_v2.dob` | `dateOfBirth` |
| `crew_members_v2.nationality_uuid` | `nationality` (resolve to name) |
| `crew_personal_details.height_cm` | `height` |
| `crew_personal_details.weight_kg` | `weight` |
| `crew_personal_details.place_of_birth_city` | `placeOfBirthCity` |
| `crew_personal_details.place_of_birth_country_uuid` | `placeOfBirthCountry` (resolve) |
| `crew_personal_details.native_language_uuid` | `nativeLanguage` (resolve) |
| `crew_personal_details.english_proficiency` | `englishProficiency` |
| `crew_addresses.country_of_residence_uuid` | `countryOfResidence` (resolve) |
| `crew_addresses.address_line1` | `residentialAddressLine1` |
| `crew_addresses.address_line2` | `residentialAddressLine2` |
| `crew_documents.document_name` | `documentName` |
| `crew_documents.number` | `documentNumber` |
| `crew_documents.issued` | `issuedDate` |
| `crew_documents.expiry` | `expiryDate` |
| `crew_documents.issuing_country_uuid` | `issuingCountry` (resolve) |
| `crew_sea_service.service_type` | `isCompanyService` (boolean) |
| `crew_sea_service.vessel_uuid` | `vesselCode` (resolve) |
| `crew_sea_service.vessel_type_uuid` | `vesselType` (resolve) |
| `crew_pre_joining_medicals.examination_date` | `dateOfMedical` |
| `crew_pre_joining_medicals.fit_for_duty` | `fitnessForDuty` |
| `crew_doctor_visits.visit_date` | `visitDate` |
| `crew_doctor_visits.reason` | `complaint` |

### 5.2 Main Mapper File

**File:** `client/src/modules/crew-pool/v2/mappers/v2ToLegacyMapper.ts`

```typescript
// client/src/modules/crew-pool/v2/mappers/v2ToLegacyMapper.ts

/**
 * Maps V2 normalized API responses to Legacy flat FormData format
 * This allows V2 CrewInfoForm_v2.tsx to work with same form structure as legacy
 */

// ========== CREW MEMBER ==========

export interface LegacyCrewMember {
  id?: number;
  crewUuid?: string;
  empNo: string;
  employeeId: string;
  firstName: string;
  middleName: string;
  familyName: string;
  gender: string;
  dateOfBirth: string;
  nationality: string;
  presentRank: string;
  rankAppliedFor: string;
  status: string;
  reason: string;
  isActive: boolean;
  uploadedPhoto: string;
}

export function mapV2CrewToLegacy(v2Crew: any): LegacyCrewMember {
  return {
    id: v2Crew.id,
    crewUuid: v2Crew.crewUuid,
    empNo: v2Crew.empNo || '',
    employeeId: v2Crew.employeeId || '',
    firstName: v2Crew.firstName || '',
    middleName: v2Crew.middleName || '',
    familyName: v2Crew.familyName || '',
    gender: v2Crew.gender || '',
    dateOfBirth: v2Crew.dob || '',
    nationality: v2Crew.nationalityUuid || '',
    presentRank: v2Crew.presentRank || '',
    rankAppliedFor: v2Crew.rankAppliedFor || '',
    status: v2Crew.status || 'active',
    reason: v2Crew.reason || '',
    isActive: v2Crew.isActive ?? true,
    uploadedPhoto: v2Crew.uploadedPhoto || '',
  };
}

export function mapLegacyCrewToV2(legacy: LegacyCrewMember): any {
  return {
    empNo: legacy.empNo || undefined,
    employeeId: legacy.employeeId || undefined,
    firstName: legacy.firstName || undefined,
    middleName: legacy.middleName || undefined,
    familyName: legacy.familyName || undefined,
    gender: legacy.gender || undefined,
    dob: legacy.dateOfBirth || undefined,
    nationalityUuid: legacy.nationality || undefined,
    presentRank: legacy.presentRank || undefined,
    rankAppliedFor: legacy.rankAppliedFor || undefined,
    status: legacy.status || undefined,
    reason: legacy.reason || undefined,
    isActive: legacy.isActive,
    uploadedPhoto: legacy.uploadedPhoto || undefined,
  };
}

// ========== PERSONAL DETAILS ==========

export interface LegacyPersonalDetails {
  height: string;
  weight: string;
  bmi: string;
  ageInYears: string;
  placeOfBirthCity: string;
  placeOfBirthCountry: string;
  nativeLanguage: string;
  foreignLanguages: string;
  englishProficiency: string;
  manningAgent: string;
  crewPool: string;
  availability: string;
  nextAvailability: string;
}

export function mapV2PersonalDetailsToLegacy(v2: any): LegacyPersonalDetails {
  return {
    height: v2?.heightCm || '',
    weight: v2?.weightKg || '',
    bmi: v2?.bmi || '',
    ageInYears: v2?.ageInYears || '',
    placeOfBirthCity: v2?.placeOfBirthCity || '',
    placeOfBirthCountry: v2?.placeOfBirthCountryUuid || '',
    nativeLanguage: v2?.nativeLanguageUuid || '',
    foreignLanguages: v2?.foreignLanguages || '',
    englishProficiency: v2?.englishProficiency || '',
    manningAgent: v2?.manningAgent || '',
    crewPool: v2?.crewPool || '',
    availability: v2?.availability || '',
    nextAvailability: v2?.nextAvailability || '',
  };
}

export function mapLegacyPersonalDetailsToV2(legacy: LegacyPersonalDetails): any {
  return {
    heightCm: legacy.height || undefined,
    weightKg: legacy.weight || undefined,
    bmi: legacy.bmi || undefined,
    ageInYears: legacy.ageInYears || undefined,
    placeOfBirthCity: legacy.placeOfBirthCity || undefined,
    placeOfBirthCountryUuid: legacy.placeOfBirthCountry || undefined,
    nativeLanguageUuid: legacy.nativeLanguage || undefined,
    foreignLanguages: legacy.foreignLanguages || undefined,
    englishProficiency: legacy.englishProficiency || undefined,
    manningAgent: legacy.manningAgent || undefined,
    crewPool: legacy.crewPool || undefined,
    availability: legacy.availability || undefined,
    nextAvailability: legacy.nextAvailability || undefined,
  };
}

// ========== ADDRESS ==========

export interface LegacyAddress {
  countryOfResidence: string;
  nearestAirport: string;
  residentialAddressLine1: string;
  residentialAddressLine2: string;
  contactLandline: string;
  mobile: string;
  email: string;
}

export function mapV2AddressToLegacy(v2: any): LegacyAddress {
  return {
    countryOfResidence: v2?.countryOfResidenceUuid || '',
    nearestAirport: v2?.nearestAirport || '',
    residentialAddressLine1: v2?.addressLine1 || '',
    residentialAddressLine2: v2?.addressLine2 || '',
    contactLandline: v2?.contactLandline || '',
    mobile: v2?.mobile || '',
    email: v2?.email || '',
  };
}

export function mapLegacyAddressToV2(legacy: LegacyAddress): any {
  return {
    countryOfResidenceUuid: legacy.countryOfResidence || undefined,
    nearestAirport: legacy.nearestAirport || undefined,
    addressLine1: legacy.residentialAddressLine1 || undefined,
    addressLine2: legacy.residentialAddressLine2 || undefined,
    contactLandline: legacy.contactLandline || undefined,
    mobile: legacy.mobile || undefined,
    email: legacy.email || undefined,
  };
}

// ========== FAMILY INFO ==========

export interface LegacyFamilyInfo {
  maritalStatus: string;
  numberOfDependentChildren: string;
  fatherName: string;
  motherName: string;
  spouseFirstName: string;
  spouseMiddleName: string;
  spouseFamilyName: string;
  spouseDateOfBirth: string;
}

export function mapV2FamilyInfoToLegacy(v2: any): LegacyFamilyInfo {
  return {
    maritalStatus: v2?.maritalStatus || '',
    numberOfDependentChildren: v2?.numDependentChildren || '',
    fatherName: v2?.fatherName || '',
    motherName: v2?.motherName || '',
    spouseFirstName: v2?.spouseFirstName || '',
    spouseMiddleName: v2?.spouseMiddleName || '',
    spouseFamilyName: v2?.spouseFamilyName || '',
    spouseDateOfBirth: v2?.spouseDob || '',
  };
}

export function mapLegacyFamilyInfoToV2(legacy: LegacyFamilyInfo): any {
  return {
    maritalStatus: legacy.maritalStatus || undefined,
    numDependentChildren: legacy.numberOfDependentChildren || undefined,
    fatherName: legacy.fatherName || undefined,
    motherName: legacy.motherName || undefined,
    spouseFirstName: legacy.spouseFirstName || undefined,
    spouseMiddleName: legacy.spouseMiddleName || undefined,
    spouseFamilyName: legacy.spouseFamilyName || undefined,
    spouseDob: legacy.spouseDateOfBirth || undefined,
  };
}

// ========== CHILDREN ==========

export interface LegacyChild {
  childUuid?: string;
  firstName: string;
  middleName: string;
  familyName: string;
  dateOfBirth: string;
  gender: string;
}

export function mapV2ChildToLegacy(v2: any): LegacyChild {
  return {
    childUuid: v2?.childUuid,
    firstName: v2?.firstName || '',
    middleName: v2?.middleName || '',
    familyName: v2?.familyName || '',
    dateOfBirth: v2?.dob || '',
    gender: v2?.gender || '',
  };
}

export function mapLegacyChildToV2(legacy: LegacyChild): any {
  return {
    childUuid: legacy.childUuid,
    firstName: legacy.firstName || undefined,
    middleName: legacy.middleName || undefined,
    familyName: legacy.familyName || undefined,
    dob: legacy.dateOfBirth || undefined,
    gender: legacy.gender || undefined,
  };
}

// ========== NEXT OF KIN ==========

export interface LegacyNextOfKin {
  nokUuid?: string;
  firstName: string;
  middleName: string;
  familyName: string;
  telephone: string;
  email: string;
  address: string;
  relationship: string;
}

export function mapV2NextOfKinToLegacy(v2: any): LegacyNextOfKin {
  return {
    nokUuid: v2?.nokUuid,
    firstName: v2?.firstName || '',
    middleName: v2?.middleName || '',
    familyName: v2?.familyName || '',
    telephone: v2?.telephone || '',
    email: v2?.email || '',
    address: v2?.address || '',
    relationship: v2?.relationship || '',
  };
}

export function mapLegacyNextOfKinToV2(legacy: LegacyNextOfKin): any {
  return {
    nokUuid: legacy.nokUuid,
    firstName: legacy.firstName || undefined,
    middleName: legacy.middleName || undefined,
    familyName: legacy.familyName || undefined,
    telephone: legacy.telephone || undefined,
    email: legacy.email || undefined,
    address: legacy.address || undefined,
    relationship: legacy.relationship || undefined,
  };
}

// ========== DOCUMENTS ==========

export interface LegacyDocument {
  docUuid?: string;
  documentId: string;
  documentName: string;
  documentNumber: string;
  issuedDate: string;
  expiryDate: string;
  issuingAuthority: string;
  issuingCountry: string;
  attachments: LegacyAttachment[];
}

export interface LegacyAttachment {
  attUuid?: string;
  fileName: string;
  fileType: string;
  fileSize: string;
  filePath: string;
  fileData?: string;
  isNew?: boolean;
  isDeleted?: boolean;
}

export function mapV2DocumentToLegacy(v2: any): LegacyDocument {
  return {
    docUuid: v2?.docUuid,
    documentId: v2?.documentId || '',
    documentName: v2?.documentName || '',
    documentNumber: v2?.number || '',
    issuedDate: v2?.issued || '',
    expiryDate: v2?.expiry || '',
    issuingAuthority: v2?.issuingAuthority || '',
    issuingCountry: v2?.issuingCountryUuid || '',
    attachments: (v2?.attachments || []).map((att: any) => ({
      attUuid: att.attUuid,
      fileName: att.fileName || '',
      fileType: att.fileType || '',
      fileSize: att.fileSize || '',
      filePath: att.filePath || '',
      fileData: att.fileData,
    })),
  };
}

export function mapLegacyDocumentToV2(legacy: LegacyDocument): any {
  return {
    docUuid: legacy.docUuid,
    documentId: legacy.documentId || undefined,
    documentName: legacy.documentName || undefined,
    number: legacy.documentNumber || undefined,
    issued: legacy.issuedDate || undefined,
    expiry: legacy.expiryDate || undefined,
    issuingAuthority: legacy.issuingAuthority || undefined,
    issuingCountryUuid: legacy.issuingCountry || undefined,
    attachments: legacy.attachments
      .filter(att => att.isNew || att.isDeleted)
      .map(att => ({
        attUuid: att.attUuid,
        fileName: att.fileName,
        fileData: att.fileData,
        isNew: att.isNew,
        isDeleted: att.isDeleted,
      })),
  };
}

// ========== VISAS ==========

export interface LegacyVisa {
  visaUuid?: string;
  country: string;
  serialNo: string;
  issuedDate: string;
  expiryDate: string;
  visaType: string;
  attachments: LegacyAttachment[];
}

export function mapV2VisaToLegacy(v2: any): LegacyVisa {
  return {
    visaUuid: v2?.visaUuid,
    country: v2?.countryUuid || '',
    serialNo: v2?.serialNo || '',
    issuedDate: v2?.issued || '',
    expiryDate: v2?.expiry || '',
    visaType: v2?.visaType || '',
    attachments: (v2?.attachments || []).map((att: any) => ({
      attUuid: att.attUuid,
      fileName: att.fileName || '',
      fileType: att.fileType || '',
      fileSize: att.fileSize || '',
      filePath: att.filePath || '',
      fileData: att.fileData,
    })),
  };
}

export function mapLegacyVisaToV2(legacy: LegacyVisa): any {
  return {
    visaUuid: legacy.visaUuid,
    countryUuid: legacy.country || undefined,
    serialNo: legacy.serialNo || undefined,
    issued: legacy.issuedDate || undefined,
    expiry: legacy.expiryDate || undefined,
    visaType: legacy.visaType || undefined,
    attachments: legacy.attachments
      .filter(att => att.isNew || att.isDeleted)
      .map(att => ({
        attUuid: att.attUuid,
        fileName: att.fileName,
        fileData: att.fileData,
        isNew: att.isNew,
        isDeleted: att.isDeleted,
      })),
  };
}

// ========== EDUCATION ==========

export interface LegacyEducation {
  eduUuid?: string;
  dateOfCompletion: string;
  institution: string;
  subjects: string;
  qualifications: string;
  attachments: LegacyAttachment[];
}

export function mapV2EducationToLegacy(v2: any): LegacyEducation {
  return {
    eduUuid: v2?.eduUuid,
    dateOfCompletion: v2?.dateOfCompletion || '',
    institution: v2?.institution || '',
    subjects: v2?.subjectsField || '',
    qualifications: v2?.qualifications || '',
    attachments: (v2?.attachments || []).map((att: any) => ({
      attUuid: att.attUuid,
      fileName: att.fileName || '',
      fileType: att.fileType || '',
      fileSize: att.fileSize || '',
      filePath: att.filePath || '',
      fileData: att.fileData,
    })),
  };
}

export function mapLegacyEducationToV2(legacy: LegacyEducation): any {
  return {
    eduUuid: legacy.eduUuid,
    dateOfCompletion: legacy.dateOfCompletion || undefined,
    institution: legacy.institution || undefined,
    subjectsField: legacy.subjects || undefined,
    qualifications: legacy.qualifications || undefined,
    attachments: legacy.attachments
      .filter(att => att.isNew || att.isDeleted)
      .map(att => ({
        attUuid: att.attUuid,
        fileName: att.fileName,
        fileData: att.fileData,
        isNew: att.isNew,
        isDeleted: att.isDeleted,
      })),
  };
}

// ========== LICENSES ==========

export interface LegacyLicense {
  licUuid?: string;
  licenseId: string;
  certificateName: string;
  abbr: string;
  requirement: string;
  certificateNo: string;
  issuingAuthority: string;
  issuingCountry: string;
  issuedDate: string;
  expiryDate: string;
  archivedAt: string;
  attachments: LegacyAttachment[];
}

export function mapV2LicenseToLegacy(v2: any): LegacyLicense {
  return {
    licUuid: v2?.licUuid,
    licenseId: v2?.licenseId || '',
    certificateName: v2?.certificateDocument || '',
    abbr: v2?.abbr || '',
    requirement: v2?.requirement || '',
    certificateNo: v2?.certificateNo || '',
    issuingAuthority: v2?.issuingAuthority || '',
    issuingCountry: v2?.issuingCountryUuid || '',
    issuedDate: v2?.issued || '',
    expiryDate: v2?.expiry || '',
    archivedAt: v2?.archivedAt || '',
    attachments: (v2?.attachments || []).map((att: any) => ({
      attUuid: att.attUuid,
      fileName: att.fileName || '',
      fileType: att.fileType || '',
      fileSize: att.fileSize || '',
      filePath: att.filePath || '',
      fileData: att.fileData,
    })),
  };
}

export function mapLegacyLicenseToV2(legacy: LegacyLicense): any {
  return {
    licUuid: legacy.licUuid,
    licenseId: legacy.licenseId || undefined,
    certificateDocument: legacy.certificateName || undefined,
    abbr: legacy.abbr || undefined,
    requirement: legacy.requirement || undefined,
    certificateNo: legacy.certificateNo || undefined,
    issuingAuthority: legacy.issuingAuthority || undefined,
    issuingCountryUuid: legacy.issuingCountry || undefined,
    issued: legacy.issuedDate || undefined,
    expiry: legacy.expiryDate || undefined,
    archivedAt: legacy.archivedAt || undefined,
    attachments: legacy.attachments
      .filter(att => att.isNew || att.isDeleted)
      .map(att => ({
        attUuid: att.attUuid,
        fileName: att.fileName,
        fileData: att.fileData,
        isNew: att.isNew,
        isDeleted: att.isDeleted,
      })),
  };
}

// ========== TRAINING COURSES ==========

export interface LegacyTrainingCourse {
  trainUuid?: string;
  courseId: string;
  courseName: string;
  abbr: string;
  requirement: string;
  certificateNo: string;
  issuingAuthority: string;
  issuingCountry: string;
  issuedDate: string;
  expiryDate: string;
  attachments: LegacyAttachment[];
}

export function mapV2TrainingCourseToLegacy(v2: any): LegacyTrainingCourse {
  return {
    trainUuid: v2?.trainUuid,
    courseId: v2?.courseId || '',
    courseName: v2?.trainingCourse || '',
    abbr: v2?.abbr || '',
    requirement: v2?.requirement || '',
    certificateNo: v2?.certificateNo || '',
    issuingAuthority: v2?.issuingAuthority || '',
    issuingCountry: v2?.issuingCountryUuid || '',
    issuedDate: v2?.issued || '',
    expiryDate: v2?.expiry || '',
    attachments: (v2?.attachments || []).map((att: any) => ({
      attUuid: att.attUuid,
      fileName: att.fileName || '',
      fileType: att.fileType || '',
      fileSize: att.fileSize || '',
      filePath: att.filePath || '',
      fileData: att.fileData,
    })),
  };
}

export function mapLegacyTrainingCourseToV2(legacy: LegacyTrainingCourse): any {
  return {
    trainUuid: legacy.trainUuid,
    courseId: legacy.courseId || undefined,
    trainingCourse: legacy.courseName || undefined,
    abbr: legacy.abbr || undefined,
    requirement: legacy.requirement || undefined,
    certificateNo: legacy.certificateNo || undefined,
    issuingAuthority: legacy.issuingAuthority || undefined,
    issuingCountryUuid: legacy.issuingCountry || undefined,
    issued: legacy.issuedDate || undefined,
    expiry: legacy.expiryDate || undefined,
    attachments: legacy.attachments
      .filter(att => att.isNew || att.isDeleted)
      .map(att => ({
        attUuid: att.attUuid,
        fileName: att.fileName,
        fileData: att.fileData,
        isNew: att.isNew,
        isDeleted: att.isDeleted,
      })),
  };
}

// ========== SEA SERVICE ==========

export interface LegacySeaService {
  seaUuid?: string;
  isCompanyService: boolean;
  vesselName: string;
  vesselCode: string;
  vesselType: string;
  deadweight: string;
  engineTypePower: string;
  ownerOperator: string;
  rank: string;
  fromDate: string;
  toDate: string;
  periodMonths: string;
  experienceCategories: string[];
  attachments: LegacyAttachment[];
}

export function mapV2SeaServiceToLegacy(v2: any): LegacySeaService {
  return {
    seaUuid: v2?.seaUuid,
    isCompanyService: v2?.serviceType === 'company',
    vesselName: v2?.vesselName || '',
    vesselCode: v2?.vesselUuid || '',
    vesselType: v2?.vesselTypeUuid || '',
    deadweight: v2?.deadweight || '',
    engineTypePower: v2?.engineTypePower || '',
    ownerOperator: v2?.ownerOperator || '',
    rank: v2?.rank || '',
    fromDate: v2?.fromDate || '',
    toDate: v2?.toDate || '',
    periodMonths: v2?.periodMonths || '',
    experienceCategories: v2?.experienceCategories || [],
    attachments: (v2?.attachments || []).map((att: any) => ({
      attUuid: att.attUuid,
      fileName: att.fileName || '',
      fileType: att.fileType || '',
      fileSize: att.fileSize || '',
      filePath: att.filePath || '',
      fileData: att.fileData,
    })),
  };
}

export function mapLegacySeaServiceToV2(legacy: LegacySeaService): any {
  return {
    seaUuid: legacy.seaUuid,
    serviceType: legacy.isCompanyService ? 'company' : 'external',
    vesselName: legacy.vesselName || undefined,
    vesselUuid: legacy.vesselCode || undefined,
    vesselTypeUuid: legacy.vesselType || undefined,
    deadweight: legacy.deadweight || undefined,
    engineTypePower: legacy.engineTypePower || undefined,
    ownerOperator: legacy.ownerOperator || undefined,
    rank: legacy.rank || undefined,
    fromDate: legacy.fromDate || undefined,
    toDate: legacy.toDate || undefined,
    periodMonths: legacy.periodMonths || undefined,
    experienceCategories: legacy.experienceCategories?.length ? legacy.experienceCategories : undefined,
    attachments: legacy.attachments
      .filter(att => att.isNew || att.isDeleted)
      .map(att => ({
        attUuid: att.attUuid,
        fileName: att.fileName,
        fileData: att.fileData,
        isNew: att.isNew,
        isDeleted: att.isDeleted,
      })),
  };
}

// ========== PRE-JOINING MEDICALS ==========

export interface LegacyPreJoiningMedical {
  medUuid?: string;
  vesselCode: string;
  vesselName: string;
  dateOfMedical: string;
  clinicHospital: string;
  fitnessForDuty: string;
  expiryDate: string;
  attachments: LegacyAttachment[];
}

export function mapV2PreJoiningMedicalToLegacy(v2: any): LegacyPreJoiningMedical {
  return {
    medUuid: v2?.medUuid,
    vesselCode: v2?.vesselUuid || '',
    vesselName: '',
    dateOfMedical: v2?.examinationDate || '',
    clinicHospital: v2?.clinicHospital || '',
    fitnessForDuty: v2?.fitForDuty || '',
    expiryDate: v2?.expiryDate || '',
    attachments: (v2?.attachments || []).map((att: any) => ({
      attUuid: att.attUuid,
      fileName: att.fileName || '',
      fileType: att.fileType || '',
      fileSize: att.fileSize || '',
      filePath: att.filePath || '',
      fileData: att.fileData,
    })),
  };
}

export function mapLegacyPreJoiningMedicalToV2(legacy: LegacyPreJoiningMedical): any {
  return {
    medUuid: legacy.medUuid,
    vesselUuid: legacy.vesselCode || undefined,
    examinationDate: legacy.dateOfMedical || undefined,
    clinicHospital: legacy.clinicHospital || undefined,
    fitForDuty: legacy.fitnessForDuty || undefined,
    expiryDate: legacy.expiryDate || undefined,
    attachments: legacy.attachments
      .filter(att => att.isNew || att.isDeleted)
      .map(att => ({
        attUuid: att.attUuid,
        fileName: att.fileName,
        fileData: att.fileData,
        isNew: att.isNew,
        isDeleted: att.isDeleted,
      })),
  };
}

// ========== DOCTOR VISITS ==========

export interface LegacyDoctorVisit {
  visitUuid?: string;
  visitDate: string;
  doctorName: string;
  clinicHospital: string;
  complaint: string;
  diagnosis: string;
  treatment: string;
  followUpDate: string;
  attachments: LegacyAttachment[];
}

export function mapV2DoctorVisitToLegacy(v2: any): LegacyDoctorVisit {
  return {
    visitUuid: v2?.visitUuid,
    visitDate: v2?.visitDate || '',
    doctorName: v2?.doctorName || '',
    clinicHospital: v2?.clinicHospital || '',
    complaint: v2?.reason || '',
    diagnosis: v2?.diagnosis || '',
    treatment: v2?.treatment || '',
    followUpDate: v2?.followUpDate || '',
    attachments: (v2?.attachments || []).map((att: any) => ({
      attUuid: att.attUuid,
      fileName: att.fileName || '',
      fileType: att.fileType || '',
      fileSize: att.fileSize || '',
      filePath: att.filePath || '',
      fileData: att.fileData,
    })),
  };
}

export function mapLegacyDoctorVisitToV2(legacy: LegacyDoctorVisit): any {
  return {
    visitUuid: legacy.visitUuid,
    visitDate: legacy.visitDate || undefined,
    doctorName: legacy.doctorName || undefined,
    clinicHospital: legacy.clinicHospital || undefined,
    reason: legacy.complaint || undefined,
    diagnosis: legacy.diagnosis || undefined,
    treatment: legacy.treatment || undefined,
    followUpDate: legacy.followUpDate || undefined,
    attachments: legacy.attachments
      .filter(att => att.isNew || att.isDeleted)
      .map(att => ({
        attUuid: att.attUuid,
        fileName: att.fileName,
        fileData: att.fileData,
        isNew: att.isNew,
        isDeleted: att.isDeleted,
      })),
  };
}

// ========== FULL PROFILE MAPPER ==========

/**
 * Maps complete V2 profile response to Legacy FormData format
 * Used when loading crew for editing in CrewInfoForm_v2
 */
export function mapV2FullProfileToLegacy(v2Profile: any): any {
  return {
    // Crew member base
    ...mapV2CrewToLegacy(v2Profile.crew),
    
    // Personal details (flattened into form)
    ...mapV2PersonalDetailsToLegacy(v2Profile.personalDetails),
    
    // Address (flattened into form)
    ...mapV2AddressToLegacy(v2Profile.address),
    
    // Family info (flattened into form)
    ...mapV2FamilyInfoToLegacy(v2Profile.familyInfo),
    
    // Children array
    children: (v2Profile.children || []).map(mapV2ChildToLegacy),
    
    // Next of kin
    nextOfKin: v2Profile.nextOfKin ? mapV2NextOfKinToLegacy(v2Profile.nextOfKin) : null,
    
    // Documents array
    documents: (v2Profile.documents || []).map(mapV2DocumentToLegacy),
    
    // Visas array
    visas: (v2Profile.visas || []).map(mapV2VisaToLegacy),
    
    // Education array
    education: (v2Profile.education || []).map(mapV2EducationToLegacy),
    
    // Licenses array
    licenses: (v2Profile.licenses || []).map(mapV2LicenseToLegacy),
    
    // Training courses array
    trainingCourses: (v2Profile.trainingCourses || []).map(mapV2TrainingCourseToLegacy),
    
    // Sea service (company)
    companySeaService: (v2Profile.seaService || [])
      .filter((s: any) => s.serviceType === 'company')
      .map(mapV2SeaServiceToLegacy),
    
    // Sea service (external)
    externalSeaService: (v2Profile.seaService || [])
      .filter((s: any) => s.serviceType === 'external')
      .map(mapV2SeaServiceToLegacy),
    
    // Pre-joining medicals
    preJoiningMedicals: (v2Profile.preJoiningMedicals || []).map(mapV2PreJoiningMedicalToLegacy),
    
    // Doctor visits
    doctorVisits: (v2Profile.doctorVisits || []).map(mapV2DoctorVisitToLegacy),
    
    // Vessel types applied
    vesselTypesApplied: (v2Profile.vesselTypesApplied || []).map((vt: any) => vt.vesselTypeUuid),
  };
}
```

---

## SECTION 6: V2 Hooks

**File:** `client/src/modules/crew-pool/v2/hooks/useCrewPoolV2.ts`

```typescript
// client/src/modules/crew-pool/v2/hooks/useCrewPoolV2.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crewPoolApiV2 } from '../api/crewPoolApiV2';
import { 
  mapV2CrewToLegacy,
  mapV2FullProfileToLegacy,
  mapLegacyCrewToV2,
  mapLegacyPersonalDetailsToV2,
  mapLegacyAddressToV2,
  mapLegacyFamilyInfoToV2,
  mapLegacyChildToV2,
  mapLegacyNextOfKinToV2,
  mapLegacyDocumentToV2,
  mapLegacyVisaToV2,
  mapLegacyEducationToV2,
  mapLegacyLicenseToV2,
  mapLegacyTrainingCourseToV2,
  mapLegacySeaServiceToV2,
  mapLegacyPreJoiningMedicalToV2,
  mapLegacyDoctorVisitToV2,
} from '../mappers/v2ToLegacyMapper';

/**
 * V2 Hooks that call V2 API and return data in Legacy format
 * Used by CrewPoolModule_v2.tsx and CrewInfoForm_v2.tsx
 */

// ========== CREW LIST ==========

export function useCrewListV2(params?: {
  search?: string;
  rank?: string;
  nationality?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['/api/v2/crew-pool/crew-members', params],
    queryFn: async () => {
      const response = await crewPoolApiV2.getCrewList(params);
      return {
        ...response,
        data: response.data.map(mapV2CrewToLegacy),
      };
    },
  });
}

// ========== CREW BY ID ==========

export function useCrewByIdV2(crewUuid: string | null) {
  return useQuery({
    queryKey: ['/api/v2/crew-pool/crew-members', crewUuid],
    queryFn: async () => {
      if (!crewUuid) return null;
      const response = await crewPoolApiV2.getCrewById(crewUuid);
      return mapV2CrewToLegacy(response);
    },
    enabled: !!crewUuid,
  });
}

// ========== CREW FULL PROFILE ==========

export function useCrewFullProfileV2(crewUuid: string | null) {
  return useQuery({
    queryKey: ['/api/v2/crew-pool/crew-members', crewUuid, 'full-profile'],
    queryFn: async () => {
      if (!crewUuid) return null;
      const response = await crewPoolApiV2.getCrewFullProfile(crewUuid);
      return mapV2FullProfileToLegacy(response);
    },
    enabled: !!crewUuid,
  });
}

// ========== CREATE CREW ==========

export function useCreateCrewV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (legacyData: any) => {
      const v2Data = mapLegacyCrewToV2(legacyData);
      return crewPoolApiV2.createCrew(v2Data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members'] });
    },
  });
}

// ========== UPDATE CREW ==========

export function useUpdateCrewV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any }) => {
      const v2Data = mapLegacyCrewToV2(data);
      return crewPoolApiV2.updateCrew(crewUuid, v2Data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', variables.crewUuid] });
    },
  });
}

// ========== DELETE CREW ==========

export function useDeleteCrewV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (crewUuid: string) => {
      return crewPoolApiV2.deleteCrew(crewUuid);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members'] });
    },
  });
}

// ========== SAVE PERSONAL DETAILS ==========

export function useSavePersonalDetailsV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any }) => {
      const v2Data = mapLegacyPersonalDetailsToV2(data);
      return crewPoolApiV2.savePersonalDetails(crewUuid, v2Data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', variables.crewUuid] });
    },
  });
}

// ========== SAVE ADDRESS ==========

export function useSaveAddressV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any }) => {
      const v2Data = mapLegacyAddressToV2(data);
      return crewPoolApiV2.saveAddress(crewUuid, v2Data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', variables.crewUuid] });
    },
  });
}

// ========== SAVE FAMILY INFO ==========

export function useSaveFamilyInfoV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any }) => {
      const v2Data = mapLegacyFamilyInfoToV2(data);
      return crewPoolApiV2.saveFamilyInfo(crewUuid, v2Data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', variables.crewUuid] });
    },
  });
}

// ========== SAVE CHILDREN ==========

export function useSaveChildrenV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any[] }) => {
      const v2Data = data.map(mapLegacyChildToV2);
      return crewPoolApiV2.saveChildren(crewUuid, v2Data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', variables.crewUuid] });
    },
  });
}

// ========== SAVE NEXT OF KIN ==========

export function useSaveNextOfKinV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any }) => {
      const v2Data = mapLegacyNextOfKinToV2(data);
      return crewPoolApiV2.saveNextOfKin(crewUuid, v2Data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', variables.crewUuid] });
    },
  });
}

// ========== SAVE DOCUMENTS ==========

export function useSaveDocumentsV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any[] }) => {
      const v2Data = data.map(mapLegacyDocumentToV2);
      return crewPoolApiV2.saveDocuments(crewUuid, v2Data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', variables.crewUuid] });
    },
  });
}

// ========== SAVE VISAS ==========

export function useSaveVisasV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any[] }) => {
      const v2Data = data.map(mapLegacyVisaToV2);
      return crewPoolApiV2.saveVisas(crewUuid, v2Data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', variables.crewUuid] });
    },
  });
}

// ========== SAVE EDUCATION ==========

export function useSaveEducationV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any[] }) => {
      const v2Data = data.map(mapLegacyEducationToV2);
      return crewPoolApiV2.saveEducation(crewUuid, v2Data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', variables.crewUuid] });
    },
  });
}

// ========== SAVE LICENSES ==========

export function useSaveLicensesV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any[] }) => {
      const v2Data = data.map(mapLegacyLicenseToV2);
      return crewPoolApiV2.saveLicenses(crewUuid, v2Data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', variables.crewUuid] });
    },
  });
}

// ========== SAVE TRAINING COURSES ==========

export function useSaveTrainingCoursesV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any[] }) => {
      const v2Data = data.map(mapLegacyTrainingCourseToV2);
      return crewPoolApiV2.saveTrainingCourses(crewUuid, v2Data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', variables.crewUuid] });
    },
  });
}

// ========== SAVE SEA SERVICE ==========

export function useSaveSeaServiceV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any[] }) => {
      const v2Data = data.map(mapLegacySeaServiceToV2);
      return crewPoolApiV2.saveSeaService(crewUuid, v2Data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', variables.crewUuid] });
    },
  });
}

// ========== SAVE PRE-JOINING MEDICALS ==========

export function useSavePreJoiningMedicalsV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any[] }) => {
      const v2Data = data.map(mapLegacyPreJoiningMedicalToV2);
      return crewPoolApiV2.savePreJoiningMedicals(crewUuid, v2Data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', variables.crewUuid] });
    },
  });
}

// ========== SAVE DOCTOR VISITS ==========

export function useSaveDoctorVisitsV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any[] }) => {
      const v2Data = data.map(mapLegacyDoctorVisitToV2);
      return crewPoolApiV2.saveDoctorVisits(crewUuid, v2Data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', variables.crewUuid] });
    },
  });
}

// ========== ASSIGN TO VESSEL ==========

export function useAssignToVesselV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any }) => {
      return crewPoolApiV2.assignToVessel(crewUuid, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', variables.crewUuid] });
    },
  });
}

// ========== SIGN OFF ==========

export function useSignOffV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any }) => {
      return crewPoolApiV2.signOff(crewUuid, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', variables.crewUuid] });
    },
  });
}

// ========== SAVE VESSEL TYPES APPLIED ==========

export function useSaveVesselTypesAppliedV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: string[] }) => {
      const v2Data = data.map(vesselTypeUuid => ({ vesselTypeUuid }));
      return crewPoolApiV2.saveVesselTypesApplied(crewUuid, v2Data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', variables.crewUuid] });
    },
  });
}
```

---

## SECTION 7: V2 Module Files

### 7.1 V2 Module Index

**File:** `client/src/modules/crew-pool/v2/index.ts`

```typescript
// client/src/modules/crew-pool/v2/index.ts

export { default as CrewPoolModule_v2 } from './CrewPoolModule_v2';
export { default as CrewInfoForm_v2 } from './CrewInfoForm_v2';
export * from './hooks/useCrewPoolV2';
export * from './api/crewPoolApiV2';
export * from './mappers/v2ToLegacyMapper';
```

### 7.2 CrewPoolModule_v2.tsx Template

After copying `CrewPoolModule.tsx` to `v2/CrewPoolModule_v2.tsx`, make these changes:

```tsx
// client/src/modules/crew-pool/v2/CrewPoolModule_v2.tsx

// 1. Update imports
import { useCrewListV2, useDeleteCrewV2 } from './hooks/useCrewPoolV2';
import { useCrewPoolVersion } from '../hooks/useCrewPoolVersion';
import CrewInfoForm_v2 from './CrewInfoForm_v2';  // Use V2 form
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

// 2. Rename component
export default function CrewPoolModule_v2() {
  // 3. Use V2 hooks
  const { data: crewListData, isLoading } = useCrewListV2(filters);
  const deleteMutation = useDeleteCrewV2();
  
  // 4. Add version toggle
  const { toggleVersion, isV2 } = useCrewPoolVersion();

  return (
    <div>
      {/* 5. Add toggle button in header */}
      <div className="flex items-center justify-between mb-4">
        <h1>Crew Pool</h1>
        <div className="flex items-center gap-2">
          <Label htmlFor="crew-pool-version" className="text-sm text-muted-foreground">
            {isV2 ? 'V2' : 'Legacy'}
          </Label>
          <Switch
            id="crew-pool-version"
            checked={isV2}
            onCheckedChange={toggleVersion}
            data-testid="switch-crew-pool-version"
          />
        </div>
      </div>
      
      {/* Rest of component unchanged, just use V2 hooks */}
      {/* When opening form, use CrewInfoForm_v2 */}
    </div>
  );
}
```

### 7.3 CrewInfoForm_v2.tsx Template

After copying `CrewInfoForm.tsx` to `v2/CrewInfoForm_v2.tsx`, make these changes:

```tsx
// client/src/modules/crew-pool/v2/CrewInfoForm_v2.tsx

// 1. Update imports - use V2 hooks
import {
  useCrewFullProfileV2,
  useSavePersonalDetailsV2,
  useSaveAddressV2,
  useSaveFamilyInfoV2,
  useSaveChildrenV2,
  useSaveNextOfKinV2,
  useSaveDocumentsV2,
  useSaveVisasV2,
  useSaveEducationV2,
  useSaveLicensesV2,
  useSaveTrainingCoursesV2,
  useSaveSeaServiceV2,
  useSavePreJoiningMedicalsV2,
  useSaveDoctorVisitsV2,
  useCreateCrewV2,
  useUpdateCrewV2,
} from './hooks/useCrewPoolV2';

// 2. Rename component
export default function CrewInfoForm_v2({ crewUuid, onClose }: Props) {
  // 3. Use V2 hooks (same interface, returns legacy format)
  const { data: profileData, isLoading } = useCrewFullProfileV2(crewUuid);
  
  const savePersonalDetails = useSavePersonalDetailsV2();
  const saveAddress = useSaveAddressV2();
  const saveFamilyInfo = useSaveFamilyInfoV2();
  const saveChildren = useSaveChildrenV2();
  const saveNextOfKin = useSaveNextOfKinV2();
  const saveDocuments = useSaveDocumentsV2();
  const saveVisas = useSaveVisasV2();
  const saveEducation = useSaveEducationV2();
  const saveLicenses = useSaveLicensesV2();
  const saveTrainingCourses = useSaveTrainingCoursesV2();
  const saveSeaService = useSaveSeaServiceV2();
  const savePreJoiningMedicals = useSavePreJoiningMedicalsV2();
  const saveDoctorVisits = useSaveDoctorVisitsV2();
  const createCrew = useCreateCrewV2();
  const updateCrew = useUpdateCrewV2();
  
  // 4. Rest of component stays the same!
  // Form structure, validation, UI all unchanged
  // Hooks return same data format as legacy
}
```

---

## Checklist

### Folder Structure
- [ ] `v2/` folder created under `crew-pool/`
- [ ] `v2/api/`, `v2/hooks/`, `v2/mappers/` subfolders created

### Feature Toggle
- [ ] `useCrewPoolVersion.ts` hook created
- [ ] Module router (`index.ts`) created
- [ ] Toggle switches between Legacy/V2 modules

### V2 Files Copied
- [ ] `CrewPoolModule.tsx` → `v2/CrewPoolModule_v2.tsx`
- [ ] `CrewInfoForm.tsx` → `v2/CrewInfoForm_v2.tsx`

### V2 Modifications
- [ ] V2 components renamed with `_v2` suffix
- [ ] V2 imports updated to use V2 hooks
- [ ] Toggle button added to V2 header

### API Layer
- [ ] `crewPoolApiV2.ts` with all V2 endpoints

### Mappers
- [ ] `v2ToLegacyMapper.ts` with all entity mappers
- [ ] Bidirectional mapping (V2 ↔ Legacy)

### V2 Hooks
- [ ] `useCrewPoolV2.ts` with all hooks
- [ ] Hooks call V2 API and return Legacy format

### Legacy Unchanged
- [ ] `CrewPoolModule.tsx` - NO modifications
- [ ] `CrewInfoForm.tsx` - NO modifications
- [ ] Legacy hooks - NO modifications

---

## Success Criteria

Phase 7-9 is complete when:
1. Toggle button switches between Legacy/V2 modules
2. Legacy mode uses original files (unchanged)
3. V2 mode uses files from `v2/` folder
4. V2 calls `/api/v2/crew-pool/...` endpoints
5. Same UI appearance for both versions
6. Data displays correctly in both modes
7. Save operations work in both modes
