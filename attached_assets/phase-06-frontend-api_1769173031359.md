# Phase 6: Frontend API Layer

## Context
Phases 1-5 are complete. You have:
- Complete backend: Schema, Repositories, Services, Controllers, Routes
- API available at `/api/v2/crew-pool/...`

## Objective
Create the frontend API client layer that makes HTTP requests to the V2 backend endpoints.

## Reference Files (DO NOT MODIFY - use as patterns only)
- `client/src/modules/recruitment-v2/hooks/useRecruitmentV2.ts` - See API call patterns
- `client/src/lib/queryClient.ts` - See how `apiRequest` is used

## Files to Create

### Folder: `client/src/modules/crew-pool/v2/api/`

### 1. `crewMembersApi.ts`

```typescript
import { apiRequest } from '@/lib/queryClient';
import type { CrewMemberV2, InsertCrewMemberV2 } from '@shared/v2/crew-pool/types';

const BASE_URL = '/api/v2/crew-pool';

export const crewMembersApi = {
  getAll: async (filters?: { status?: string; isActive?: boolean; search?: string }): Promise<CrewMemberV2[]> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));
    if (filters?.search) params.append('search', filters.search);
    
    const url = `${BASE_URL}/crew${params.toString() ? `?${params}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch crew');
    return response.json();
  },

  getByUuid: async (crewUuid: string): Promise<CrewMemberV2> => {
    const response = await fetch(`${BASE_URL}/crew/${crewUuid}`);
    if (!response.ok) throw new Error('Failed to fetch crew member');
    return response.json();
  },

  create: async (data: Omit<InsertCrewMemberV2, 'crewUuid'>): Promise<CrewMemberV2> => {
    const response = await apiRequest('POST', `${BASE_URL}/crew`, data);
    return response.json();
  },

  update: async (crewUuid: string, data: Partial<InsertCrewMemberV2>): Promise<CrewMemberV2> => {
    const response = await apiRequest('PATCH', `${BASE_URL}/crew/${crewUuid}`, data);
    return response.json();
  },

  delete: async (crewUuid: string): Promise<void> => {
    await apiRequest('DELETE', `${BASE_URL}/crew/${crewUuid}`);
  },
};
```

### 2. `crewAssignmentsApi.ts`

```typescript
import { apiRequest } from '@/lib/queryClient';
import type { CrewAssignment, InsertCrewAssignment } from '@shared/v2/crew-pool/types';

const BASE_URL = '/api/v2/crew-pool';

export const crewAssignmentsApi = {
  getAll: async (crewUuid: string): Promise<CrewAssignment[]> => {
    const response = await fetch(`${BASE_URL}/crew/${crewUuid}/assignments`);
    if (!response.ok) throw new Error('Failed to fetch assignments');
    return response.json();
  },

  getCurrent: async (crewUuid: string): Promise<CrewAssignment | null> => {
    const response = await fetch(`${BASE_URL}/crew/${crewUuid}/assignments/current`);
    if (!response.ok) throw new Error('Failed to fetch current assignment');
    return response.json();
  },

  create: async (crewUuid: string, data: Omit<InsertCrewAssignment, 'assignUuid' | 'crewUuid'>): Promise<CrewAssignment> => {
    const response = await apiRequest('POST', `${BASE_URL}/crew/${crewUuid}/assignments`, data);
    return response.json();
  },

  update: async (crewUuid: string, assignUuid: string, data: Partial<InsertCrewAssignment>): Promise<CrewAssignment> => {
    const response = await apiRequest('PATCH', `${BASE_URL}/crew/${crewUuid}/assignments/${assignUuid}`, data);
    return response.json();
  },

  delete: async (crewUuid: string, assignUuid: string): Promise<void> => {
    await apiRequest('DELETE', `${BASE_URL}/crew/${crewUuid}/assignments/${assignUuid}`);
  },
};
```

### 3. `crewDocumentsApi.ts` (Pattern for section APIs with attachments)

```typescript
import { apiRequest } from '@/lib/queryClient';
import type { CrewDocument, CrewDocumentAttachment, InsertCrewDocument } from '@shared/v2/crew-pool/types';

const BASE_URL = '/api/v2/crew-pool';

export type DocumentWithAttachments = CrewDocument & { attachments: CrewDocumentAttachment[] };

export const crewDocumentsApi = {
  getAll: async (crewUuid: string): Promise<DocumentWithAttachments[]> => {
    const response = await fetch(`${BASE_URL}/crew/${crewUuid}/documents`);
    if (!response.ok) throw new Error('Failed to fetch documents');
    return response.json();
  },

  create: async (crewUuid: string, data: Omit<InsertCrewDocument, 'docUuid' | 'crewUuid'>): Promise<CrewDocument> => {
    const response = await apiRequest('POST', `${BASE_URL}/crew/${crewUuid}/documents`, data);
    return response.json();
  },

  update: async (crewUuid: string, docUuid: string, data: Partial<InsertCrewDocument>): Promise<CrewDocument> => {
    const response = await apiRequest('PATCH', `${BASE_URL}/crew/${crewUuid}/documents/${docUuid}`, data);
    return response.json();
  },

  delete: async (crewUuid: string, docUuid: string): Promise<void> => {
    await apiRequest('DELETE', `${BASE_URL}/crew/${crewUuid}/documents/${docUuid}`);
  },

  addAttachment: async (crewUuid: string, docUuid: string, data: { fileName: string; filePath: string; fileType: string; fileSize: number }): Promise<CrewDocumentAttachment> => {
    const response = await apiRequest('POST', `${BASE_URL}/crew/${crewUuid}/documents/${docUuid}/attachments`, data);
    return response.json();
  },

  removeAttachment: async (crewUuid: string, docUuid: string, attUuid: string): Promise<void> => {
    await apiRequest('DELETE', `${BASE_URL}/crew/${crewUuid}/documents/${docUuid}/attachments/${attUuid}`);
  },
};
```

### 4. `crewPersonalApi.ts`

```typescript
import { apiRequest } from '@/lib/queryClient';
import type { CrewPersonalDetails, CrewAddress, InsertCrewPersonalDetails, InsertCrewAddress } from '@shared/v2/crew-pool/types';

const BASE_URL = '/api/v2/crew-pool';

export const crewPersonalApi = {
  getPersonal: async (crewUuid: string): Promise<CrewPersonalDetails | null> => {
    const response = await fetch(`${BASE_URL}/crew/${crewUuid}/personal`);
    if (!response.ok) throw new Error('Failed to fetch personal details');
    return response.json();
  },

  upsertPersonal: async (crewUuid: string, data: Omit<InsertCrewPersonalDetails, 'crewUuid'>): Promise<CrewPersonalDetails> => {
    const response = await apiRequest('PUT', `${BASE_URL}/crew/${crewUuid}/personal`, data);
    return response.json();
  },

  getAddress: async (crewUuid: string): Promise<CrewAddress | null> => {
    const response = await fetch(`${BASE_URL}/crew/${crewUuid}/address`);
    if (!response.ok) throw new Error('Failed to fetch address');
    return response.json();
  },

  upsertAddress: async (crewUuid: string, data: Omit<InsertCrewAddress, 'crewUuid'>): Promise<CrewAddress> => {
    const response = await apiRequest('PUT', `${BASE_URL}/crew/${crewUuid}/address`, data);
    return response.json();
  },
};
```

### All API Files to Create

| File | Endpoints |
|------|-----------|
| `crewMembersApi.ts` | getAll, getByUuid, create, update, delete |
| `crewAssignmentsApi.ts` | getAll, getCurrent, create, update, delete |
| `crewPersonalApi.ts` | getPersonal, upsertPersonal, getAddress, upsertAddress |
| `crewFamilyApi.ts` | getFamily, upsertFamily, addChild, removeChild, upsertNok |
| `crewVesselTypesApi.ts` | getAll, sync |
| `crewDocumentsApi.ts` | getAll, create, update, delete, addAttachment, removeAttachment |
| `crewVisasApi.ts` | getAll, create, update, delete, addAttachment, removeAttachment |
| `crewEducationApi.ts` | getAll, create, update, delete, addAttachment, removeAttachment |
| `crewLicensesApi.ts` | getAll, create, update, delete, archive, addAttachment, removeAttachment |
| `crewTrainingApi.ts` | getAll, create, update, delete, addAttachment, removeAttachment |
| `crewSeaServiceApi.ts` | getAll, create, update, delete, addAttachment, removeAttachment |
| `crewMedicalApi.ts` | getMedicals, createMedical, getDoctorVisits, createDoctorVisit, etc. |

### 5. `index.ts`

```typescript
export * from './crewMembersApi';
export * from './crewAssignmentsApi';
export * from './crewPersonalApi';
export * from './crewFamilyApi';
export * from './crewVesselTypesApi';
export * from './crewDocumentsApi';
export * from './crewVisasApi';
export * from './crewEducationApi';
export * from './crewLicensesApi';
export * from './crewTrainingApi';
export * from './crewSeaServiceApi';
export * from './crewMedicalApi';
```

## Key Patterns

### 1. Use apiRequest for mutations (POST/PATCH/DELETE)
```typescript
// For mutations that need JSON body
const response = await apiRequest('POST', url, data);
```

### 2. Use fetch for queries (GET)
```typescript
// For simple GET requests
const response = await fetch(url);
if (!response.ok) throw new Error('Failed to fetch');
return response.json();
```

### 3. Always include crewUuid in path
```typescript
// All section APIs need crewUuid
`${BASE_URL}/crew/${crewUuid}/documents`
```

### 4. Type the return values
```typescript
export type DocumentWithAttachments = CrewDocument & { 
  attachments: CrewDocumentAttachment[] 
};
```

## Validation Steps

1. TypeScript compiles without errors
2. All APIs export from index.ts
3. Import types from `@shared/v2/crew-pool/types`
4. Test a simple API call in browser console

## DO NOT
- Forget to use apiRequest for mutations
- Hardcode different base URLs
- Skip error handling
- Forget to export from index.ts
- Use wrong URL parameter names

## Success Criteria
- [ ] 12 API files created
- [ ] All use correct BASE_URL
- [ ] Types imported from shared
- [ ] index.ts exports all APIs
- [ ] TypeScript compiles without errors
