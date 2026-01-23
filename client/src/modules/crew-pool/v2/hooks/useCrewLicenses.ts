import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crewLicensesApi } from '../api';
import { mapLicensesToForm, mapFormToLicense, type LicenseFormData } from '../mappers';
import { crewMemberKeys } from './useCrewMember';

export const licenseKeys = {
  all: (crewUuid: string) => [...crewMemberKeys.detail(crewUuid), 'licenses'] as const,
  list: (crewUuid: string) => [...licenseKeys.all(crewUuid), 'list'] as const,
};

export function useCrewLicenses(crewUuid: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: licenseKeys.list(crewUuid),
    queryFn: () => crewLicensesApi.getAll(crewUuid),
    enabled: !!crewUuid,
    select: (data) => mapLicensesToForm(data),
  });

  const createMutation = useMutation({
    mutationFn: (data: LicenseFormData) => {
      const apiData = mapFormToLicense(data);
      return crewLicensesApi.create(crewUuid, apiData as Parameters<typeof crewLicensesApi.create>[1]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: licenseKeys.list(crewUuid) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ licUuid, data }: { licUuid: string; data: Partial<LicenseFormData> }) => {
      const apiData = mapFormToLicense(data as LicenseFormData);
      return crewLicensesApi.update(crewUuid, licUuid, apiData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: licenseKeys.list(crewUuid) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (licUuid: string) => crewLicensesApi.delete(crewUuid, licUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: licenseKeys.list(crewUuid) });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (licUuid: string) => crewLicensesApi.archive(crewUuid, licUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: licenseKeys.list(crewUuid) });
    },
  });

  const addAttachmentMutation = useMutation({
    mutationFn: ({ licUuid, file }: { licUuid: string; file: { fileName: string; filePath: string; fileType: string; fileSize: string } }) =>
      crewLicensesApi.addAttachment(crewUuid, licUuid, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: licenseKeys.list(crewUuid) });
    },
  });

  const removeAttachmentMutation = useMutation({
    mutationFn: ({ licUuid, attUuid }: { licUuid: string; attUuid: string }) =>
      crewLicensesApi.removeAttachment(crewUuid, licUuid, attUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: licenseKeys.list(crewUuid) });
    },
  });

  return {
    licenses: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,

    add: createMutation,
    update: updateMutation,
    remove: deleteMutation,
    archive: archiveMutation,
    addAttachment: addAttachmentMutation,
    removeAttachment: removeAttachmentMutation,

    isMutating: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending || archiveMutation.isPending,
  };
}
