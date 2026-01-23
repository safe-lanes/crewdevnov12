import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crewMembersApi } from '../api';
import { mapCrewMemberToForm, mapFormToCrewMember, type CrewMemberFormData } from '../mappers';

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
