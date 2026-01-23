import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crewMedicalApi } from '../api';
import {
  mapMedicalsToForm,
  mapFormToMedical,
  mapDoctorVisitsToForm,
  mapFormToDoctorVisit,
  type MedicalFormData,
  type DoctorVisitFormData,
} from '../mappers';
import { crewMemberKeys } from './useCrewMember';

export const medicalKeys = {
  all: (crewUuid: string) => [...crewMemberKeys.detail(crewUuid), 'medical'] as const,
  medicals: (crewUuid: string) => [...medicalKeys.all(crewUuid), 'pre-joining'] as const,
  doctorVisits: (crewUuid: string) => [...medicalKeys.all(crewUuid), 'doctor-visits'] as const,
};

export function useCrewMedicals(crewUuid: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: medicalKeys.medicals(crewUuid),
    queryFn: () => crewMedicalApi.getMedicals(crewUuid),
    enabled: !!crewUuid,
    select: (data) => mapMedicalsToForm(data),
  });

  const createMutation = useMutation({
    mutationFn: (data: MedicalFormData) => {
      const apiData = mapFormToMedical(data);
      return crewMedicalApi.createMedical(crewUuid, apiData as Parameters<typeof crewMedicalApi.createMedical>[1]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: medicalKeys.medicals(crewUuid) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ medUuid, data }: { medUuid: string; data: Partial<MedicalFormData> }) => {
      const apiData = mapFormToMedical(data as MedicalFormData);
      return crewMedicalApi.updateMedical(crewUuid, medUuid, apiData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: medicalKeys.medicals(crewUuid) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (medUuid: string) => crewMedicalApi.deleteMedical(crewUuid, medUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: medicalKeys.medicals(crewUuid) });
    },
  });

  const addAttachmentMutation = useMutation({
    mutationFn: ({ medUuid, file }: { medUuid: string; file: { fileName: string; filePath: string; fileType: string; fileSize: string } }) =>
      crewMedicalApi.addMedicalAttachment(crewUuid, medUuid, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: medicalKeys.medicals(crewUuid) });
    },
  });

  const removeAttachmentMutation = useMutation({
    mutationFn: ({ medUuid, attUuid }: { medUuid: string; attUuid: string }) =>
      crewMedicalApi.removeMedicalAttachment(crewUuid, medUuid, attUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: medicalKeys.medicals(crewUuid) });
    },
  });

  return {
    medicals: query.data || [],
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

export function useCrewDoctorVisits(crewUuid: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: medicalKeys.doctorVisits(crewUuid),
    queryFn: () => crewMedicalApi.getDoctorVisits(crewUuid),
    enabled: !!crewUuid,
    select: (data) => mapDoctorVisitsToForm(data),
  });

  const createMutation = useMutation({
    mutationFn: (data: DoctorVisitFormData) => {
      const apiData = mapFormToDoctorVisit(data);
      return crewMedicalApi.createDoctorVisit(crewUuid, apiData as Parameters<typeof crewMedicalApi.createDoctorVisit>[1]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: medicalKeys.doctorVisits(crewUuid) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ visitUuid, data }: { visitUuid: string; data: Partial<DoctorVisitFormData> }) => {
      const apiData = mapFormToDoctorVisit(data as DoctorVisitFormData);
      return crewMedicalApi.updateDoctorVisit(crewUuid, visitUuid, apiData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: medicalKeys.doctorVisits(crewUuid) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (visitUuid: string) => crewMedicalApi.deleteDoctorVisit(crewUuid, visitUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: medicalKeys.doctorVisits(crewUuid) });
    },
  });

  const addAttachmentMutation = useMutation({
    mutationFn: ({ visitUuid, file }: { visitUuid: string; file: { fileName: string; filePath: string; fileType: string; fileSize: string } }) =>
      crewMedicalApi.addDoctorVisitAttachment(crewUuid, visitUuid, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: medicalKeys.doctorVisits(crewUuid) });
    },
  });

  const removeAttachmentMutation = useMutation({
    mutationFn: ({ visitUuid, attUuid }: { visitUuid: string; attUuid: string }) =>
      crewMedicalApi.removeDoctorVisitAttachment(crewUuid, visitUuid, attUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: medicalKeys.doctorVisits(crewUuid) });
    },
  });

  return {
    doctorVisits: query.data || [],
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
