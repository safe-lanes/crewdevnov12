import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crewPersonalApi } from '../api';
import {
  mapPersonalToForm,
  mapAddressToForm,
  mapFormToPersonal,
  mapFormToAddress,
  type PersonalDetailsFormData,
  type AddressFormData,
} from '../mappers';
import { crewMemberKeys } from './useCrewMember';
import { v4 as uuidv4 } from 'uuid';

export const personalKeys = {
  all: (crewUuid: string) => [...crewMemberKeys.detail(crewUuid), 'personal'] as const,
  details: (crewUuid: string) => [...personalKeys.all(crewUuid), 'details'] as const,
  address: (crewUuid: string) => [...personalKeys.all(crewUuid), 'address'] as const,
};

export function useCrewPersonal(crewUuid: string) {
  return useQuery({
    queryKey: personalKeys.details(crewUuid),
    queryFn: () => crewPersonalApi.getPersonal(crewUuid),
    enabled: !!crewUuid,
    select: (data) => mapPersonalToForm(data),
  });
}

export function useCrewAddress(crewUuid: string) {
  return useQuery({
    queryKey: personalKeys.address(crewUuid),
    queryFn: () => crewPersonalApi.getAddress(crewUuid),
    enabled: !!crewUuid,
    select: (data) => mapAddressToForm(data),
  });
}

export function useUpsertPersonal(crewUuid: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: PersonalDetailsFormData) => {
      const apiData = mapFormToPersonal(data);
      return crewPersonalApi.upsertPersonal(crewUuid, {
        cpdUuid: data.cpdUuid || uuidv4(),
        ...apiData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: personalKeys.details(crewUuid) });
    },
  });
}

export function useUpsertAddress(crewUuid: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: AddressFormData) => {
      const apiData = mapFormToAddress(data);
      return crewPersonalApi.upsertAddress(crewUuid, {
        addrUuid: data.addrUuid || uuidv4(),
        ...apiData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: personalKeys.address(crewUuid) });
    },
  });
}
