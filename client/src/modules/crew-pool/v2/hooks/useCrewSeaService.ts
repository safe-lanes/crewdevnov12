import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crewSeaServiceApi } from '../api';
import { mapSeaServicesToForm, mapFormToSeaService, type SeaServiceFormData } from '../mappers';
import { crewMemberKeys } from './useCrewMember';

export const seaServiceKeys = {
  all: (crewUuid: string) => [...crewMemberKeys.detail(crewUuid), 'sea-service'] as const,
  list: (crewUuid: string) => [...seaServiceKeys.all(crewUuid), 'list'] as const,
};

export function useCrewSeaService(crewUuid: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: seaServiceKeys.list(crewUuid),
    queryFn: () => crewSeaServiceApi.getAll(crewUuid),
    enabled: !!crewUuid,
    select: (data) => mapSeaServicesToForm(data),
  });

  const createMutation = useMutation({
    mutationFn: (data: SeaServiceFormData) => {
      const apiData = mapFormToSeaService(data);
      return crewSeaServiceApi.create(crewUuid, apiData as Parameters<typeof crewSeaServiceApi.create>[1]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: seaServiceKeys.list(crewUuid) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ seaUuid, data }: { seaUuid: string; data: Partial<SeaServiceFormData> }) => {
      const apiData = mapFormToSeaService(data as SeaServiceFormData);
      return crewSeaServiceApi.update(crewUuid, seaUuid, apiData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: seaServiceKeys.list(crewUuid) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (seaUuid: string) => crewSeaServiceApi.delete(crewUuid, seaUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: seaServiceKeys.list(crewUuid) });
    },
  });

  const addAttachmentMutation = useMutation({
    mutationFn: ({ seaUuid, file }: { seaUuid: string; file: { fileName: string; filePath: string; fileType: string; fileSize: string } }) =>
      crewSeaServiceApi.addAttachment(crewUuid, seaUuid, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: seaServiceKeys.list(crewUuid) });
    },
  });

  const removeAttachmentMutation = useMutation({
    mutationFn: ({ seaUuid, attUuid }: { seaUuid: string; attUuid: string }) =>
      crewSeaServiceApi.removeAttachment(crewUuid, seaUuid, attUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: seaServiceKeys.list(crewUuid) });
    },
  });

  return {
    seaService: query.data || [],
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
