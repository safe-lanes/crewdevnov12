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
      return crewAssignmentsApi.create(crewUuid, apiData as Parameters<typeof crewAssignmentsApi.create>[1]);
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
