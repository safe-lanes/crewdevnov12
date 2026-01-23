# Phase 8: Frontend React Query Hooks

## Context
Phases 1-7 are complete. You have:
- Complete backend with API at `/api/v2/crew-pool/...`
- Frontend API layer in `client/src/modules/crew-pool/v2/api/`
- Mappers in `client/src/modules/crew-pool/v2/mappers/`

## Objective
Create React Query hooks that wrap the API calls with caching, loading states, and mutations. These hooks provide a clean interface for UI components.

## Reference Files (DO NOT MODIFY - use as patterns only)
- `client/src/modules/recruitment-v2/hooks/useRecruitmentV2.ts` - Follow this pattern exactly
- `client/src/modules/recruitment-v2/hooks/useRecruitmentVersion.ts` - Feature toggle pattern

## Files to Create

### Folder: `client/src/modules/crew-pool/v2/hooks/`

### 1. `useCrewPoolVersion.ts` (Feature Toggle)

```typescript
import { useState, useCallback } from 'react';

const STORAGE_KEY = 'crew_pool_version';
type CrewPoolVersion = 'legacy' | 'v2';

export function useCrewPoolVersion() {
  const [version, setVersionState] = useState<CrewPoolVersion>(() => {
    if (typeof window === 'undefined') return 'legacy';
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored === 'v2' ? 'v2' : 'legacy') as CrewPoolVersion;
  });

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

### 2. `useCrewMember.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crewMembersApi } from '../api';
import { mapCrewMemberToForm, mapFormToCrewMember, type CrewMemberFormData } from '../mappers';
import type { CrewMemberV2 } from '@shared/v2/crew-pool/types';

// Query keys for cache management
export const crewMemberKeys = {
  all: ['v2', 'crew-pool', 'crew'] as const,
  lists: () => [...crewMemberKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...crewMemberKeys.lists(), filters] as const,
  details: () => [...crewMemberKeys.all, 'detail'] as const,
  detail: (crewUuid: string) => [...crewMemberKeys.details(), crewUuid] as const,
};

export function useCrewList(filters?: { status?: string; isActive?: boolean; search?: string }) {
  return useQuery({
    queryKey: crewMemberKeys.list(filters),
    queryFn: () => crewMembersApi.getAll(filters),
  });
}

export function useCrewMember(crewUuid: string | null) {
  return useQuery({
    queryKey: crewMemberKeys.detail(crewUuid!),
    queryFn: () => crewMembersApi.getByUuid(crewUuid!),
    enabled: !!crewUuid,
    select: (data) => ({
      crew: data,
      formData: mapCrewMemberToForm(data),
    }),
  });
}

export function useCreateCrewMember() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CrewMemberFormData) => {
      const apiData = mapFormToCrewMember(data);
      return crewMembersApi.create(apiData as Parameters<typeof crewMembersApi.create>[0]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crewMemberKeys.lists() });
    },
  });
}

export function useUpdateCrewMember(crewUuid: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<CrewMemberFormData>) => {
      const apiData = mapFormToCrewMember(data as CrewMemberFormData);
      return crewMembersApi.update(crewUuid, apiData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crewMemberKeys.detail(crewUuid) });
      queryClient.invalidateQueries({ queryKey: crewMemberKeys.lists() });
    },
  });
}

export function useDeleteCrewMember() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (crewUuid: string) => crewMembersApi.delete(crewUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crewMemberKeys.lists() });
    },
  });
}
```

### 3. `useCrewAssignments.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crewAssignmentsApi } from '../api';
import { mapAssignmentToForm, mapFormToAssignment, type AssignmentFormData } from '../mappers';
import { crewMemberKeys } from './useCrewMember';

export const assignmentKeys = {
  all: (crewUuid: string) => [...crewMemberKeys.detail(crewUuid), 'assignments'] as const,
  list: (crewUuid: string) => [...assignmentKeys.all(crewUuid), 'list'] as const,
  current: (crewUuid: string) => [...assignmentKeys.all(crewUuid), 'current'] as const,
};

export function useCrewAssignments(crewUuid: string) {
  return useQuery({
    queryKey: assignmentKeys.list(crewUuid),
    queryFn: () => crewAssignmentsApi.getAll(crewUuid),
    enabled: !!crewUuid,
    select: (data) => data.map(mapAssignmentToForm),
  });
}

export function useCurrentAssignment(crewUuid: string) {
  return useQuery({
    queryKey: assignmentKeys.current(crewUuid),
    queryFn: () => crewAssignmentsApi.getCurrent(crewUuid),
    enabled: !!crewUuid,
    select: (data) => data ? mapAssignmentToForm(data) : null,
  });
}

export function useCreateAssignment(crewUuid: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: AssignmentFormData) => {
      const apiData = mapFormToAssignment(data);
      return crewAssignmentsApi.create(crewUuid, apiData as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assignmentKeys.all(crewUuid) });
    },
  });
}

export function useUpdateAssignment(crewUuid: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ assignUuid, data }: { assignUuid: string; data: Partial<AssignmentFormData> }) => {
      const apiData = mapFormToAssignment(data as AssignmentFormData);
      return crewAssignmentsApi.update(crewUuid, assignUuid, apiData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assignmentKeys.all(crewUuid) });
    },
  });
}

export function useDeleteAssignment(crewUuid: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (assignUuid: string) => crewAssignmentsApi.delete(crewUuid, assignUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assignmentKeys.all(crewUuid) });
    },
  });
}
```

### 4. `useCrewDocuments.ts` (Pattern for section hooks with attachments)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crewDocumentsApi } from '../api';
import { mapDocumentToForm, mapFormToDocument, type DocumentFormData } from '../mappers';
import { crewMemberKeys } from './useCrewMember';

export const documentKeys = {
  all: (crewUuid: string) => [...crewMemberKeys.detail(crewUuid), 'documents'] as const,
  list: (crewUuid: string) => [...documentKeys.all(crewUuid), 'list'] as const,
};

export function useCrewDocuments(crewUuid: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: documentKeys.list(crewUuid),
    queryFn: () => crewDocumentsApi.getAll(crewUuid),
    enabled: !!crewUuid,
    select: (data) => data.map(mapDocumentToForm),
  });

  const createMutation = useMutation({
    mutationFn: (data: DocumentFormData) => {
      const apiData = mapFormToDocument(data);
      return crewDocumentsApi.create(crewUuid, apiData as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.list(crewUuid) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ docUuid, data }: { docUuid: string; data: Partial<DocumentFormData> }) => {
      const apiData = mapFormToDocument(data as DocumentFormData);
      return crewDocumentsApi.update(crewUuid, docUuid, apiData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.list(crewUuid) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (docUuid: string) => crewDocumentsApi.delete(crewUuid, docUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.list(crewUuid) });
    },
  });

  const addAttachmentMutation = useMutation({
    mutationFn: ({ docUuid, file }: { docUuid: string; file: { fileName: string; filePath: string; fileType: string; fileSize: number } }) => 
      crewDocumentsApi.addAttachment(crewUuid, docUuid, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.list(crewUuid) });
    },
  });

  const removeAttachmentMutation = useMutation({
    mutationFn: ({ docUuid, attUuid }: { docUuid: string; attUuid: string }) => 
      crewDocumentsApi.removeAttachment(crewUuid, docUuid, attUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.list(crewUuid) });
    },
  });

  return {
    documents: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    
    add: createMutation,
    update: updateMutation,
    remove: deleteMutation,
    addAttachment: addAttachmentMutation,
    removeAttachment: removeAttachmentMutation,
    
    // Convenience checks
    isMutating: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}
```

### All Hooks to Create

| File | Returns |
|------|---------|
| `useCrewPoolVersion.ts` | Feature toggle |
| `useCrewMember.ts` | `useCrewList`, `useCrewMember`, `useCreateCrewMember`, `useUpdateCrewMember`, `useDeleteCrewMember` |
| `useCrewAssignments.ts` | `useCrewAssignments`, `useCurrentAssignment`, `useCreateAssignment`, `useUpdateAssignment`, `useDeleteAssignment` |
| `useCrewPersonal.ts` | `useCrewPersonal`, `useCrewAddress`, `useUpsertPersonal`, `useUpsertAddress` |
| `useCrewFamily.ts` | `useCrewFamily`, `useUpsertFamily`, `useAddChild`, `useRemoveChild`, `useUpsertNok` |
| `useCrewVesselTypes.ts` | `useCrewVesselTypes`, `useSyncVesselTypes` |
| `useCrewDocuments.ts` | `useCrewDocuments` (consolidated hook with all mutations) |
| `useCrewVisas.ts` | `useCrewVisas` (same pattern) |
| `useCrewEducation.ts` | `useCrewEducation` (same pattern) |
| `useCrewLicenses.ts` | `useCrewLicenses` + archive mutation |
| `useCrewTraining.ts` | `useCrewTraining` (same pattern) |
| `useCrewSeaService.ts` | `useCrewSeaService` (same pattern) |
| `useCrewMedical.ts` | `useCrewMedicals`, `useCrewDoctorVisits` |

### 5. `index.ts`

```typescript
export * from './useCrewPoolVersion';
export * from './useCrewMember';
export * from './useCrewAssignments';
export * from './useCrewPersonal';
export * from './useCrewFamily';
export * from './useCrewVesselTypes';
export * from './useCrewDocuments';
export * from './useCrewVisas';
export * from './useCrewEducation';
export * from './useCrewLicenses';
export * from './useCrewTraining';
export * from './useCrewSeaService';
export * from './useCrewMedical';
```

## Key Patterns

### 1. Query Key Hierarchy
```typescript
// Base keys build on each other
const keys = {
  all: ['v2', 'crew-pool', 'crew'] as const,
  lists: () => [...keys.all, 'list'] as const,
  list: (filters) => [...keys.lists(), filters] as const,
  details: () => [...keys.all, 'detail'] as const,
  detail: (uuid) => [...keys.details(), uuid] as const,
};
```

### 2. Cache Invalidation on Mutations
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: documentKeys.list(crewUuid) });
},
```

### 3. Enabled Flag for Conditional Queries
```typescript
enabled: !!crewUuid,  // Only run if crewUuid is truthy
```

### 4. Select for Data Transformation
```typescript
select: (data) => data.map(mapDocumentToForm),
```

### 5. Consolidated Hook Pattern for Sections
```typescript
// Return object with query data + all mutations
return {
  documents: query.data || [],
  isLoading: query.isLoading,
  add: createMutation,
  update: updateMutation,
  remove: deleteMutation,
  addAttachment: addAttachmentMutation,
  removeAttachment: removeAttachmentMutation,
  isMutating: createMutation.isPending || updateMutation.isPending,
};
```

## Validation Steps

1. TypeScript compiles without errors
2. All hooks use React Query v5 syntax (object form)
3. Cache invalidation works correctly
4. Loading states are exposed
5. Feature toggle persists across page refreshes

## DO NOT
- Use old React Query v4 syntax
- Forget to invalidate cache on mutations
- Skip the enabled flag for optional queries
- Return undefined - return empty array/null
- Forget to export from index.ts

## Success Criteria
- [ ] 13 hook files created
- [ ] Feature toggle hook works
- [ ] All use React Query v5 syntax
- [ ] Cache invalidation on mutations
- [ ] index.ts exports all hooks
