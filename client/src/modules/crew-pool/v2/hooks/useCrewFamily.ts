import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crewFamilyApi } from '../api';
import {
  mapFamilyToForm,
  mapChildrenToForm,
  mapNextOfKinToForm,
  mapFormToFamily,
  mapFormToChild,
  mapFormToNextOfKin,
  type FamilyInfoFormData,
  type ChildFormData,
  type NextOfKinFormData,
} from '../mappers';
import { crewMemberKeys } from './useCrewMember';
import { v4 as uuidv4 } from 'uuid';

export const familyKeys = {
  all: (crewUuid: string) => [...crewMemberKeys.detail(crewUuid), 'family'] as const,
  info: (crewUuid: string) => [...familyKeys.all(crewUuid), 'info'] as const,
  children: (crewUuid: string) => [...familyKeys.all(crewUuid), 'children'] as const,
  nok: (crewUuid: string) => [...familyKeys.all(crewUuid), 'nok'] as const,
};

export function useCrewFamily(crewUuid: string) {
  const queryClient = useQueryClient();

  const familyQuery = useQuery({
    queryKey: familyKeys.info(crewUuid),
    queryFn: () => crewFamilyApi.getFamily(crewUuid),
    enabled: !!crewUuid,
    select: (data) => mapFamilyToForm(data),
  });

  const childrenQuery = useQuery({
    queryKey: familyKeys.children(crewUuid),
    queryFn: () => crewFamilyApi.getChildren(crewUuid),
    enabled: !!crewUuid,
    select: (data) => mapChildrenToForm(data),
  });

  const nokQuery = useQuery({
    queryKey: familyKeys.nok(crewUuid),
    queryFn: () => crewFamilyApi.getNextOfKin(crewUuid),
    enabled: !!crewUuid,
    select: (data) => mapNextOfKinToForm(data),
  });

  const upsertFamilyMutation = useMutation({
    mutationFn: (data: FamilyInfoFormData) => {
      const apiData = mapFormToFamily(data);
      return crewFamilyApi.upsertFamily(crewUuid, {
        famUuid: data.famUuid || uuidv4(),
        ...apiData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: familyKeys.info(crewUuid) });
    },
  });

  const addChildMutation = useMutation({
    mutationFn: (data: ChildFormData) => {
      const apiData = mapFormToChild(data);
      return crewFamilyApi.addChild(crewUuid, apiData as Parameters<typeof crewFamilyApi.addChild>[1]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: familyKeys.children(crewUuid) });
    },
  });

  const updateChildMutation = useMutation({
    mutationFn: ({ childUuid, data }: { childUuid: string; data: ChildFormData }) => {
      const apiData = mapFormToChild(data);
      return crewFamilyApi.updateChild(crewUuid, childUuid, apiData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: familyKeys.children(crewUuid) });
    },
  });

  const removeChildMutation = useMutation({
    mutationFn: (childUuid: string) => crewFamilyApi.removeChild(crewUuid, childUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: familyKeys.children(crewUuid) });
    },
  });

  const upsertNokMutation = useMutation({
    mutationFn: (data: NextOfKinFormData) => {
      const apiData = mapFormToNextOfKin(data);
      return crewFamilyApi.upsertNextOfKin(crewUuid, {
        nokUuid: data.nokUuid || uuidv4(),
        ...apiData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: familyKeys.nok(crewUuid) });
    },
  });

  return {
    family: familyQuery.data,
    children: childrenQuery.data || [],
    nextOfKin: nokQuery.data,
    
    isLoading: familyQuery.isLoading || childrenQuery.isLoading || nokQuery.isLoading,
    isError: familyQuery.isError || childrenQuery.isError || nokQuery.isError,
    
    upsertFamily: upsertFamilyMutation,
    addChild: addChildMutation,
    updateChild: updateChildMutation,
    removeChild: removeChildMutation,
    upsertNok: upsertNokMutation,
    
    isMutating: 
      upsertFamilyMutation.isPending || 
      addChildMutation.isPending || 
      updateChildMutation.isPending ||
      removeChildMutation.isPending || 
      upsertNokMutation.isPending,
  };
}
