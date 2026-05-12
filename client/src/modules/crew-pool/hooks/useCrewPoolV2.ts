import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crewPoolApiV2 } from '../api/crewPoolApiV2';

// Helper to get crewUserId from localStorage with null fallback
function getCrewUserId(): string | null {
  try {
    return localStorage.getItem("crewUserId") || null;
  } catch {
    return null;
  }
}

// Inject audit user UUID into request data
function withAuditUser<T>(data: T): T {
  const auditUserUuid = getCrewUserId();
  
  // Handle arrays - add auditUserUuid to each item
  if (Array.isArray(data)) {
    return data.map(item => 
      typeof item === 'object' && item !== null 
        ? { ...item, auditUserUuid } 
        : item
    ) as T;
  }
  
  // Handle objects
  if (typeof data === 'object' && data !== null) {
    return {
      ...data,
      auditUserUuid,
    };
  }
  
  return data;
}
import { 
  mapV2CrewToLegacy,
  mapV2FullProfileToLegacy,
  mapLegacyCrewToV2,
  mapLegacyPersonalDetailsToV2,
  mapLegacyAddressToV2,
  mapLegacyFamilyInfoToV2,
  mapLegacyChildToV2,
  mapLegacyNextOfKinToV2,
  mapLegacyDocumentToV2,
  mapLegacyVisaToV2,
  mapLegacyEducationToV2,
  mapLegacyLicenseToV2,
  mapLegacyTrainingCourseToV2,
  mapLegacySeaServiceToV2,
  mapLegacyPreJoiningMedicalToV2,
  mapLegacyDoctorVisitToV2,
  mapV2DocumentToLegacy,
  mapV2VisaToLegacy,
  mapV2EducationToLegacy,
  mapV2LicenseToLegacy,
  mapV2TrainingCourseToLegacy,
  mapV2SeaServiceToLegacy,
  mapV2PreJoiningMedicalToLegacy,
  mapV2DoctorVisitToLegacy,
  mapV2ChildToLegacy,
  mapV2NextOfKinToLegacy,
  type LegacyCrewMember,
  type LegacyChild,
  type LegacyNextOfKin,
  type LegacyDocument,
  type LegacyVisa,
  type LegacyEducation,
  type LegacyLicense,
  type LegacyTrainingCourse,
  type LegacySeaService,
  type LegacyPreJoiningMedical,
  type LegacyDoctorVisit,
} from '../mappers/v2ToLegacyMapper';

const V2_QUERY_KEY = '/api/v2/crew-pool';
const V2_STALE_TIME = 60 * 1000; // 1 minute

export function useCrewListV2(params?: {
  search?: string;
  rank?: string;
  nationality?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: [V2_QUERY_KEY, 'crew', 'list', params ?? {}],
    queryFn: async ({ signal }) => {
      const response = await crewPoolApiV2.getCrewList({ ...params, limit: params?.limit ?? 1000 }, signal);
      // API returns { data: [...], pagination: {...} }
      const rawData = Array.isArray(response) ? response : (response.data || []);
      return rawData.map(mapV2CrewToLegacy);
    },
    staleTime: V2_STALE_TIME,
  });
}

export function useTerminatedCrewListV2() {
  return useQuery({
    queryKey: [V2_QUERY_KEY, 'crew', 'list', { view: 'terminated' }],
    queryFn: async ({ signal }) => {
      const response = await crewPoolApiV2.getTerminatedCrewList(signal);
      const rawData = Array.isArray(response) ? response : (response.data || []);
      return rawData.map(mapV2CrewToLegacy);
    },
    staleTime: V2_STALE_TIME,
  });
}

export function useTerminateEmploymentV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, payload }: { crewUuid: string; payload: any }) => {
      // Submitter identity is derived server-side from the authenticated session.
      // Only display strings (name/role) are sent from the client.
      return crewPoolApiV2.terminateEmployment(crewUuid, payload);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew'] });
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useCrewByIdV2(crewUuid: string | null) {
  return useQuery({
    queryKey: [V2_QUERY_KEY, 'crew', crewUuid],
    queryFn: async () => {
      if (!crewUuid) return null;
      const response = await crewPoolApiV2.getCrewById(crewUuid);
      return mapV2CrewToLegacy(response);
    },
    enabled: !!crewUuid,
    staleTime: V2_STALE_TIME,
  });
}

export function useCrewFullProfileV2(crewUuid: string | null) {
  return useQuery({
    queryKey: [V2_QUERY_KEY, 'crew', crewUuid, 'full-profile'],
    queryFn: async () => {
      if (!crewUuid) return null;
      const response = await crewPoolApiV2.getCrewFullProfile(crewUuid);
      const mapped = mapV2FullProfileToLegacy(response);
      return mapped;
    },
    enabled: !!crewUuid,
    staleTime: V2_STALE_TIME,
  });
}

export function useCreateCrewV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (legacyData: Partial<LegacyCrewMember>) => {
      const v2Data = withAuditUser(mapLegacyCrewToV2(legacyData));
      const result = await crewPoolApiV2.createCrew(v2Data);
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew'] });
    },
    onError: (error) => {
      console.error('[V2] Failed to create crew:', error);
    },
  });
}

export function useUpdateCrewV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: Partial<LegacyCrewMember> }) => {
      const v2Data = withAuditUser(mapLegacyCrewToV2(data));
      return crewPoolApiV2.updateCrew(crewUuid, v2Data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew'] });
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid, 'full-profile'] });
    },
  });
}

export function useDeleteCrewV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (crewUuid: string) => {
      return crewPoolApiV2.deleteCrew(crewUuid);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew'] });
    },
  });
}

export function useSavePersonalDetailsV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any }) => {
      const v2Data = withAuditUser(mapLegacyPersonalDetailsToV2(data));
      return crewPoolApiV2.savePersonalDetails(crewUuid, v2Data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid, 'full-profile'] });
    },
  });
}

export function useSaveAddressV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any }) => {
      const v2Data = withAuditUser(mapLegacyAddressToV2(data));
      return crewPoolApiV2.saveAddress(crewUuid, v2Data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid, 'full-profile'] });
    },
  });
}

export function useSaveFamilyInfoV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any }) => {
      const v2Data = withAuditUser(mapLegacyFamilyInfoToV2(data));
      return crewPoolApiV2.saveFamilyInfo(crewUuid, v2Data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid, 'full-profile'] });
    },
  });
}

export function useChildrenV2(crewUuid: string | null) {
  return useQuery({
    queryKey: [V2_QUERY_KEY, 'crew', crewUuid, 'children'],
    queryFn: async () => {
      if (!crewUuid) return [];
      const response = await crewPoolApiV2.getChildren(crewUuid);
      return (response || []).map(mapV2ChildToLegacy);
    },
    enabled: !!crewUuid,
  });
}

export function useSaveChildV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data, childUuid }: { crewUuid: string; data: LegacyChild; childUuid?: string }) => {
      const v2Data = withAuditUser(mapLegacyChildToV2(data));
      if (childUuid) {
        return crewPoolApiV2.updateChild(crewUuid, childUuid, v2Data);
      }
      return crewPoolApiV2.createChild(crewUuid, v2Data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useDeleteChildV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, childUuid }: { crewUuid: string; childUuid: string }) => {
      return crewPoolApiV2.deleteChild(crewUuid, childUuid);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useSaveNextOfKinV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: LegacyNextOfKin }) => {
      const v2Data = withAuditUser(mapLegacyNextOfKinToV2(data));
      return crewPoolApiV2.saveNextOfKin(crewUuid, v2Data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useDocumentsV2(crewUuid: string | null) {
  return useQuery({
    queryKey: [V2_QUERY_KEY, 'crew', crewUuid, 'documents'],
    queryFn: async () => {
      if (!crewUuid) return [];
      const response = await crewPoolApiV2.getDocuments(crewUuid);
      return (response || []).map(mapV2DocumentToLegacy);
    },
    enabled: !!crewUuid,
  });
}

export function useSaveDocumentV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data, docUuid, attachments }: { 
      crewUuid: string; 
      data: any; 
      docUuid?: string;
      attachments?: Array<{ attUuid?: string; isNew?: boolean; fileName: string; filePath?: string; fileData?: string; fileUrl?: string }>;
    }) => {
      const v2Data = withAuditUser(mapLegacyDocumentToV2(data));
      let result: any;
      let entityUuid: string;
      
      if (docUuid) {
        result = await crewPoolApiV2.updateDocument(crewUuid, docUuid, v2Data);
        entityUuid = docUuid;
      } else {
        result = await crewPoolApiV2.createDocument(crewUuid, v2Data);
        entityUuid = result?.docUuid || result?.doc_uuid;
      }
      
      // Save only NEW attachments (without attUuid or marked as isNew)
      if (attachments && entityUuid) {
        const newAttachments = attachments.filter(att => !att.attUuid || att.isNew);
        for (const att of newAttachments) {
          if (att.fileName && (att.filePath || att.fileData)) {
            await crewPoolApiV2.addDocumentAttachment(crewUuid, entityUuid, {
              fileName: att.fileName,
              filePath: att.filePath,
              fileData: att.fileData,
            });
          }
        }
      }
      
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useDeleteDocumentV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, docUuid }: { crewUuid: string; docUuid: string }) => {
      return crewPoolApiV2.deleteDocument(crewUuid, docUuid);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useVisasV2(crewUuid: string | null) {
  return useQuery({
    queryKey: [V2_QUERY_KEY, 'crew', crewUuid, 'visas'],
    queryFn: async () => {
      if (!crewUuid) return [];
      const response = await crewPoolApiV2.getVisas(crewUuid);
      return (response || []).map(mapV2VisaToLegacy);
    },
    enabled: !!crewUuid,
  });
}

export function useSaveVisaV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data, visaUuid, attachments }: { 
      crewUuid: string; 
      data: any; 
      visaUuid?: string;
      attachments?: Array<{ attUuid?: string; isNew?: boolean; fileName: string; filePath?: string; fileData?: string; fileUrl?: string }>;
    }) => {
      const v2Data = withAuditUser(mapLegacyVisaToV2(data));
      let result: any;
      let entityUuid: string;
      
      if (visaUuid) {
        result = await crewPoolApiV2.updateVisa(crewUuid, visaUuid, v2Data);
        entityUuid = visaUuid;
      } else {
        result = await crewPoolApiV2.createVisa(crewUuid, v2Data);
        entityUuid = result?.visaUuid || result?.visa_uuid;
      }
      
      // Save only NEW attachments
      if (attachments && entityUuid) {
        const newAttachments = attachments.filter(att => !att.attUuid || att.isNew);
        for (const att of newAttachments) {
          if (att.fileName && (att.filePath || att.fileData)) {
            await crewPoolApiV2.addVisaAttachment(crewUuid, entityUuid, {
              fileName: att.fileName,
              filePath: att.filePath,
              fileData: att.fileData,
            });
          }
        }
      }
      
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useDeleteVisaV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, visaUuid }: { crewUuid: string; visaUuid: string }) => {
      return crewPoolApiV2.deleteVisa(crewUuid, visaUuid);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useEducationV2(crewUuid: string | null) {
  return useQuery({
    queryKey: [V2_QUERY_KEY, 'crew', crewUuid, 'education'],
    queryFn: async () => {
      if (!crewUuid) return [];
      const response = await crewPoolApiV2.getEducation(crewUuid);
      return (response || []).map(mapV2EducationToLegacy);
    },
    enabled: !!crewUuid,
  });
}

export function useSaveEducationV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data, eduUuid, attachments }: { 
      crewUuid: string; 
      data: LegacyEducation; 
      eduUuid?: string;
      attachments?: Array<{ attUuid?: string; isNew?: boolean; fileName: string; filePath?: string; fileData?: string; fileUrl?: string }>;
    }) => {
      const v2Data = withAuditUser(mapLegacyEducationToV2(data));
      let result: any;
      let entityUuid: string;
      
      if (eduUuid) {
        result = await crewPoolApiV2.updateEducation(crewUuid, eduUuid, v2Data);
        entityUuid = eduUuid;
      } else {
        result = await crewPoolApiV2.createEducation(crewUuid, v2Data);
        entityUuid = result?.eduUuid || result?.edu_uuid;
      }
      
      // Save only NEW attachments
      if (attachments && entityUuid) {
        const newAttachments = attachments.filter(att => !att.attUuid || att.isNew);
        for (const att of newAttachments) {
          if (att.fileName && (att.filePath || att.fileData || att.fileUrl)) {
            await crewPoolApiV2.addEducationAttachment(crewUuid, entityUuid, {
              fileName: att.fileName,
              filePath: att.filePath,
              fileUrl: att.fileData || att.fileUrl,
            });
          }
        }
      }
      
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useDeleteEducationV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, eduUuid }: { crewUuid: string; eduUuid: string }) => {
      return crewPoolApiV2.deleteEducation(crewUuid, eduUuid);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useLicensesV2(crewUuid: string | null) {
  return useQuery({
    queryKey: [V2_QUERY_KEY, 'crew', crewUuid, 'licenses'],
    queryFn: async () => {
      if (!crewUuid) return [];
      const response = await crewPoolApiV2.getLicenses(crewUuid);
      return (response || []).map(mapV2LicenseToLegacy);
    },
    enabled: !!crewUuid,
  });
}

export function useSaveLicenseV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data, licUuid, attachments }: { 
      crewUuid: string; 
      data: LegacyLicense; 
      licUuid?: string;
      attachments?: Array<{ attUuid?: string; isNew?: boolean; fileName: string; filePath?: string; fileData?: string; fileUrl?: string }>;
    }) => {
      const v2Data = withAuditUser(mapLegacyLicenseToV2(data));
      let result: any;
      let entityUuid: string;
      
      if (licUuid) {
        result = await crewPoolApiV2.updateLicense(crewUuid, licUuid, v2Data);
        entityUuid = licUuid;
      } else {
        result = await crewPoolApiV2.createLicense(crewUuid, v2Data);
        entityUuid = result?.licUuid || result?.lic_uuid;
      }
      
      // Save only NEW attachments
      if (attachments && entityUuid) {
        const newAttachments = attachments.filter(att => !att.attUuid || att.isNew);
        for (const att of newAttachments) {
          if (att.fileName && (att.filePath || att.fileData || att.fileUrl)) {
            await crewPoolApiV2.addLicenseAttachment(crewUuid, entityUuid, {
              fileName: att.fileName,
              filePath: att.filePath,
              fileUrl: att.fileData || att.fileUrl,
            });
          }
        }
      }
      
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useDeleteLicenseV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, licUuid }: { crewUuid: string; licUuid: string }) => {
      return crewPoolApiV2.deleteLicense(crewUuid, licUuid);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useArchiveLicenseV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, licUuid }: { crewUuid: string; licUuid: string }) => {
      return crewPoolApiV2.archiveLicense(crewUuid, licUuid);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useTrainingCoursesV2(crewUuid: string | null) {
  return useQuery({
    queryKey: [V2_QUERY_KEY, 'crew', crewUuid, 'training'],
    queryFn: async () => {
      if (!crewUuid) return [];
      const response = await crewPoolApiV2.getTrainingCourses(crewUuid);
      return (response || []).map(mapV2TrainingCourseToLegacy);
    },
    enabled: !!crewUuid,
  });
}

export function useSaveTrainingCourseV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data, trainUuid, attachments }: { 
      crewUuid: string; 
      data: LegacyTrainingCourse; 
      trainUuid?: string;
      attachments?: Array<{ attUuid?: string; isNew?: boolean; fileName: string; filePath?: string; fileData?: string; fileUrl?: string }>;
    }) => {
      const v2Data = withAuditUser(mapLegacyTrainingCourseToV2(data));
      let result: any;
      let entityUuid: string;
      
      if (trainUuid) {
        result = await crewPoolApiV2.updateTrainingCourse(crewUuid, trainUuid, v2Data);
        entityUuid = trainUuid;
      } else {
        result = await crewPoolApiV2.createTrainingCourse(crewUuid, v2Data);
        entityUuid = result?.trainUuid || result?.train_uuid;
      }
      
      // Save only NEW attachments
      if (attachments && entityUuid) {
        const newAttachments = attachments.filter(att => !att.attUuid || att.isNew);
        for (const att of newAttachments) {
          if (att.fileName && (att.filePath || att.fileData || att.fileUrl)) {
            await crewPoolApiV2.addTrainingAttachment(crewUuid, entityUuid, {
              fileName: att.fileName,
              filePath: att.filePath,
              fileUrl: att.fileData || att.fileUrl,
            });
          }
        }
      }
      
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useDeleteTrainingCourseV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, trainUuid }: { crewUuid: string; trainUuid: string }) => {
      return crewPoolApiV2.deleteTrainingCourse(crewUuid, trainUuid);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useSeaServiceV2(crewUuid: string | null) {
  return useQuery({
    queryKey: [V2_QUERY_KEY, 'crew', crewUuid, 'sea-service'],
    queryFn: async () => {
      if (!crewUuid) return [];
      const response = await crewPoolApiV2.getSeaService(crewUuid);
      return (response || []).map(mapV2SeaServiceToLegacy);
    },
    enabled: !!crewUuid,
  });
}

export function useSaveSeaServiceV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data, seaUuid, attachments }: { 
      crewUuid: string; 
      data: LegacySeaService; 
      seaUuid?: string;
      attachments?: Array<{ attUuid?: string; isNew?: boolean; fileName: string; filePath?: string; fileData?: string; fileUrl?: string }>;
    }) => {
      const rawV2Data = mapLegacySeaServiceToV2(data);
      // For vessel-synced rows (_skipLockedFields flag), omit fields managed by vessel assignment
      if ((data as any)._skipLockedFields) {
        delete rawV2Data.vesselName;
        delete rawV2Data.vesselUuid;
        delete rawV2Data.vesselTypeUuid;
        delete rawV2Data.rank;
        delete rawV2Data.fromDate;
        delete rawV2Data.toDate;
      }
      const v2Data = withAuditUser(rawV2Data);
      let result: any;
      let entityUuid: string;
      
      if (seaUuid) {
        result = await crewPoolApiV2.updateSeaService(crewUuid, seaUuid, v2Data);
        entityUuid = seaUuid;
      } else {
        result = await crewPoolApiV2.createSeaService(crewUuid, v2Data);
        entityUuid = result?.seaUuid || result?.sea_uuid;
      }
      
      // Save only NEW attachments
      if (attachments && entityUuid) {
        const newAttachments = attachments.filter(att => !att.attUuid || att.isNew);
        for (const att of newAttachments) {
          if (att.fileName && (att.filePath || att.fileData || att.fileUrl)) {
            await crewPoolApiV2.addSeaServiceAttachment(crewUuid, entityUuid, {
              fileName: att.fileName,
              filePath: att.filePath,
              fileUrl: att.fileData || att.fileUrl,
            });
          }
        }
      }
      
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useDeleteSeaServiceV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, seaUuid }: { crewUuid: string; seaUuid: string }) => {
      return crewPoolApiV2.deleteSeaService(crewUuid, seaUuid);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useMedicalsV2(crewUuid: string | null) {
  return useQuery({
    queryKey: [V2_QUERY_KEY, 'crew', crewUuid, 'medicals'],
    queryFn: async () => {
      if (!crewUuid) return [];
      const response = await crewPoolApiV2.getMedicals(crewUuid);
      return (response || []).map(mapV2PreJoiningMedicalToLegacy);
    },
    enabled: !!crewUuid,
  });
}

export function useSaveMedicalV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data, medUuid, attachments }: { 
      crewUuid: string; 
      data: LegacyPreJoiningMedical; 
      medUuid?: string;
      attachments?: Array<{ attUuid?: string; isNew?: boolean; fileName: string; filePath?: string; fileData?: string; fileUrl?: string }>;
    }) => {
      const v2Data = withAuditUser(mapLegacyPreJoiningMedicalToV2(data));
      let result: any;
      let entityUuid: string;
      
      if (medUuid) {
        result = await crewPoolApiV2.updateMedical(crewUuid, medUuid, v2Data);
        entityUuid = medUuid;
      } else {
        result = await crewPoolApiV2.createMedical(crewUuid, v2Data);
        entityUuid = result?.medUuid || result?.med_uuid;
      }
      
      // Save only NEW attachments
      if (attachments && entityUuid) {
        const newAttachments = attachments.filter(att => !att.attUuid || att.isNew);
        for (const att of newAttachments) {
          if (att.fileName && (att.filePath || att.fileData || att.fileUrl)) {
            await crewPoolApiV2.addMedicalAttachment(crewUuid, entityUuid, {
              fileName: att.fileName,
              filePath: att.filePath,
              fileUrl: att.fileData || att.fileUrl,
            });
          }
        }
      }
      
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useDeleteMedicalV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, medUuid }: { crewUuid: string; medUuid: string }) => {
      return crewPoolApiV2.deleteMedical(crewUuid, medUuid);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useDoctorVisitsV2(crewUuid: string | null) {
  return useQuery({
    queryKey: [V2_QUERY_KEY, 'crew', crewUuid, 'doctor-visits'],
    queryFn: async () => {
      if (!crewUuid) return [];
      const response = await crewPoolApiV2.getDoctorVisits(crewUuid);
      return (response || []).map(mapV2DoctorVisitToLegacy);
    },
    enabled: !!crewUuid,
  });
}

export function useSaveDoctorVisitV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data, visitUuid, attachments }: { 
      crewUuid: string; 
      data: LegacyDoctorVisit; 
      visitUuid?: string;
      attachments?: Array<{ attUuid?: string; isNew?: boolean; fileName: string; filePath?: string; fileData?: string; fileUrl?: string }>;
    }) => {
      const v2Data = withAuditUser(mapLegacyDoctorVisitToV2(data));
      let result: any;
      let entityUuid: string;
      
      if (visitUuid) {
        result = await crewPoolApiV2.updateDoctorVisit(crewUuid, visitUuid, v2Data);
        entityUuid = visitUuid;
      } else {
        result = await crewPoolApiV2.createDoctorVisit(crewUuid, v2Data);
        entityUuid = result?.visitUuid || result?.visit_uuid;
      }
      
      // Save only NEW attachments
      if (attachments && entityUuid) {
        const newAttachments = attachments.filter(att => !att.attUuid || att.isNew);
        for (const att of newAttachments) {
          if (att.fileName && (att.filePath || att.fileData || att.fileUrl)) {
            await crewPoolApiV2.addDoctorVisitAttachment(crewUuid, entityUuid, {
              fileName: att.fileName,
              filePath: att.filePath,
              fileUrl: att.fileData || att.fileUrl,
            });
          }
        }
      }
      
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useDeleteDoctorVisitV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, visitUuid }: { crewUuid: string; visitUuid: string }) => {
      return crewPoolApiV2.deleteDoctorVisit(crewUuid, visitUuid);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useSaveVesselTypesV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, vesselTypeUuids }: { crewUuid: string; vesselTypeUuids: string[] }) => {
      return crewPoolApiV2.saveVesselTypesApplied(crewUuid, vesselTypeUuids);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid, 'full-profile'] });
    },
  });
}

export function useAssignToVesselV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any }) => {
      return crewPoolApiV2.assignToVessel(crewUuid, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew'] });
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useSignOffV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ crewUuid, data }: { crewUuid: string; data: any }) => {
      return crewPoolApiV2.signOff(crewUuid, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew'] });
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useAddDocumentAttachmentV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, docUuid, data }: { crewUuid: string; docUuid: string; data: any }) => {
      return crewPoolApiV2.addDocumentAttachment(crewUuid, docUuid, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useRemoveDocumentAttachmentV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, docUuid, attUuid }: { crewUuid: string; docUuid: string; attUuid: string }) => {
      return crewPoolApiV2.removeDocumentAttachment(crewUuid, docUuid, attUuid);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useAddVisaAttachmentV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, visaUuid, data }: { crewUuid: string; visaUuid: string; data: any }) => {
      return crewPoolApiV2.addVisaAttachment(crewUuid, visaUuid, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useRemoveVisaAttachmentV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, visaUuid, attUuid }: { crewUuid: string; visaUuid: string; attUuid: string }) => {
      return crewPoolApiV2.removeVisaAttachment(crewUuid, visaUuid, attUuid);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useAddEducationAttachmentV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, eduUuid, data }: { crewUuid: string; eduUuid: string; data: any }) => {
      return crewPoolApiV2.addEducationAttachment(crewUuid, eduUuid, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useRemoveEducationAttachmentV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, eduUuid, attUuid }: { crewUuid: string; eduUuid: string; attUuid: string }) => {
      return crewPoolApiV2.removeEducationAttachment(crewUuid, eduUuid, attUuid);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useAddLicenseAttachmentV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, licUuid, data }: { crewUuid: string; licUuid: string; data: any }) => {
      return crewPoolApiV2.addLicenseAttachment(crewUuid, licUuid, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useRemoveLicenseAttachmentV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, licUuid, attUuid }: { crewUuid: string; licUuid: string; attUuid: string }) => {
      return crewPoolApiV2.removeLicenseAttachment(crewUuid, licUuid, attUuid);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useAddTrainingAttachmentV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, trainUuid, data }: { crewUuid: string; trainUuid: string; data: any }) => {
      return crewPoolApiV2.addTrainingAttachment(crewUuid, trainUuid, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useRemoveTrainingAttachmentV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, trainUuid, attUuid }: { crewUuid: string; trainUuid: string; attUuid: string }) => {
      return crewPoolApiV2.removeTrainingAttachment(crewUuid, trainUuid, attUuid);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useAddSeaServiceAttachmentV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, seaUuid, data }: { crewUuid: string; seaUuid: string; data: any }) => {
      return crewPoolApiV2.addSeaServiceAttachment(crewUuid, seaUuid, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useRemoveSeaServiceAttachmentV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, seaUuid, attUuid }: { crewUuid: string; seaUuid: string; attUuid: string }) => {
      return crewPoolApiV2.removeSeaServiceAttachment(crewUuid, seaUuid, attUuid);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useAddMedicalAttachmentV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, medUuid, data }: { crewUuid: string; medUuid: string; data: any }) => {
      return crewPoolApiV2.addMedicalAttachment(crewUuid, medUuid, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useRemoveMedicalAttachmentV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, medUuid, attUuid }: { crewUuid: string; medUuid: string; attUuid: string }) => {
      return crewPoolApiV2.removeMedicalAttachment(crewUuid, medUuid, attUuid);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useAddDoctorVisitAttachmentV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, visitUuid, data }: { crewUuid: string; visitUuid: string; data: any }) => {
      return crewPoolApiV2.addDoctorVisitAttachment(crewUuid, visitUuid, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}

export function useRemoveDoctorVisitAttachmentV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ crewUuid, visitUuid, attUuid }: { crewUuid: string; visitUuid: string; attUuid: string }) => {
      return crewPoolApiV2.removeDoctorVisitAttachment(crewUuid, visitUuid, attUuid);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, 'crew', variables.crewUuid] });
    },
  });
}
