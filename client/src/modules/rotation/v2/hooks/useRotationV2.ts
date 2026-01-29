import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rotationApiV2, CreateDraftInput, CreateEntryInput, RotationCrewV2 } from '../api/rotationApiV2';

const V2_QUERY_KEY = '/api/v2/rotation';
const V2_STALE_TIME = 60 * 1000;

function getCrewUserId(): string | null {
  try {
    return localStorage.getItem("crewUserId") || null;
  } catch {
    return null;
  }
}

export function useCrewByRankV2(rank: string | null) {
  return useQuery({
    queryKey: [V2_QUERY_KEY, 'crew', 'by-rank', rank],
    queryFn: () => rank ? rotationApiV2.getCrewByRank(rank) : Promise.resolve([]),
    enabled: !!rank,
    staleTime: V2_STALE_TIME,
  });
}

export function useRotationDraftsV2() {
  return useQuery({
    queryKey: [V2_QUERY_KEY, 'drafts'],
    queryFn: () => rotationApiV2.getDrafts(),
    staleTime: V2_STALE_TIME,
  });
}

export function useRotationDraftV2(draftUuid: string | null) {
  return useQuery({
    queryKey: [V2_QUERY_KEY, 'drafts', draftUuid],
    queryFn: () => draftUuid ? rotationApiV2.getDraftById(draftUuid) : Promise.reject('No draft UUID'),
    enabled: !!draftUuid,
    staleTime: V2_STALE_TIME,
  });
}

export function useRotationEntriesV2(draftUuid?: string) {
  return useQuery({
    queryKey: [V2_QUERY_KEY, 'entries', draftUuid],
    queryFn: () => rotationApiV2.getEntries(draftUuid),
    staleTime: V2_STALE_TIME,
  });
}

export function useRotationArchiveV2(filters?: { vesselUuid?: string; result?: string }) {
  return useQuery({
    queryKey: [V2_QUERY_KEY, 'archive', filters],
    queryFn: () => rotationApiV2.getArchive(filters),
    staleTime: V2_STALE_TIME,
  });
}

export function useCreateDraftV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateDraftInput) => rotationApiV2.createDraft({
      ...data,
      createdByUuid: data.createdByUuid || getCrewUserId() || 'unknown',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'drafts'] });
    },
  });
}

export function useUpdateDraftV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ draftUuid, data }: { draftUuid: string; data: any }) => 
      rotationApiV2.updateDraft(draftUuid, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'drafts'] });
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'drafts', variables.draftUuid] });
    },
  });
}

export function useDeleteDraftV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (draftUuid: string) => rotationApiV2.deleteDraft(draftUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'drafts'] });
    },
  });
}

export function useProposeDraftV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (draftUuid: string) => 
      rotationApiV2.proposeDraft(draftUuid, getCrewUserId() || 'unknown'),
    onSuccess: (_, draftUuid) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'drafts'] });
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'drafts', draftUuid] });
    },
  });
}

export function useAddVesselToDraftV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ draftUuid, vesselUuid, sortOrder }: { draftUuid: string; vesselUuid: string; sortOrder?: number }) => 
      rotationApiV2.addVesselToDraft(draftUuid, vesselUuid, sortOrder),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'drafts', variables.draftUuid] });
    },
  });
}

export function useRemoveVesselFromDraftV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ draftUuid, rvUuid }: { draftUuid: string; rvUuid: string }) => 
      rotationApiV2.removeVesselFromDraft(draftUuid, rvUuid),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'drafts', variables.draftUuid] });
    },
  });
}

export function useAddRankToDraftV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ draftUuid, rankName, sortOrder }: { draftUuid: string; rankName: string; sortOrder?: number }) => 
      rotationApiV2.addRankToDraft(draftUuid, rankName, sortOrder),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'drafts', variables.draftUuid] });
    },
  });
}

export function useRemoveRankFromDraftV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ draftUuid, rrUuid }: { draftUuid: string; rrUuid: string }) => 
      rotationApiV2.removeRankFromDraft(draftUuid, rrUuid),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'drafts', variables.draftUuid] });
    },
  });
}

export function useCreateEntryV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateEntryInput) => rotationApiV2.createEntry(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'entries'] });
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'drafts', variables.draftUuid] });
    },
  });
}

export function useUpdateEntryV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ entryUuid, data }: { entryUuid: string; data: any }) => 
      rotationApiV2.updateEntry(entryUuid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'entries'] });
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'drafts'] });
    },
  });
}

export function useDeleteEntryV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (entryUuid: string) => rotationApiV2.deleteEntry(entryUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'entries'] });
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'drafts'] });
    },
  });
}

export function useDeployEntryV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (entryUuid: string) => 
      rotationApiV2.deployEntry(entryUuid, getCrewUserId() || 'unknown'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'entries'] });
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'drafts'] });
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'archive'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/vessel'] });
    },
  });
}

export function useRejectEntryV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ entryUuid, rejectionReason }: { entryUuid: string; rejectionReason: string }) => 
      rotationApiV2.rejectEntry(entryUuid, rejectionReason, getCrewUserId() || 'unknown'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'entries'] });
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'drafts'] });
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'archive'] });
    },
  });
}

export function mapV2CrewToLegacyFormat(crew: RotationCrewV2): {
  id: string;
  name: string;
  rank: string;
  pool?: string;
  nationality?: string;
  nextAvailability?: string | null;
} {
  return {
    id: crew.crewUuid,
    name: crew.fullName || `${crew.firstName} ${crew.familyName}`.trim(),
    rank: crew.presentRank,
    pool: undefined,
    nationality: undefined,
    nextAvailability: crew.nextAvailability,
  };
}
