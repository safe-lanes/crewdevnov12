import { useQuery } from "@tanstack/react-query";

const V2_MASTERS_BASE = "/api/v2/masters";
const STALE_TIME = 30 * 60 * 1000;

interface UseMasterOptions {
  enabled?: boolean;
}

export const useNationalitiesV2 = (options?: UseMasterOptions) => {
  return useQuery<any[]>({
    queryKey: [`${V2_MASTERS_BASE}/nationalities`],
    staleTime: STALE_TIME,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};

export const useNationalityByUuidV2 = (uuid: string | undefined) => {
  return useQuery<any>({
    queryKey: [`${V2_MASTERS_BASE}/nationalities`, uuid],
    enabled: !!uuid,
    staleTime: STALE_TIME,
  });
};

export const useVesselsV2 = (options?: UseMasterOptions) => {
  return useQuery<any[]>({
    queryKey: [`${V2_MASTERS_BASE}/vessels`],
    staleTime: STALE_TIME,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};

export const useVesselByUuidV2 = (uuid: string | undefined) => {
  return useQuery<any>({
    queryKey: [`${V2_MASTERS_BASE}/vessels`, uuid],
    enabled: !!uuid,
    staleTime: STALE_TIME,
  });
};

export const useVesselTypesV2 = (options?: UseMasterOptions) => {
  return useQuery<any[]>({
    queryKey: [`${V2_MASTERS_BASE}/vessel-types`],
    staleTime: STALE_TIME,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};

export const useVesselTypeByUuidV2 = (uuid: string | undefined) => {
  return useQuery<any>({
    queryKey: [`${V2_MASTERS_BASE}/vessel-types`, uuid],
    enabled: !!uuid,
    staleTime: STALE_TIME,
  });
};

export const useAdditionalGroupsV2 = (options?: UseMasterOptions) => {
  return useQuery<any[]>({
    queryKey: [`${V2_MASTERS_BASE}/additional-groups`],
    staleTime: STALE_TIME,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};

export const useAdditionalGroupByUuidV2 = (uuid: string | undefined) => {
  return useQuery<any>({
    queryKey: [`${V2_MASTERS_BASE}/additional-groups`, uuid],
    enabled: !!uuid,
    staleTime: STALE_TIME,
  });
};

export const usePortsV2 = (options?: UseMasterOptions) => {
  return useQuery<any[]>({
    queryKey: [`${V2_MASTERS_BASE}/ports`],
    staleTime: STALE_TIME,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};

export const usePortByUuidV2 = (uuid: string | undefined) => {
  return useQuery<any>({
    queryKey: [`${V2_MASTERS_BASE}/ports`, uuid],
    enabled: !!uuid,
    staleTime: STALE_TIME,
  });
};

export const useFleetGroupsV2 = (options?: UseMasterOptions) => {
  return useQuery<any[]>({
    queryKey: [`${V2_MASTERS_BASE}/fleet-groups`],
    staleTime: STALE_TIME,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};

export const useFleetGroupByUuidV2 = (uuid: string | undefined) => {
  return useQuery<any>({
    queryKey: [`${V2_MASTERS_BASE}/fleet-groups`, uuid],
    enabled: !!uuid,
    staleTime: STALE_TIME,
  });
};

export const useLanguagesV2 = (options?: UseMasterOptions) => {
  return useQuery<any[]>({
    queryKey: [`${V2_MASTERS_BASE}/languages`],
    staleTime: STALE_TIME,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};

export const useLanguageByUuidV2 = (uuid: string | undefined) => {
  return useQuery<any>({
    queryKey: [`${V2_MASTERS_BASE}/languages`, uuid],
    enabled: !!uuid,
    staleTime: STALE_TIME,
  });
};

export const useCountriesV2 = (options?: UseMasterOptions) => {
  return useQuery<any[]>({
    queryKey: [`${V2_MASTERS_BASE}/countries`],
    staleTime: STALE_TIME,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};

export const useCountryByUuidV2 = (uuid: string | undefined) => {
  return useQuery<any>({
    queryKey: [`${V2_MASTERS_BASE}/countries`, uuid],
    enabled: !!uuid,
    staleTime: STALE_TIME,
  });
};

export const useUsersV2 = (options?: UseMasterOptions) => {
  return useQuery<any[]>({
    queryKey: [`${V2_MASTERS_BASE}/users`],
    staleTime: STALE_TIME,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};

export const useUserByUuidV2 = (uuid: string | undefined) => {
  return useQuery<any>({
    queryKey: [`${V2_MASTERS_BASE}/users`, uuid],
    enabled: !!uuid,
    staleTime: STALE_TIME,
  });
};

export const useLicensesDceV2 = (options?: UseMasterOptions) => {
  return useQuery<any[]>({
    queryKey: [`${V2_MASTERS_BASE}/licenses-dce`],
    staleTime: STALE_TIME,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};

export const useLicenseDceByIdV2 = (id: string | undefined) => {
  return useQuery<any>({
    queryKey: [`${V2_MASTERS_BASE}/licenses-dce`, id],
    enabled: !!id,
    staleTime: STALE_TIME,
  });
};

export const useManningAgentsV2 = (options?: UseMasterOptions) => {
  return useQuery<any[]>({
    queryKey: [`${V2_MASTERS_BASE}/manning-agents`],
    staleTime: STALE_TIME,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};

export const useManningAgentByIdV2 = (id: string | undefined) => {
  return useQuery<any>({
    queryKey: [`${V2_MASTERS_BASE}/manning-agents`, id],
    enabled: !!id,
    staleTime: STALE_TIME,
  });
};

export const useCrewPoolsV2 = (options?: UseMasterOptions) => {
  return useQuery<any[]>({
    queryKey: [`${V2_MASTERS_BASE}/crew-pools`],
    staleTime: STALE_TIME,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};

export const useCrewPoolByIdV2 = (id: string | undefined) => {
  return useQuery<any>({
    queryKey: [`${V2_MASTERS_BASE}/crew-pools`, id],
    enabled: !!id,
    staleTime: STALE_TIME,
  });
};

export const useAppraisalTypesV2 = (options?: UseMasterOptions) => {
  return useQuery<any[]>({
    queryKey: [`${V2_MASTERS_BASE}/appraisal-types`],
    staleTime: STALE_TIME,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};

export const useAppraisalTypeByIdV2 = (id: string | undefined) => {
  return useQuery<any>({
    queryKey: [`${V2_MASTERS_BASE}/appraisal-types`, id],
    enabled: !!id,
    staleTime: STALE_TIME,
  });
};
