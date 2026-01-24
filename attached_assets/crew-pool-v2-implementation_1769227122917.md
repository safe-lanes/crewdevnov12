# Crew Pool V2 Implementation Guide

## Overview
Upgrade Crew Pool module to V2 architecture using the **exact same API structure, binding, and fetching strategy as Recruitment V2**.

---

## Key Requirements

| Requirement | Approach |
|-------------|----------|
| Masters | Same master data as Recruitment V2 (shared, no new tables) |
| Audit columns | Existing only: `created_at`, `created_by`, `updated_at`, `updated_by` |
| API pattern | Same as Recruitment V2 |
| Fetching | Same hooks pattern as Recruitment V2 |
| Binding | Same `form.reset()` pattern as Recruitment V2 |
| Save | Same reconciliation pattern as Recruitment V2 |
| UI | Copy legacy files, update imports only |

---

## Reference: Recruitment V2 Files to Follow

| Recruitment V2 File | Crew Pool V2 Equivalent |
|---------------------|------------------------|
| `client/src/modules/recruitment-v2/hooks/useRecruitmentV2.ts` | `v2/hooks/useCrewPoolV2.ts` |
| `client/src/modules/recruitment-v2/types/formTypes.ts` | `v2/types/formTypes.ts` |
| `server/modules/recruitment-v2/routes.ts` | `server/modules/crew-pool-v2/routes.ts` |
| `server/modules/recruitment-v2/services/` | `server/modules/crew-pool-v2/services/` |

---

## Part 1: Database Schema (25 Tables)

### Naming Convention
```
Recruitment V2: cand_*
Crew Pool V2:   crew_*_v2
```

### Audit Columns (same as Recruitment V2)
```sql
created_at TIMESTAMPTZ DEFAULT NOW(),
created_by TEXT,
updated_at TIMESTAMPTZ DEFAULT NOW(),
updated_by TEXT
```

### Table 1: crew_members_v2
```sql
CREATE TABLE crew_members_v2 (
  id SERIAL PRIMARY KEY,
  crew_uuid TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  emp_no TEXT,
  employee_id TEXT,
  first_name TEXT,
  middle_name TEXT,
  family_name TEXT,
  gender TEXT,
  dob DATE,
  nationality_uuid TEXT,
  present_rank TEXT,
  rank_applied_for TEXT,
  status TEXT DEFAULT 'active',
  reason TEXT,
  is_active BOOLEAN DEFAULT true,
  uploaded_photo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);
```

### Table 2: crew_personal_details_v2
```sql
CREATE TABLE crew_personal_details_v2 (
  id SERIAL PRIMARY KEY,
  pd_uuid TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  crew_uuid TEXT NOT NULL,
  height_cm TEXT,
  weight_kg TEXT,
  place_of_birth_city TEXT,
  place_of_birth_country_uuid TEXT,
  native_language_uuid TEXT,
  foreign_languages TEXT,
  english_proficiency TEXT,
  manning_agent TEXT,
  availability TEXT,
  next_availability TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);
```

### Table 3: crew_addresses_v2
```sql
CREATE TABLE crew_addresses_v2 (
  id SERIAL PRIMARY KEY,
  addr_uuid TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  crew_uuid TEXT NOT NULL,
  country_of_residence_uuid TEXT,
  nearest_airport TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  contact_landline TEXT,
  mobile TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);
```

### Table 4: crew_family_info_v2
```sql
CREATE TABLE crew_family_info_v2 (
  id SERIAL PRIMARY KEY,
  fam_uuid TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  crew_uuid TEXT NOT NULL,
  marital_status TEXT,
  num_dependent_children TEXT,
  father_name TEXT,
  mother_name TEXT,
  spouse_first_name TEXT,
  spouse_middle_name TEXT,
  spouse_family_name TEXT,
  spouse_dob DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);
```

### Table 5: crew_children_v2
```sql
CREATE TABLE crew_children_v2 (
  id SERIAL PRIMARY KEY,
  child_uuid TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  crew_uuid TEXT NOT NULL,
  first_name TEXT,
  middle_name TEXT,
  family_name TEXT,
  dob DATE,
  gender TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);
```

### Table 6: crew_next_of_kin_v2
```sql
CREATE TABLE crew_next_of_kin_v2 (
  id SERIAL PRIMARY KEY,
  nok_uuid TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  crew_uuid TEXT NOT NULL,
  first_name TEXT,
  middle_name TEXT,
  family_name TEXT,
  telephone TEXT,
  email TEXT,
  address TEXT,
  relationship TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);
```

### Table 7: crew_documents_v2
```sql
CREATE TABLE crew_documents_v2 (
  id SERIAL PRIMARY KEY,
  doc_uuid TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  crew_uuid TEXT NOT NULL,
  document_id TEXT,
  document_name TEXT,
  number TEXT,
  issued DATE,
  expiry DATE,
  issuing_authority TEXT,
  issuing_country_uuid TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);
```

### Table 8: crew_documents_attachments_v2
```sql
CREATE TABLE crew_documents_attachments_v2 (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  doc_uuid TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size TEXT,
  file_path TEXT,
  file_data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);
```

### Table 9: crew_visas_v2
```sql
CREATE TABLE crew_visas_v2 (
  id SERIAL PRIMARY KEY,
  visa_uuid TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  crew_uuid TEXT NOT NULL,
  country_uuid TEXT,
  serial_no TEXT,
  issued DATE,
  expiry DATE,
  visa_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);
```

### Table 10: crew_visas_attachments_v2
```sql
CREATE TABLE crew_visas_attachments_v2 (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  visa_uuid TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size TEXT,
  file_path TEXT,
  file_data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);
```

### Table 11: crew_education_v2
```sql
CREATE TABLE crew_education_v2 (
  id SERIAL PRIMARY KEY,
  edu_uuid TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  crew_uuid TEXT NOT NULL,
  date_of_completion DATE,
  institution TEXT,
  subjects_field TEXT,
  qualifications TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);
```

### Table 12: crew_education_attachments_v2
```sql
CREATE TABLE crew_education_attachments_v2 (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  edu_uuid TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size TEXT,
  file_path TEXT,
  file_data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);
```

### Table 13: crew_licenses_v2
```sql
CREATE TABLE crew_licenses_v2 (
  id SERIAL PRIMARY KEY,
  lic_uuid TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  crew_uuid TEXT NOT NULL,
  license_id TEXT,
  certificate_document TEXT,
  abbr TEXT,
  requirement TEXT,
  certificate_no TEXT,
  issuing_authority TEXT,
  issuing_country_uuid TEXT,
  issued DATE,
  expiry DATE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);
```

### Table 14: crew_licenses_attachments_v2
```sql
CREATE TABLE crew_licenses_attachments_v2 (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  lic_uuid TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size TEXT,
  file_path TEXT,
  file_data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);
```

### Table 15: crew_training_courses_v2
```sql
CREATE TABLE crew_training_courses_v2 (
  id SERIAL PRIMARY KEY,
  train_uuid TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  crew_uuid TEXT NOT NULL,
  course_id TEXT,
  training_course TEXT,
  abbr TEXT,
  requirement TEXT,
  certificate_no TEXT,
  issuing_authority TEXT,
  issuing_country_uuid TEXT,
  issued DATE,
  expiry DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);
```

### Table 16: crew_training_attachments_v2
```sql
CREATE TABLE crew_training_attachments_v2 (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  train_uuid TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size TEXT,
  file_path TEXT,
  file_data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);
```

### Table 17: crew_sea_service_v2
```sql
CREATE TABLE crew_sea_service_v2 (
  id SERIAL PRIMARY KEY,
  sea_uuid TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  crew_uuid TEXT NOT NULL,
  service_type TEXT,
  vessel_name TEXT,
  vessel_uuid TEXT,
  vessel_type_uuid TEXT,
  deadweight TEXT,
  engine_type_power TEXT,
  owner_operator TEXT,
  rank TEXT,
  from_date DATE,
  to_date DATE,
  period_months TEXT,
  experience_categories TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);
```

### Table 18: crew_sea_service_attachments_v2
```sql
CREATE TABLE crew_sea_service_attachments_v2 (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  sea_uuid TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size TEXT,
  file_path TEXT,
  file_data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);
```

### Table 19: crew_pre_joining_medicals_v2
```sql
CREATE TABLE crew_pre_joining_medicals_v2 (
  id SERIAL PRIMARY KEY,
  med_uuid TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  crew_uuid TEXT NOT NULL,
  vessel_uuid TEXT,
  examination_date DATE,
  clinic_hospital TEXT,
  fit_for_duty TEXT,
  expiry_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);
```

### Table 20: crew_pre_joining_medicals_attachments_v2
```sql
CREATE TABLE crew_pre_joining_medicals_attachments_v2 (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  med_uuid TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size TEXT,
  file_path TEXT,
  file_data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);
```

### Table 21: crew_doctor_visits_v2
```sql
CREATE TABLE crew_doctor_visits_v2 (
  id SERIAL PRIMARY KEY,
  visit_uuid TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  crew_uuid TEXT NOT NULL,
  visit_date DATE,
  doctor_name TEXT,
  clinic_hospital TEXT,
  reason TEXT,
  diagnosis TEXT,
  treatment TEXT,
  follow_up_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);
```

### Table 22: crew_doctor_visits_attachments_v2
```sql
CREATE TABLE crew_doctor_visits_attachments_v2 (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  visit_uuid TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size TEXT,
  file_path TEXT,
  file_data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);
```

### Table 23: crew_vessel_types_applied_v2
```sql
CREATE TABLE crew_vessel_types_applied_v2 (
  id SERIAL PRIMARY KEY,
  vta_uuid TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  crew_uuid TEXT NOT NULL,
  vessel_type_uuid TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);
```

### Table 24: crew_assignments_v2
```sql
CREATE TABLE crew_assignments_v2 (
  id SERIAL PRIMARY KEY,
  assign_uuid TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  crew_uuid TEXT NOT NULL,
  vessel_uuid TEXT,
  rank TEXT,
  sign_on_date DATE,
  sign_off_date DATE,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);
```

### Table 25: crew_additional_info_v2
```sql
CREATE TABLE crew_additional_info_v2 (
  id SERIAL PRIMARY KEY,
  add_uuid TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  crew_uuid TEXT NOT NULL,
  remarks TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);
```

---

## Part 2: API Endpoints (Same Pattern as Recruitment V2)

### Route Pattern
```
Recruitment:  /api/v2/recruitment/candidates/:recCanUuid/*
Crew Pool:    /api/v2/crew-pool/crew-members/:crewUuid/*
```

### Full Route List
```
GET    /api/v2/crew-pool/crew-members                           List all
POST   /api/v2/crew-pool/crew-members                           Create new
GET    /api/v2/crew-pool/crew-members/:crewUuid                 Get one
PATCH  /api/v2/crew-pool/crew-members/:crewUuid                 Update
DELETE /api/v2/crew-pool/crew-members/:crewUuid                 Soft delete

GET    /api/v2/crew-pool/crew-members/:crewUuid/full-profile    Get all data

GET    /api/v2/crew-pool/crew-members/:crewUuid/personal-details
PUT    /api/v2/crew-pool/crew-members/:crewUuid/personal-details

GET    /api/v2/crew-pool/crew-members/:crewUuid/address
PUT    /api/v2/crew-pool/crew-members/:crewUuid/address

GET    /api/v2/crew-pool/crew-members/:crewUuid/family-info
PUT    /api/v2/crew-pool/crew-members/:crewUuid/family-info

GET    /api/v2/crew-pool/crew-members/:crewUuid/children
PUT    /api/v2/crew-pool/crew-members/:crewUuid/children

GET    /api/v2/crew-pool/crew-members/:crewUuid/next-of-kin
PUT    /api/v2/crew-pool/crew-members/:crewUuid/next-of-kin

GET    /api/v2/crew-pool/crew-members/:crewUuid/documents
PUT    /api/v2/crew-pool/crew-members/:crewUuid/documents

GET    /api/v2/crew-pool/crew-members/:crewUuid/visas
PUT    /api/v2/crew-pool/crew-members/:crewUuid/visas

GET    /api/v2/crew-pool/crew-members/:crewUuid/education
PUT    /api/v2/crew-pool/crew-members/:crewUuid/education

GET    /api/v2/crew-pool/crew-members/:crewUuid/licenses
PUT    /api/v2/crew-pool/crew-members/:crewUuid/licenses

GET    /api/v2/crew-pool/crew-members/:crewUuid/training-courses
PUT    /api/v2/crew-pool/crew-members/:crewUuid/training-courses

GET    /api/v2/crew-pool/crew-members/:crewUuid/sea-service
PUT    /api/v2/crew-pool/crew-members/:crewUuid/sea-service

GET    /api/v2/crew-pool/crew-members/:crewUuid/pre-joining-medicals
PUT    /api/v2/crew-pool/crew-members/:crewUuid/pre-joining-medicals

GET    /api/v2/crew-pool/crew-members/:crewUuid/doctor-visits
PUT    /api/v2/crew-pool/crew-members/:crewUuid/doctor-visits

GET    /api/v2/crew-pool/crew-members/:crewUuid/vessel-types-applied
PUT    /api/v2/crew-pool/crew-members/:crewUuid/vessel-types-applied

GET    /api/v2/crew-pool/crew-members/:crewUuid/assignments
POST   /api/v2/crew-pool/crew-members/:crewUuid/assign
POST   /api/v2/crew-pool/crew-members/:crewUuid/sign-off
```

---

## Part 3: Backend FK Resolution

### Pattern
Every GET endpoint must JOIN master data and return **both UUID and resolved name**:

```typescript
async getCrewById(crewUuid: string) {
  const result = await db.execute(sql`
    SELECT 
      c.*,
      n.name as nationality_name
    FROM crew_members_v2 c
    LEFT JOIN master_data_entries n ON c.nationality_uuid = n.entry_uuid
    WHERE c.crew_uuid = ${crewUuid}
  `);
  
  return {
    ...result,
    nationalityUuid: result.nationality_uuid,
    nationalityName: result.nationality_name
  };
}
```

### Fields Requiring Resolution

| FK Column | Resolved Field | Source |
|-----------|---------------|--------|
| `nationality_uuid` | `nationalityName` | Master Data 001 |
| `place_of_birth_country_uuid` | `placeOfBirthCountryName` | Master Data 001 |
| `country_of_residence_uuid` | `countryOfResidenceName` | Master Data 001 |
| `native_language_uuid` | `nativeLanguageName` | Languages |
| `issuing_country_uuid` | `issuingCountryName` | Master Data 001 |
| `country_uuid` (visas) | `countryName` | Master Data 001 |
| `vessel_uuid` | `vesselName`, `vesselCode` | Vessels |
| `vessel_type_uuid` | `vesselTypeName` | Master Data 004 |

---

## Part 4: Frontend Structure

### Folder Structure
```
client/src/modules/crew-pool/
├── CrewPoolModule.tsx              # Legacy (UNCHANGED)
├── CrewInfoForm.tsx                # Legacy (UNCHANGED)
├── hooks/
│   ├── useCrewPoolHooks.ts         # Legacy (UNCHANGED)
│   └── useCrewPoolVersion.ts       # Feature toggle
├── v2/
│   ├── CrewPoolModule_v2.tsx       # Copy of legacy
│   ├── CrewInfoForm_v2.tsx         # Copy of legacy
│   ├── api/
│   │   └── crewPoolApiV2.ts
│   ├── hooks/
│   │   └── useCrewPoolV2.ts
│   ├── mappers/
│   │   └── v2ToLegacyMapper.ts
│   ├── types/
│   │   └── formTypes.ts
│   └── index.ts
└── index.ts                        # Module router
```

---

## Part 5: V2 API Client

```typescript
// v2/api/crewPoolApiV2.ts

import { apiRequest } from '@/lib/queryClient';

const V2_BASE = '/api/v2/crew-pool';

export const crewPoolApiV2 = {
  async getCrewList(params?: any) {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.status) searchParams.set('status', params.status);
    const url = `${V2_BASE}/crew-members${searchParams.toString() ? '?' + searchParams : ''}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch');
    return response.json();
  },

  async getCrewById(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}`);
    if (!response.ok) throw new Error('Failed to fetch');
    return response.json();
  },

  async getCrewFullProfile(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/full-profile`);
    if (!response.ok) throw new Error('Failed to fetch');
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

  async getPersonalDetails(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/personal-details`);
    if (!response.ok) throw new Error('Failed to fetch');
    return response.json();
  },

  async savePersonalDetails(crewUuid: string, data: any) {
    return apiRequest('PUT', `${V2_BASE}/crew-members/${crewUuid}/personal-details`, data);
  },

  async getAddress(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/address`);
    if (!response.ok) throw new Error('Failed to fetch');
    return response.json();
  },

  async saveAddress(crewUuid: string, data: any) {
    return apiRequest('PUT', `${V2_BASE}/crew-members/${crewUuid}/address`, data);
  },

  async getFamilyInfo(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/family-info`);
    if (!response.ok) throw new Error('Failed to fetch');
    return response.json();
  },

  async saveFamilyInfo(crewUuid: string, data: any) {
    return apiRequest('PUT', `${V2_BASE}/crew-members/${crewUuid}/family-info`, data);
  },

  async getChildren(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/children`);
    if (!response.ok) throw new Error('Failed to fetch');
    return response.json();
  },

  async saveChildren(crewUuid: string, data: any[]) {
    return apiRequest('PUT', `${V2_BASE}/crew-members/${crewUuid}/children`, data);
  },

  async getNextOfKin(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/next-of-kin`);
    if (!response.ok) throw new Error('Failed to fetch');
    return response.json();
  },

  async saveNextOfKin(crewUuid: string, data: any) {
    return apiRequest('PUT', `${V2_BASE}/crew-members/${crewUuid}/next-of-kin`, data);
  },

  async getDocuments(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/documents`);
    if (!response.ok) throw new Error('Failed to fetch');
    return response.json();
  },

  async saveDocuments(crewUuid: string, data: any[]) {
    return apiRequest('PUT', `${V2_BASE}/crew-members/${crewUuid}/documents`, data);
  },

  async getVisas(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/visas`);
    if (!response.ok) throw new Error('Failed to fetch');
    return response.json();
  },

  async saveVisas(crewUuid: string, data: any[]) {
    return apiRequest('PUT', `${V2_BASE}/crew-members/${crewUuid}/visas`, data);
  },

  async getEducation(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/education`);
    if (!response.ok) throw new Error('Failed to fetch');
    return response.json();
  },

  async saveEducation(crewUuid: string, data: any[]) {
    return apiRequest('PUT', `${V2_BASE}/crew-members/${crewUuid}/education`, data);
  },

  async getLicenses(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/licenses`);
    if (!response.ok) throw new Error('Failed to fetch');
    return response.json();
  },

  async saveLicenses(crewUuid: string, data: any[]) {
    return apiRequest('PUT', `${V2_BASE}/crew-members/${crewUuid}/licenses`, data);
  },

  async getTrainingCourses(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/training-courses`);
    if (!response.ok) throw new Error('Failed to fetch');
    return response.json();
  },

  async saveTrainingCourses(crewUuid: string, data: any[]) {
    return apiRequest('PUT', `${V2_BASE}/crew-members/${crewUuid}/training-courses`, data);
  },

  async getSeaService(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/sea-service`);
    if (!response.ok) throw new Error('Failed to fetch');
    return response.json();
  },

  async saveSeaService(crewUuid: string, data: any[]) {
    return apiRequest('PUT', `${V2_BASE}/crew-members/${crewUuid}/sea-service`, data);
  },

  async getPreJoiningMedicals(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/pre-joining-medicals`);
    if (!response.ok) throw new Error('Failed to fetch');
    return response.json();
  },

  async savePreJoiningMedicals(crewUuid: string, data: any[]) {
    return apiRequest('PUT', `${V2_BASE}/crew-members/${crewUuid}/pre-joining-medicals`, data);
  },

  async getDoctorVisits(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/doctor-visits`);
    if (!response.ok) throw new Error('Failed to fetch');
    return response.json();
  },

  async saveDoctorVisits(crewUuid: string, data: any[]) {
    return apiRequest('PUT', `${V2_BASE}/crew-members/${crewUuid}/doctor-visits`, data);
  },

  async getVesselTypesApplied(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew-members/${crewUuid}/vessel-types-applied`);
    if (!response.ok) throw new Error('Failed to fetch');
    return response.json();
  },

  async saveVesselTypesApplied(crewUuid: string, data: any[]) {
    return apiRequest('PUT', `${V2_BASE}/crew-members/${crewUuid}/vessel-types-applied`, data);
  },
};
```

---

## Part 6: V2 Hooks (Same Pattern as Recruitment V2)

```typescript
// v2/hooks/useCrewPoolV2.ts

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

export function useCrewListV2(filters?: any) {
  return useQuery({
    queryKey: ['/api/v2/crew-pool/crew-members', filters],
    queryFn: async () => {
      const response = await crewPoolApiV2.getCrewList(filters);
      return {
        ...response,
        data: response.data.map(mapV2CrewToLegacy),
      };
    },
  });
}

export function useCrewFullProfileV2(crewUuid: string | null) {
  return useQuery({
    queryKey: ['/api/v2/crew-pool/crew-members', crewUuid, 'full-profile'],
    queryFn: async () => {
      const response = await crewPoolApiV2.getCrewFullProfile(crewUuid!);
      return mapV2FullProfileToLegacy(response);
    },
    enabled: !!crewUuid,
  });
}

export function useCreateCrewV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const v2Data = mapLegacyCrewToV2(data);
      return crewPoolApiV2.createCrew(v2Data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members'] });
    },
  });
}

export function useUpdateCrewV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any }) => {
      const v2Data = mapLegacyCrewToV2(data);
      return crewPoolApiV2.updateCrew(crewUuid, v2Data);
    },
    onSuccess: (_, { crewUuid }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', crewUuid] });
    },
  });
}

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

export function useSavePersonalDetailsV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any }) => {
      const v2Data = mapLegacyPersonalDetailsToV2(data);
      return crewPoolApiV2.savePersonalDetails(crewUuid, v2Data);
    },
    onSuccess: (_, { crewUuid }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', crewUuid] });
    },
  });
}

export function useSaveAddressV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any }) => {
      const v2Data = mapLegacyAddressToV2(data);
      return crewPoolApiV2.saveAddress(crewUuid, v2Data);
    },
    onSuccess: (_, { crewUuid }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', crewUuid] });
    },
  });
}

export function useSaveFamilyInfoV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any }) => {
      const v2Data = mapLegacyFamilyInfoToV2(data);
      return crewPoolApiV2.saveFamilyInfo(crewUuid, v2Data);
    },
    onSuccess: (_, { crewUuid }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', crewUuid] });
    },
  });
}

export function useSaveChildrenV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any[] }) => {
      const v2Data = data.map(mapLegacyChildToV2);
      return crewPoolApiV2.saveChildren(crewUuid, v2Data);
    },
    onSuccess: (_, { crewUuid }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', crewUuid] });
    },
  });
}

export function useSaveNextOfKinV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any }) => {
      const v2Data = mapLegacyNextOfKinToV2(data);
      return crewPoolApiV2.saveNextOfKin(crewUuid, v2Data);
    },
    onSuccess: (_, { crewUuid }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', crewUuid] });
    },
  });
}

export function useSaveDocumentsV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any[] }) => {
      const v2Data = data.map(mapLegacyDocumentToV2);
      return crewPoolApiV2.saveDocuments(crewUuid, v2Data);
    },
    onSuccess: (_, { crewUuid }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', crewUuid] });
    },
  });
}

export function useSaveVisasV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any[] }) => {
      const v2Data = data.map(mapLegacyVisaToV2);
      return crewPoolApiV2.saveVisas(crewUuid, v2Data);
    },
    onSuccess: (_, { crewUuid }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', crewUuid] });
    },
  });
}

export function useSaveEducationV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any[] }) => {
      const v2Data = data.map(mapLegacyEducationToV2);
      return crewPoolApiV2.saveEducation(crewUuid, v2Data);
    },
    onSuccess: (_, { crewUuid }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', crewUuid] });
    },
  });
}

export function useSaveLicensesV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any[] }) => {
      const v2Data = data.map(mapLegacyLicenseToV2);
      return crewPoolApiV2.saveLicenses(crewUuid, v2Data);
    },
    onSuccess: (_, { crewUuid }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', crewUuid] });
    },
  });
}

export function useSaveTrainingCoursesV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any[] }) => {
      const v2Data = data.map(mapLegacyTrainingCourseToV2);
      return crewPoolApiV2.saveTrainingCourses(crewUuid, v2Data);
    },
    onSuccess: (_, { crewUuid }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', crewUuid] });
    },
  });
}

export function useSaveSeaServiceV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any[] }) => {
      const v2Data = data.map(mapLegacySeaServiceToV2);
      return crewPoolApiV2.saveSeaService(crewUuid, v2Data);
    },
    onSuccess: (_, { crewUuid }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', crewUuid] });
    },
  });
}

export function useSavePreJoiningMedicalsV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any[] }) => {
      const v2Data = data.map(mapLegacyPreJoiningMedicalToV2);
      return crewPoolApiV2.savePreJoiningMedicals(crewUuid, v2Data);
    },
    onSuccess: (_, { crewUuid }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', crewUuid] });
    },
  });
}

export function useSaveDoctorVisitsV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any[] }) => {
      const v2Data = data.map(mapLegacyDoctorVisitToV2);
      return crewPoolApiV2.saveDoctorVisits(crewUuid, v2Data);
    },
    onSuccess: (_, { crewUuid }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', crewUuid] });
    },
  });
}

export function useSaveVesselTypesAppliedV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: string[] }) => {
      const v2Data = data.map(vesselTypeUuid => ({ vesselTypeUuid }));
      return crewPoolApiV2.saveVesselTypesApplied(crewUuid, v2Data);
    },
    onSuccess: (_, { crewUuid }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew-members', crewUuid] });
    },
  });
}
```

---

## Part 7: Mappers (V2 to Legacy)

```typescript
// v2/mappers/v2ToLegacyMapper.ts

// CREW MEMBER
export function mapV2CrewToLegacy(v2: any) {
  return {
    id: v2.id,
    crewUuid: v2.crewUuid,
    empNo: v2.empNo || '',
    employeeId: v2.employeeId || '',
    firstName: v2.firstName || '',
    middleName: v2.middleName || '',
    familyName: v2.familyName || '',
    gender: v2.gender || '',
    dateOfBirth: v2.dob || '',
    nationality: v2.nationalityName || '',
    nationalityUuid: v2.nationalityUuid || '',
    presentRank: v2.presentRank || '',
    rankAppliedFor: v2.rankAppliedFor || '',
    status: v2.status || 'active',
    reason: v2.reason || '',
    isActive: v2.isActive ?? true,
    uploadedPhoto: v2.uploadedPhoto || '',
  };
}

export function mapLegacyCrewToV2(legacy: any) {
  return {
    empNo: legacy.empNo || undefined,
    employeeId: legacy.employeeId || undefined,
    firstName: legacy.firstName || undefined,
    middleName: legacy.middleName || undefined,
    familyName: legacy.familyName || undefined,
    gender: legacy.gender || undefined,
    dob: legacy.dateOfBirth || undefined,
    nationalityUuid: legacy.nationalityUuid || undefined,
    presentRank: legacy.presentRank || undefined,
    rankAppliedFor: legacy.rankAppliedFor || undefined,
    status: legacy.status || undefined,
    reason: legacy.reason || undefined,
    isActive: legacy.isActive,
    uploadedPhoto: legacy.uploadedPhoto || undefined,
  };
}

// PERSONAL DETAILS
export function mapV2PersonalDetailsToLegacy(v2: any) {
  return {
    height: v2?.heightCm || '',
    weight: v2?.weightKg || '',
    placeOfBirthCity: v2?.placeOfBirthCity || '',
    placeOfBirthCountry: v2?.placeOfBirthCountryName || '',
    placeOfBirthCountryUuid: v2?.placeOfBirthCountryUuid || '',
    nativeLanguage: v2?.nativeLanguageName || '',
    nativeLanguageUuid: v2?.nativeLanguageUuid || '',
    foreignLanguages: v2?.foreignLanguages || '',
    englishProficiency: v2?.englishProficiency || '',
    manningAgent: v2?.manningAgent || '',
    availability: v2?.availability || '',
    nextAvailability: v2?.nextAvailability || '',
  };
}

export function mapLegacyPersonalDetailsToV2(legacy: any) {
  return {
    heightCm: legacy.height || undefined,
    weightKg: legacy.weight || undefined,
    placeOfBirthCity: legacy.placeOfBirthCity || undefined,
    placeOfBirthCountryUuid: legacy.placeOfBirthCountryUuid || undefined,
    nativeLanguageUuid: legacy.nativeLanguageUuid || undefined,
    foreignLanguages: legacy.foreignLanguages || undefined,
    englishProficiency: legacy.englishProficiency || undefined,
    manningAgent: legacy.manningAgent || undefined,
    availability: legacy.availability || undefined,
    nextAvailability: legacy.nextAvailability || undefined,
  };
}

// ADDRESS
export function mapV2AddressToLegacy(v2: any) {
  return {
    countryOfResidence: v2?.countryOfResidenceName || '',
    countryOfResidenceUuid: v2?.countryOfResidenceUuid || '',
    nearestAirport: v2?.nearestAirport || '',
    residentialAddressLine1: v2?.addressLine1 || '',
    residentialAddressLine2: v2?.addressLine2 || '',
    contactLandline: v2?.contactLandline || '',
    mobile: v2?.mobile || '',
    email: v2?.email || '',
  };
}

export function mapLegacyAddressToV2(legacy: any) {
  return {
    countryOfResidenceUuid: legacy.countryOfResidenceUuid || undefined,
    nearestAirport: legacy.nearestAirport || undefined,
    addressLine1: legacy.residentialAddressLine1 || undefined,
    addressLine2: legacy.residentialAddressLine2 || undefined,
    contactLandline: legacy.contactLandline || undefined,
    mobile: legacy.mobile || undefined,
    email: legacy.email || undefined,
  };
}

// FAMILY INFO
export function mapV2FamilyInfoToLegacy(v2: any) {
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

export function mapLegacyFamilyInfoToV2(legacy: any) {
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

// CHILDREN
export function mapV2ChildToLegacy(v2: any) {
  return {
    childUuid: v2?.childUuid,
    firstName: v2?.firstName || '',
    middleName: v2?.middleName || '',
    familyName: v2?.familyName || '',
    dateOfBirth: v2?.dob || '',
    gender: v2?.gender || '',
  };
}

export function mapLegacyChildToV2(legacy: any) {
  return {
    childUuid: legacy.childUuid,
    firstName: legacy.firstName || undefined,
    middleName: legacy.middleName || undefined,
    familyName: legacy.familyName || undefined,
    dob: legacy.dateOfBirth || undefined,
    gender: legacy.gender || undefined,
  };
}

// NEXT OF KIN
export function mapV2NextOfKinToLegacy(v2: any) {
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

export function mapLegacyNextOfKinToV2(legacy: any) {
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

// DOCUMENTS
export function mapV2DocumentToLegacy(v2: any) {
  return {
    docUuid: v2?.docUuid,
    documentId: v2?.documentId || '',
    documentName: v2?.documentName || '',
    documentNumber: v2?.number || '',
    issuedDate: v2?.issued || '',
    expiryDate: v2?.expiry || '',
    issuingAuthority: v2?.issuingAuthority || '',
    issuingCountry: v2?.issuingCountryName || '',
    issuingCountryUuid: v2?.issuingCountryUuid || '',
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

export function mapLegacyDocumentToV2(legacy: any) {
  return {
    docUuid: legacy.docUuid,
    documentId: legacy.documentId || undefined,
    documentName: legacy.documentName || undefined,
    number: legacy.documentNumber || undefined,
    issued: legacy.issuedDate || undefined,
    expiry: legacy.expiryDate || undefined,
    issuingAuthority: legacy.issuingAuthority || undefined,
    issuingCountryUuid: legacy.issuingCountryUuid || undefined,
    attachments: legacy.attachments?.filter((att: any) => att.isNew || att.isDeleted),
  };
}

// VISAS
export function mapV2VisaToLegacy(v2: any) {
  return {
    visaUuid: v2?.visaUuid,
    country: v2?.countryName || '',
    countryUuid: v2?.countryUuid || '',
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

export function mapLegacyVisaToV2(legacy: any) {
  return {
    visaUuid: legacy.visaUuid,
    countryUuid: legacy.countryUuid || undefined,
    serialNo: legacy.serialNo || undefined,
    issued: legacy.issuedDate || undefined,
    expiry: legacy.expiryDate || undefined,
    visaType: legacy.visaType || undefined,
    attachments: legacy.attachments?.filter((att: any) => att.isNew || att.isDeleted),
  };
}

// EDUCATION
export function mapV2EducationToLegacy(v2: any) {
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

export function mapLegacyEducationToV2(legacy: any) {
  return {
    eduUuid: legacy.eduUuid,
    dateOfCompletion: legacy.dateOfCompletion || undefined,
    institution: legacy.institution || undefined,
    subjectsField: legacy.subjects || undefined,
    qualifications: legacy.qualifications || undefined,
    attachments: legacy.attachments?.filter((att: any) => att.isNew || att.isDeleted),
  };
}

// LICENSES
export function mapV2LicenseToLegacy(v2: any) {
  return {
    licUuid: v2?.licUuid,
    licenseId: v2?.licenseId || '',
    certificateName: v2?.certificateDocument || '',
    abbr: v2?.abbr || '',
    requirement: v2?.requirement || '',
    certificateNo: v2?.certificateNo || '',
    issuingAuthority: v2?.issuingAuthority || '',
    issuingCountry: v2?.issuingCountryName || '',
    issuingCountryUuid: v2?.issuingCountryUuid || '',
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

export function mapLegacyLicenseToV2(legacy: any) {
  return {
    licUuid: legacy.licUuid,
    licenseId: legacy.licenseId || undefined,
    certificateDocument: legacy.certificateName || undefined,
    abbr: legacy.abbr || undefined,
    requirement: legacy.requirement || undefined,
    certificateNo: legacy.certificateNo || undefined,
    issuingAuthority: legacy.issuingAuthority || undefined,
    issuingCountryUuid: legacy.issuingCountryUuid || undefined,
    issued: legacy.issuedDate || undefined,
    expiry: legacy.expiryDate || undefined,
    archivedAt: legacy.archivedAt || undefined,
    attachments: legacy.attachments?.filter((att: any) => att.isNew || att.isDeleted),
  };
}

// TRAINING COURSES
export function mapV2TrainingCourseToLegacy(v2: any) {
  return {
    trainUuid: v2?.trainUuid,
    courseId: v2?.courseId || '',
    courseName: v2?.trainingCourse || '',
    abbr: v2?.abbr || '',
    requirement: v2?.requirement || '',
    certificateNo: v2?.certificateNo || '',
    issuingAuthority: v2?.issuingAuthority || '',
    issuingCountry: v2?.issuingCountryName || '',
    issuingCountryUuid: v2?.issuingCountryUuid || '',
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

export function mapLegacyTrainingCourseToV2(legacy: any) {
  return {
    trainUuid: legacy.trainUuid,
    courseId: legacy.courseId || undefined,
    trainingCourse: legacy.courseName || undefined,
    abbr: legacy.abbr || undefined,
    requirement: legacy.requirement || undefined,
    certificateNo: legacy.certificateNo || undefined,
    issuingAuthority: legacy.issuingAuthority || undefined,
    issuingCountryUuid: legacy.issuingCountryUuid || undefined,
    issued: legacy.issuedDate || undefined,
    expiry: legacy.expiryDate || undefined,
    attachments: legacy.attachments?.filter((att: any) => att.isNew || att.isDeleted),
  };
}

// SEA SERVICE
export function mapV2SeaServiceToLegacy(v2: any) {
  return {
    seaUuid: v2?.seaUuid,
    isCompanyService: v2?.serviceType === 'company',
    vesselName: v2?.vesselName || '',
    vesselCode: v2?.vesselCode || '',
    vesselUuid: v2?.vesselUuid || '',
    vesselType: v2?.vesselTypeName || '',
    vesselTypeUuid: v2?.vesselTypeUuid || '',
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

export function mapLegacySeaServiceToV2(legacy: any) {
  return {
    seaUuid: legacy.seaUuid,
    serviceType: legacy.isCompanyService ? 'company' : 'external',
    vesselName: legacy.vesselName || undefined,
    vesselUuid: legacy.vesselUuid || undefined,
    vesselTypeUuid: legacy.vesselTypeUuid || undefined,
    deadweight: legacy.deadweight || undefined,
    engineTypePower: legacy.engineTypePower || undefined,
    ownerOperator: legacy.ownerOperator || undefined,
    rank: legacy.rank || undefined,
    fromDate: legacy.fromDate || undefined,
    toDate: legacy.toDate || undefined,
    periodMonths: legacy.periodMonths || undefined,
    experienceCategories: legacy.experienceCategories || undefined,
    attachments: legacy.attachments?.filter((att: any) => att.isNew || att.isDeleted),
  };
}

// PRE-JOINING MEDICALS
export function mapV2PreJoiningMedicalToLegacy(v2: any) {
  return {
    medUuid: v2?.medUuid,
    vesselCode: v2?.vesselCode || '',
    vesselName: v2?.vesselName || '',
    vesselUuid: v2?.vesselUuid || '',
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

export function mapLegacyPreJoiningMedicalToV2(legacy: any) {
  return {
    medUuid: legacy.medUuid,
    vesselUuid: legacy.vesselUuid || undefined,
    examinationDate: legacy.dateOfMedical || undefined,
    clinicHospital: legacy.clinicHospital || undefined,
    fitForDuty: legacy.fitnessForDuty || undefined,
    expiryDate: legacy.expiryDate || undefined,
    attachments: legacy.attachments?.filter((att: any) => att.isNew || att.isDeleted),
  };
}

// DOCTOR VISITS
export function mapV2DoctorVisitToLegacy(v2: any) {
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

export function mapLegacyDoctorVisitToV2(legacy: any) {
  return {
    visitUuid: legacy.visitUuid,
    visitDate: legacy.visitDate || undefined,
    doctorName: legacy.doctorName || undefined,
    clinicHospital: legacy.clinicHospital || undefined,
    reason: legacy.complaint || undefined,
    diagnosis: legacy.diagnosis || undefined,
    treatment: legacy.treatment || undefined,
    followUpDate: legacy.followUpDate || undefined,
    attachments: legacy.attachments?.filter((att: any) => att.isNew || att.isDeleted),
  };
}

// FULL PROFILE
export function mapV2FullProfileToLegacy(v2Profile: any) {
  return {
    ...mapV2CrewToLegacy(v2Profile.crew),
    ...mapV2PersonalDetailsToLegacy(v2Profile.personalDetails),
    ...mapV2AddressToLegacy(v2Profile.address),
    ...mapV2FamilyInfoToLegacy(v2Profile.familyInfo),
    children: (v2Profile.children || []).map(mapV2ChildToLegacy),
    nextOfKin: v2Profile.nextOfKin ? mapV2NextOfKinToLegacy(v2Profile.nextOfKin) : null,
    documents: (v2Profile.documents || []).map(mapV2DocumentToLegacy),
    visas: (v2Profile.visas || []).map(mapV2VisaToLegacy),
    education: (v2Profile.education || []).map(mapV2EducationToLegacy),
    licenses: (v2Profile.licenses || []).map(mapV2LicenseToLegacy),
    trainingCourses: (v2Profile.trainingCourses || []).map(mapV2TrainingCourseToLegacy),
    companySeaService: (v2Profile.seaService || [])
      .filter((s: any) => s.serviceType === 'company')
      .map(mapV2SeaServiceToLegacy),
    externalSeaService: (v2Profile.seaService || [])
      .filter((s: any) => s.serviceType === 'external')
      .map(mapV2SeaServiceToLegacy),
    preJoiningMedicals: (v2Profile.preJoiningMedicals || []).map(mapV2PreJoiningMedicalToLegacy),
    doctorVisits: (v2Profile.doctorVisits || []).map(mapV2DoctorVisitToLegacy),
    vesselTypesApplied: (v2Profile.vesselTypesApplied || []).map((vt: any) => vt.vesselTypeUuid),
  };
}
```

---

## Part 8: Feature Toggle Hook

```typescript
// hooks/useCrewPoolVersion.ts

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'crew_pool_version';

export type CrewPoolVersion = 'legacy' | 'v2';

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

## Part 9: Module Router

```typescript
// index.ts

import { lazy, Suspense } from 'react';
import { useCrewPoolVersion } from './hooks/useCrewPoolVersion';

const CrewPoolModuleLegacy = lazy(() => import('./CrewPoolModule'));
const CrewPoolModuleV2 = lazy(() => import('./v2/CrewPoolModule_v2'));

export function CrewPoolModuleRouter() {
  const { isV2 } = useCrewPoolVersion();

  return (
    <Suspense fallback={<div className="p-4">Loading...</div>}>
      {isV2 ? <CrewPoolModuleV2 /> : <CrewPoolModuleLegacy />}
    </Suspense>
  );
}

export { useCrewPoolVersion } from './hooks/useCrewPoolVersion';
```

---

## Part 10: Implementation Steps

1. **Create V2 database tables** (25 tables in schema.ts)
2. **Create SQL migrations** for all tables
3. **Create V2 API routes** (same pattern as Recruitment V2)
4. **Add FK resolution** in service layer (JOINs for display names)
5. **Create frontend v2/ folder** with structure above
6. **Create API client** (crewPoolApiV2.ts)
7. **Create mappers** (v2ToLegacyMapper.ts)
8. **Create hooks** (useCrewPoolV2.ts)
9. **Copy legacy UI files** to v2/ folder
10. **Update V2 imports** to use V2 hooks
11. **Create feature toggle** (useCrewPoolVersion.ts)
12. **Create module router** (index.ts)
13. **Test both modes**

---

## Summary

| Layer | V2 Implementation |
|-------|------------------|
| Database | 25 normalized tables with FK relationships |
| API | Same pattern as Recruitment V2 |
| FK Resolution | Backend JOINs return both UUID and name |
| API Client | Calls V2 endpoints |
| Hooks | Fetch V2, return legacy format via mappers |
| Mappers | V2 to Legacy bidirectional conversion |
| UI | Copy of legacy, import changes only |
| Toggle | localStorage-based version switch |
