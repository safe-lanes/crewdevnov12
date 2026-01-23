import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crewVisasApi } from '../api';
import { mapVisasToForm, mapFormToVisa, type VisaFormData } from '../mappers';
import { crewMemberKeys } from './useCrewMember';

export const visaKeys = {
  all: (crewUuid: string) => [...crewMemberKeys.detail(crewUuid), 'visas'] as const,
  list: (crewUuid: string) => [...visaKeys.all(crewUuid), 'list'] as const,
};

export function useCrewVisas(crewUuid: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: visaKeys.list(crewUuid),
    queryFn: () => crewVisasApi.getAll(crewUuid),
    enabled: !!crewUuid,
    select: (data) => mapVisasToForm(data),
  });

  const createMutation = useMutation({
    mutationFn: (data: VisaFormData) => {
      const apiData = mapFormToVisa(data);
      return crewVisasApi.create(crewUuid, apiData as Parameters<typeof crewVisasApi.create>[1]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: visaKeys.list(crewUuid) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ visaUuid, data }: { visaUuid: string; data: Partial<VisaFormData> }) => {
      const apiData = mapFormToVisa(data as VisaFormData);
      return crewVisasApi.update(crewUuid, visaUuid, apiData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: visaKeys.list(crewUuid) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (visaUuid: string) => crewVisasApi.delete(crewUuid, visaUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: visaKeys.list(crewUuid) });
    },
  });

  const addAttachmentMutation = useMutation({
    mutationFn: ({ visaUuid, file }: { visaUuid: string; file: { fileName: string; filePath: string; fileType: string; fileSize: string } }) =>
      crewVisasApi.addAttachment(crewUuid, visaUuid, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: visaKeys.list(crewUuid) });
    },
  });

  const removeAttachmentMutation = useMutation({
    mutationFn: ({ visaUuid, attUuid }: { visaUuid: string; attUuid: string }) =>
      crewVisasApi.removeAttachment(crewUuid, visaUuid, attUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: visaKeys.list(crewUuid) });
    },
  });

  return {
    visas: query.data || [],
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
