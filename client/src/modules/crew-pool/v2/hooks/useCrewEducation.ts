import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crewEducationApi } from '../api';
import { mapEducationsToForm, mapFormToEducation, type EducationFormData } from '../mappers';
import { crewMemberKeys } from './useCrewMember';

export const educationKeys = {
  all: (crewUuid: string) => [...crewMemberKeys.detail(crewUuid), 'education'] as const,
  list: (crewUuid: string) => [...educationKeys.all(crewUuid), 'list'] as const,
};

export function useCrewEducation(crewUuid: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: educationKeys.list(crewUuid),
    queryFn: () => crewEducationApi.getAll(crewUuid),
    enabled: !!crewUuid,
    select: (data) => mapEducationsToForm(data),
  });

  const createMutation = useMutation({
    mutationFn: (data: EducationFormData) => {
      const apiData = mapFormToEducation(data);
      return crewEducationApi.create(crewUuid, apiData as Parameters<typeof crewEducationApi.create>[1]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: educationKeys.list(crewUuid) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ eduUuid, data }: { eduUuid: string; data: Partial<EducationFormData> }) => {
      const apiData = mapFormToEducation(data as EducationFormData);
      return crewEducationApi.update(crewUuid, eduUuid, apiData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: educationKeys.list(crewUuid) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (eduUuid: string) => crewEducationApi.delete(crewUuid, eduUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: educationKeys.list(crewUuid) });
    },
  });

  const addAttachmentMutation = useMutation({
    mutationFn: ({ eduUuid, file }: { eduUuid: string; file: { fileName: string; filePath: string; fileType: string; fileSize: string } }) =>
      crewEducationApi.addAttachment(crewUuid, eduUuid, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: educationKeys.list(crewUuid) });
    },
  });

  const removeAttachmentMutation = useMutation({
    mutationFn: ({ eduUuid, attUuid }: { eduUuid: string; attUuid: string }) =>
      crewEducationApi.removeAttachment(crewUuid, eduUuid, attUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: educationKeys.list(crewUuid) });
    },
  });

  return {
    education: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,

    add: createMutation,
    update: updateMutation,
    remove: deleteMutation,
    addAttachment: addAttachmentMutation,
    removeAttachment: removeAttachmentMutation,

    isMutating: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}
