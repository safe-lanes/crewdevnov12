import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApiV2 } from '../api/adminApiV2';

const V2_KEY = '/api/v2/admin';
const STALE_TIME = 60 * 1000;

export function useFormsV2() {
  return useQuery({
    queryKey: [V2_KEY, 'forms'],
    queryFn: () => adminApiV2.getForms(),
    staleTime: STALE_TIME,
  });
}

export function useFormByUuidV2(formUuid: string | null) {
  return useQuery({
    queryKey: [V2_KEY, 'forms', formUuid],
    queryFn: () => formUuid ? adminApiV2.getFormByUuid(formUuid) : Promise.reject('No UUID'),
    enabled: !!formUuid,
    staleTime: STALE_TIME,
  });
}

export function useCreateFormV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => adminApiV2.createForm(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'forms'] });
    },
  });
}

export function useUpdateFormV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ formUuid, data }: { formUuid: string; data: any }) =>
      adminApiV2.updateForm(formUuid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'forms'] });
    },
  });
}

export function useDeleteFormV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formUuid: string) => adminApiV2.deleteForm(formUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'forms'] });
    },
  });
}

export function useFormForRankV2(rankLabel: string | null, category?: string) {
  return useQuery({
    queryKey: [V2_KEY, 'forms', 'for-rank', rankLabel, category],
    queryFn: () => rankLabel ? adminApiV2.getFormForRank(rankLabel, category) : Promise.reject('No rank'),
    enabled: !!rankLabel,
    staleTime: STALE_TIME,
  });
}

export function useCleanupDuplicatesV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => adminApiV2.cleanupDuplicates(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'forms'] });
    },
  });
}

export function useFormVersionsV2(formUuid: string | null, rankGroupId?: number) {
  return useQuery({
    queryKey: [V2_KEY, 'forms', formUuid, 'versions', rankGroupId],
    queryFn: () => formUuid ? adminApiV2.getFormVersions(formUuid, rankGroupId) : Promise.reject('No UUID'),
    enabled: !!formUuid,
    staleTime: STALE_TIME,
  });
}

export function useCreateFormVersionV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ formUuid, data }: { formUuid: string; data: any }) =>
      adminApiV2.createFormVersion(formUuid, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'forms', variables.formUuid, 'versions'] });
    },
  });
}

export function useRankGroupsV2() {
  return useQuery({
    queryKey: [V2_KEY, 'rank-groups'],
    queryFn: () => adminApiV2.getRankGroups(),
    staleTime: STALE_TIME,
  });
}

export function useRankGroupsByFormUuidV2(formUuid: string | null, includeArchived: boolean = true) {
  return useQuery({
    queryKey: [V2_KEY, 'rank-groups', 'form', formUuid, includeArchived],
    queryFn: () => formUuid ? adminApiV2.getRankGroupsByFormUuid(formUuid, includeArchived) : Promise.reject('No UUID'),
    enabled: !!formUuid,
    staleTime: STALE_TIME,
  });
}

export function useCheckRankAssignmentV2(rankLabel: string | null, formName: string | null) {
  return useQuery({
    queryKey: [V2_KEY, 'rank-groups', 'check-assignment', rankLabel, formName],
    queryFn: () => rankLabel && formName ? adminApiV2.checkRankAssignment(rankLabel, formName) : Promise.reject('Missing params'),
    enabled: !!rankLabel && !!formName,
    staleTime: STALE_TIME,
  });
}

export function useRankGroupByUuidV2(rgUuid: string | null) {
  return useQuery({
    queryKey: [V2_KEY, 'rank-groups', rgUuid],
    queryFn: () => rgUuid ? adminApiV2.getRankGroupByUuid(rgUuid) : Promise.reject('No UUID'),
    enabled: !!rgUuid,
    staleTime: STALE_TIME,
  });
}

export function useCreateRankGroupV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => adminApiV2.createRankGroup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'rank-groups'] });
    },
  });
}

export function useUpdateRankGroupV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rgUuid, data }: { rgUuid: string; data: any }) =>
      adminApiV2.updateRankGroup(rgUuid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'rank-groups'] });
    },
  });
}

export function useUpdateRankGroupConfigV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rgUuid, configuration }: { rgUuid: string; configuration: any }) =>
      adminApiV2.updateRankGroupConfiguration(rgUuid, configuration),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'rank-groups'] });
    },
  });
}

export function useArchiveRankGroupV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rgUuid: string) => adminApiV2.archiveRankGroup(rgUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'rank-groups'] });
    },
  });
}

export function useUnarchiveRankGroupV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rgUuid: string) => adminApiV2.unarchiveRankGroup(rgUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'rank-groups'] });
    },
  });
}

export function useDeleteRankGroupV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rgUuid: string) => adminApiV2.deleteRankGroup(rgUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'rank-groups'] });
    },
  });
}

export function useRankConflictsV2(formUuid: string | null, excludeGroupUuid?: string) {
  return useQuery({
    queryKey: [V2_KEY, 'rank-groups', 'conflicts', formUuid, excludeGroupUuid],
    queryFn: () => formUuid ? adminApiV2.getRankConflicts(formUuid, excludeGroupUuid) : Promise.reject('No UUID'),
    enabled: !!formUuid,
    staleTime: STALE_TIME,
  });
}

export function useAvailableRanksV2(companyOnly?: boolean) {
  return useQuery({
    queryKey: [V2_KEY, 'available-ranks', companyOnly],
    queryFn: () => adminApiV2.getAvailableRanks(companyOnly),
    staleTime: STALE_TIME,
  });
}

export function useCreateAvailableRankV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => adminApiV2.createAvailableRank(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'available-ranks'] });
    },
  });
}

export function useUpdateAvailableRankV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ arUuid, data }: { arUuid: string; data: any }) =>
      adminApiV2.updateAvailableRank(arUuid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'available-ranks'] });
    },
  });
}

export function useDeleteAvailableRankV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (arUuid: string) => adminApiV2.deleteAvailableRank(arUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'available-ranks'] });
    },
  });
}

export function useDeleteAllAvailableRanksV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => adminApiV2.deleteAllAvailableRanks(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'available-ranks'] });
    },
  });
}

export function useReorderAvailableRanksV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orders: { arUuid: string; sortOrder: number }[]) =>
      adminApiV2.reorderAvailableRanks(orders),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'available-ranks'] });
    },
  });
}

export function usePromotionHierarchiesV2() {
  return useQuery({
    queryKey: [V2_KEY, 'promotion-hierarchies'],
    queryFn: () => adminApiV2.getPromotionHierarchies(),
    staleTime: STALE_TIME,
  });
}

export function usePromotionHierarchyByUuidV2(phUuid: string | null) {
  return useQuery({
    queryKey: [V2_KEY, 'promotion-hierarchies', phUuid],
    queryFn: () => phUuid ? adminApiV2.getPromotionHierarchyByUuid(phUuid) : Promise.reject('No UUID'),
    enabled: !!phUuid,
    staleTime: STALE_TIME,
  });
}

export function useCreatePromotionHierarchyV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => adminApiV2.createPromotionHierarchy(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'promotion-hierarchies'] });
    },
  });
}

export function useUpdatePromotionHierarchyV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ phUuid, data }: { phUuid: string; data: any }) =>
      adminApiV2.updatePromotionHierarchy(phUuid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'promotion-hierarchies'] });
    },
  });
}

export function useDeletePromotionHierarchyV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (phUuid: string) => adminApiV2.deletePromotionHierarchy(phUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'promotion-hierarchies'] });
    },
  });
}
