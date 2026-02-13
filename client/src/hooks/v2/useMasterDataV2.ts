import { useQuery } from "@tanstack/react-query";
import type {
  MasterNationality,
  MasterVessel,
  MasterVesselType,
  MasterAdditionalGroup,
  MasterPort,
  MasterFleetGroup,
  MasterLanguage,
  MasterCountry,
  MasterUser,
} from "@shared/schema";

const V2_MASTERS_BASE = "/api/v2/masters";

export function useNationalitiesV2() {
  return useQuery<MasterNationality[]>({
    queryKey: [`${V2_MASTERS_BASE}/nationalities`],
  });
}

export function useNationalityByUuidV2(uuid: string | undefined) {
  return useQuery<MasterNationality>({
    queryKey: [`${V2_MASTERS_BASE}/nationalities`, uuid],
    enabled: !!uuid,
  });
}

export function useVesselsV2() {
  return useQuery<MasterVessel[]>({
    queryKey: [`${V2_MASTERS_BASE}/vessels`],
  });
}

export function useVesselByUuidV2(uuid: string | undefined) {
  return useQuery<MasterVessel>({
    queryKey: [`${V2_MASTERS_BASE}/vessels`, uuid],
    enabled: !!uuid,
  });
}

export function useVesselTypesV2() {
  return useQuery<MasterVesselType[]>({
    queryKey: [`${V2_MASTERS_BASE}/vessel-types`],
  });
}

export function useVesselTypeByUuidV2(uuid: string | undefined) {
  return useQuery<MasterVesselType>({
    queryKey: [`${V2_MASTERS_BASE}/vessel-types`, uuid],
    enabled: !!uuid,
  });
}

export function useAdditionalGroupsV2() {
  return useQuery<MasterAdditionalGroup[]>({
    queryKey: [`${V2_MASTERS_BASE}/additional-groups`],
  });
}

export function useAdditionalGroupByUuidV2(uuid: string | undefined) {
  return useQuery<MasterAdditionalGroup>({
    queryKey: [`${V2_MASTERS_BASE}/additional-groups`, uuid],
    enabled: !!uuid,
  });
}

export function usePortsV2() {
  return useQuery<MasterPort[]>({
    queryKey: [`${V2_MASTERS_BASE}/ports`],
  });
}

export function usePortByUuidV2(uuid: string | undefined) {
  return useQuery<MasterPort>({
    queryKey: [`${V2_MASTERS_BASE}/ports`, uuid],
    enabled: !!uuid,
  });
}

export function useFleetGroupsV2() {
  return useQuery<MasterFleetGroup[]>({
    queryKey: [`${V2_MASTERS_BASE}/fleet-groups`],
  });
}

export function useFleetGroupByUuidV2(uuid: string | undefined) {
  return useQuery<MasterFleetGroup>({
    queryKey: [`${V2_MASTERS_BASE}/fleet-groups`, uuid],
    enabled: !!uuid,
  });
}

export function useLanguagesV2() {
  return useQuery<MasterLanguage[]>({
    queryKey: [`${V2_MASTERS_BASE}/languages`],
  });
}

export function useLanguageByUuidV2(uuid: string | undefined) {
  return useQuery<MasterLanguage>({
    queryKey: [`${V2_MASTERS_BASE}/languages`, uuid],
    enabled: !!uuid,
  });
}

export function useCountriesV2() {
  return useQuery<MasterCountry[]>({
    queryKey: [`${V2_MASTERS_BASE}/countries`],
  });
}

export function useCountryByUuidV2(uuid: string | undefined) {
  return useQuery<MasterCountry>({
    queryKey: [`${V2_MASTERS_BASE}/countries`, uuid],
    enabled: !!uuid,
  });
}

export function useUsersV2() {
  return useQuery<MasterUser[]>({
    queryKey: [`${V2_MASTERS_BASE}/users`],
  });
}

export function useUserByUuidV2(uuid: string | undefined) {
  return useQuery<MasterUser>({
    queryKey: [`${V2_MASTERS_BASE}/users`, uuid],
    enabled: !!uuid,
  });
}
