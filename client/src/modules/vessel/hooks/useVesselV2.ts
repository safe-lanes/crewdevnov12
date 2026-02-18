import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vesselApiV2, CreatePlanningInput, UpdatePlanningInput } from '../api/vesselApiV2';

const V2_QUERY_KEY = '/api/v2/vessel';
const V2_STALE_TIME = 60 * 1000;

function getCrewUserId(): string | null {
  try {
    return localStorage.getItem("crewUserId") || null;
  } catch {
    return null;
  }
}

function withAuditUser<T>(data: T): T {
  const auditUserUuid = getCrewUserId();
  
  if (Array.isArray(data)) {
    return data.map(item => 
      typeof item === 'object' && item !== null 
        ? { ...item, auditUserUuid } 
        : item
    ) as T;
  }
  
  if (typeof data === 'object' && data !== null) {
    return {
      ...data,
      auditUserUuid,
    };
  }
  
  return data;
}

export function useVesselPlanningV2(vesselCode: string | null) {
  return useQuery({
    queryKey: [V2_QUERY_KEY, vesselCode, 'planning'],
    queryFn: () => vesselCode ? vesselApiV2.getVesselPlanning(vesselCode) : Promise.resolve([]),
    enabled: !!vesselCode,
    staleTime: V2_STALE_TIME,
  });
}

export function usePlanningByIdV2(planUuid: string | null) {
  return useQuery({
    queryKey: [V2_QUERY_KEY, 'planning', planUuid],
    queryFn: () => planUuid ? vesselApiV2.getPlanningById(planUuid) : Promise.reject('No plan UUID'),
    enabled: !!planUuid,
    staleTime: V2_STALE_TIME,
  });
}

export function useCreatePlanningV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreatePlanningInput) => vesselApiV2.createPlanning(withAuditUser(data)),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, variables.vesselUuid, 'planning'] });
    },
  });
}

export function useUpdatePlanningV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ planUuid, data }: { planUuid: string; data: UpdatePlanningInput }) => 
      vesselApiV2.updatePlanning(planUuid, withAuditUser(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY] });
    },
  });
}

export function useArchivePlanningV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (planUuid: string) => 
      vesselApiV2.archivePlanning(planUuid, getCrewUserId() || 'unknown'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY] });
    },
  });
}

export function usePlanningAttachmentsV2(planUuid: string | null) {
  return useQuery({
    queryKey: [V2_QUERY_KEY, 'planning', planUuid, 'attachments'],
    queryFn: () => planUuid ? vesselApiV2.getAttachments(planUuid) : Promise.resolve([]),
    enabled: !!planUuid,
    staleTime: V2_STALE_TIME,
  });
}

export function useUploadAttachmentV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ planUuid, file }: { planUuid: string; file: File }) => 
      vesselApiV2.uploadAttachment(planUuid, file, getCrewUserId() || 'unknown'),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'planning', variables.planUuid] });
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'planning', variables.planUuid, 'attachments'] });
    },
  });
}

export function useDeleteAttachmentV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ planUuid, attUuid }: { planUuid: string; attUuid: string }) => 
      vesselApiV2.deleteAttachment(planUuid, attUuid),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'planning', variables.planUuid] });
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'planning', variables.planUuid, 'attachments'] });
    },
  });
}
