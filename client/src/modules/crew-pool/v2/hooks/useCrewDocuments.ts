import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crewDocumentsApi } from '../api';
import { mapDocumentsToForm, mapFormToDocument, type DocumentFormData } from '../mappers';
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
    select: (data) => mapDocumentsToForm(data),
  });

  const createMutation = useMutation({
    mutationFn: (data: DocumentFormData) => {
      const apiData = mapFormToDocument(data);
      return crewDocumentsApi.create(crewUuid, apiData as Parameters<typeof crewDocumentsApi.create>[1]);
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
    mutationFn: ({ docUuid, file }: { docUuid: string; file: { fileName: string; filePath: string; fileType: string; fileSize: string } }) =>
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

    isMutating: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}
