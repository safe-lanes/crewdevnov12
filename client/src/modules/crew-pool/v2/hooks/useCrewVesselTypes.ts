import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crewVesselTypesApi } from '../api';
import { crewMemberKeys } from './useCrewMember';

export const vesselTypesKeys = {
  all: (crewUuid: string) => [...crewMemberKeys.detail(crewUuid), 'vessel-types'] as const,
  list: (crewUuid: string) => [...vesselTypesKeys.all(crewUuid), 'list'] as const,
};

export function useCrewVesselTypes(crewUuid: string) {
  return useQuery({
    queryKey: vesselTypesKeys.list(crewUuid),
    queryFn: () => crewVesselTypesApi.getAll(crewUuid),
    enabled: !!crewUuid,
  });
}

export function useSyncVesselTypes(crewUuid: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (vesselTypeUuids: string[]) => {
      return crewVesselTypesApi.sync(crewUuid, vesselTypeUuids);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vesselTypesKeys.list(crewUuid) });
    },
  });
}
