import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crewTrainingApi } from '../api';
import { mapTrainingsToForm, mapFormToTraining, type TrainingFormData } from '../mappers';
import { crewMemberKeys } from './useCrewMember';

export const trainingKeys = {
  all: (crewUuid: string) => [...crewMemberKeys.detail(crewUuid), 'training'] as const,
  list: (crewUuid: string) => [...trainingKeys.all(crewUuid), 'list'] as const,
};

export function useCrewTraining(crewUuid: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: trainingKeys.list(crewUuid),
    queryFn: () => crewTrainingApi.getAll(crewUuid),
    enabled: !!crewUuid,
    select: (data) => mapTrainingsToForm(data),
  });

  const createMutation = useMutation({
    mutationFn: (data: TrainingFormData) => {
      const apiData = mapFormToTraining(data);
      return crewTrainingApi.create(crewUuid, apiData as Parameters<typeof crewTrainingApi.create>[1]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trainingKeys.list(crewUuid) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ trainUuid, data }: { trainUuid: string; data: Partial<TrainingFormData> }) => {
      const apiData = mapFormToTraining(data as TrainingFormData);
      return crewTrainingApi.update(crewUuid, trainUuid, apiData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trainingKeys.list(crewUuid) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (trainUuid: string) => crewTrainingApi.delete(crewUuid, trainUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trainingKeys.list(crewUuid) });
    },
  });

  const addAttachmentMutation = useMutation({
    mutationFn: ({ trainUuid, file }: { trainUuid: string; file: { fileName: string; filePath: string; fileType: string; fileSize: string } }) =>
      crewTrainingApi.addAttachment(crewUuid, trainUuid, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trainingKeys.list(crewUuid) });
    },
  });

  const removeAttachmentMutation = useMutation({
    mutationFn: ({ trainUuid, attUuid }: { trainUuid: string; attUuid: string }) =>
      crewTrainingApi.removeAttachment(crewUuid, trainUuid, attUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trainingKeys.list(crewUuid) });
    },
  });

  return {
    training: query.data || [],
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
