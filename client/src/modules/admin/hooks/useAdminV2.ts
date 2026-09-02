import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApiV2 } from '../api/adminApiV2';
import { getCrewUserId } from '@/lib/crewUser';

const V2_KEY = '/api/v2/admin';
const STALE_TIME = 60 * 1000;

function withAuditUser<T>(data: T): T {
  const auditUserUuid = getCrewUserId();
  if (Array.isArray(data)) {
    return data.map(item =>
      typeof item === 'object' && item !== null
        ? { ...item, auditUserUuid }
        : item
    ) as T;
  }
  if (typeof data === 'object' && data !== null) {
    return { ...data, auditUserUuid };
  }
  return data;
}

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
    mutationFn: (data: any) => adminApiV2.createForm(withAuditUser(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'forms'] });
    },
  });
}

export function useUpdateFormV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ formUuid, data }: { formUuid: string; data: any }) =>
      adminApiV2.updateForm(formUuid, withAuditUser(data)),
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
      adminApiV2.createFormVersion(formUuid, withAuditUser(data)),
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

export type FormCopySource = {
  sourceRankGroupId: number;
  sourceRankGroupName: string;
  sourceFormVersionUuid: string;
  versionNo: string;
  status: 'draft' | 'released';
  sections: number;
  questions: number;
  optionSets: number;
  options: number;
};

export type FormCopySourcesResponse = {
  target: {
    rankGroupId: number;
    rankGroupName: string;
    formId: number;
    draftVersionUuid: string | null;
    draftVersionNo: string | null;
    releasedVersionNo: string | null;
    targetStatus: 'draft' | 'released' | 'empty';
    sections: number;
    questions: number;
    optionSets: number;
    options: number;
  };
  sources: FormCopySource[];
};

export function useFormCopySourcesV2(rankGroupId: number | null) {
  return useQuery<FormCopySourcesResponse>({
    queryKey: [V2_KEY, 'rank-groups', rankGroupId, 'copy-sources'],
    queryFn: () => rankGroupId
      ? adminApiV2.getFormCopySources(rankGroupId)
      : Promise.reject('No rank group'),
    enabled: rankGroupId !== null,
    staleTime: 0,
  });
}

export function useCopyFormConfigurationV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      targetRankGroupId,
      sourceFormVersionUuid,
      confirmReplace,
    }: {
      targetRankGroupId: number;
      sourceFormVersionUuid: string;
      confirmReplace: boolean;
    }) => adminApiV2.copyFormConfiguration(targetRankGroupId, {
      sourceFormVersionUuid,
      confirmReplace,
    }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'rank-groups', variables.targetRankGroupId, 'copy-sources'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/admin/forms'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/admin/rank-groups'] });
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return key === '/api/v2/admin/form-versions-all'
          || (typeof key === 'string' && key.startsWith('/api/v2/admin/forms/'));
      }});
    },
  });
}

export function useCreateRankGroupV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => adminApiV2.createRankGroup(withAuditUser(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'rank-groups'] });
    },
  });
}

export function useUpdateRankGroupV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rgUuid, data }: { rgUuid: string; data: any }) =>
      adminApiV2.updateRankGroup(rgUuid, withAuditUser(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'rank-groups'] });
    },
  });
}

export function useUpdateRankGroupConfigV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rgUuid, configuration }: { rgUuid: string; configuration: any }) =>
      adminApiV2.updateRankGroupConfiguration(rgUuid, withAuditUser(configuration)),
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

export function useAvailableRanksV2(companyOnly?: boolean, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [V2_KEY, 'available-ranks', companyOnly],
    queryFn: () => adminApiV2.getAvailableRanks(companyOnly),
    staleTime: STALE_TIME,
    enabled: options?.enabled !== false,
  });
}

export function useCreateAvailableRankV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => adminApiV2.createAvailableRank(withAuditUser(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'available-ranks'] });
    },
  });
}

export function useUpdateAvailableRankV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      adminApiV2.updateAvailableRank(id, withAuditUser(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'available-ranks'] });
    },
  });
}

export function useDeleteAvailableRankV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminApiV2.deleteAvailableRank(id),
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
    mutationFn: (orders: { id: number; sortOrder: number }[]) =>
      adminApiV2.reorderAvailableRanks(withAuditUser(orders)),
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
    mutationFn: (data: any) => adminApiV2.createPromotionHierarchy(withAuditUser(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'promotion-hierarchies'] });
    },
  });
}

export function useUpdatePromotionHierarchyV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ phUuid, data }: { phUuid: string; data: any }) =>
      adminApiV2.updatePromotionHierarchy(phUuid, withAuditUser(data)),
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

export function useTrainingMastersV2(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [V2_KEY, 'training-master'],
    queryFn: () => adminApiV2.getTrainingMasters(),
    staleTime: STALE_TIME,
    enabled: options?.enabled !== false,
  });
}

export function useCreateTrainingMasterV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => adminApiV2.createTrainingMaster(withAuditUser(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'training-master'] });
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'company-trainings'] });
    },
  });
}

export function useUpdateTrainingMasterV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      adminApiV2.updateTrainingMaster(id, withAuditUser(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'training-master'] });
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'company-trainings'] });
    },
  });
}

export function useDeleteTrainingMasterV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminApiV2.deleteTrainingMaster(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'training-master'] });
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'company-trainings'] });
    },
  });
}

export function useBatchUpdateTrainingMastersV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: Array<{id: number, data: any}>) =>
      adminApiV2.batchUpdateTrainingMasters(withAuditUser(updates)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'training-master'] });
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'company-trainings'] });
    },
  });
}

export function useReorderTrainingMastersV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orders: Array<{id: number, sortOrder: number}>) =>
      adminApiV2.reorderTrainingMasters(withAuditUser(orders)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'training-master'] });
    },
  });
}

export function useCompanyTrainingGroupsV2(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [V2_KEY, 'company-training-groups'],
    queryFn: () => adminApiV2.getCompanyTrainingGroups(),
    staleTime: STALE_TIME,
    enabled: options?.enabled !== false,
  });
}

export function useUpdateCompanyTrainingGroupV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ code, data }: { code: string; data: any }) =>
      adminApiV2.updateCompanyTrainingGroup(code, withAuditUser(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'company-training-groups'] });
    },
  });
}

export function useCompanyTrainingsV2(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [V2_KEY, 'company-trainings'],
    queryFn: () => adminApiV2.getCompanyTrainings(),
    staleTime: STALE_TIME,
    enabled: options?.enabled !== false,
  });
}

export function useUpdateCompanyTrainingV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      adminApiV2.updateCompanyTraining(id, withAuditUser(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'company-trainings'] });
    },
  });
}

export function useDeleteCompanyTrainingV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminApiV2.deleteCompanyTraining(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'company-trainings'] });
    },
  });
}

export function useImportCompanyTrainingsV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => adminApiV2.importCompanyTrainings(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'company-trainings'] });
    },
  });
}

export function useReorderCompanyTrainingsV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orders: Array<{id: number, sortOrder: number}>) =>
      adminApiV2.reorderCompanyTrainings(withAuditUser(orders)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'company-trainings'] });
    },
  });
}

export function useCompanyTrainingRequirementsV2(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [V2_KEY, 'company-training-requirements'],
    queryFn: () => adminApiV2.getCompanyTrainingRequirements(),
    staleTime: STALE_TIME,
    enabled: options?.enabled !== false,
  });
}

export function useUpsertCompanyTrainingRequirementsV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requirements: Array<{companyTrainingId: number, rankId: number, status: string | null}>) =>
      adminApiV2.upsertCompanyTrainingRequirements(withAuditUser(requirements)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'company-training-requirements'] });
    },
  });
}

export function useCompanyRanksV2(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [V2_KEY, 'company-ranks'],
    queryFn: () => adminApiV2.getCompanyRanks(),
    staleTime: STALE_TIME,
    enabled: options?.enabled !== false,
  });
}

export function useSaveCompanyRanksV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ranks: any[]) => adminApiV2.saveCompanyRanks(withAuditUser(ranks)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'company-ranks'] });
    },
  });
}

export function useVesselGroupsV2(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [V2_KEY, 'vessel-groups'],
    queryFn: () => adminApiV2.getVesselGroups(),
    staleTime: STALE_TIME,
    enabled: options?.enabled !== false,
  });
}

export function useCreateVesselGroupV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => adminApiV2.createVesselGroup(withAuditUser(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'vessel-groups'] });
    },
  });
}

export function useUpdateVesselGroupV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      adminApiV2.updateVesselGroup(id, withAuditUser(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'vessel-groups'] });
    },
  });
}

export function useDeleteVesselGroupV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminApiV2.deleteVesselGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'vessel-groups'] });
    },
  });
}

export function useVesselDraftsByVesselV2(vesselId: string | null) {
  return useQuery({
    queryKey: [V2_KEY, 'vessel-drafts', 'by-vessel', vesselId],
    queryFn: () => adminApiV2.getVesselDraftsByVessel(vesselId!),
    enabled: !!vesselId,
    staleTime: STALE_TIME,
  });
}

export function useUpsertVesselDraftV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => adminApiV2.upsertVesselDraft(withAuditUser(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'vessel-drafts'] });
    },
  });
}

export function useVesselRevisionsByVesselV2(vesselId: string | null) {
  return useQuery({
    queryKey: [V2_KEY, 'vessel-revisions', 'by-vessel', vesselId],
    queryFn: () => adminApiV2.getVesselRevisionsByVessel(vesselId!),
    enabled: !!vesselId,
    staleTime: STALE_TIME,
  });
}

export function useNextVesselRevisionV2(vesselId: string | null) {
  return useQuery({
    queryKey: [V2_KEY, 'vessel-revisions', 'next-revision', vesselId],
    queryFn: () => adminApiV2.getNextVesselRevision(vesselId!),
    enabled: !!vesselId,
    staleTime: STALE_TIME,
  });
}

export function useSubmitVesselRevisionV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => adminApiV2.submitVesselRevision(withAuditUser(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'vessel-revisions'] });
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'vessel-drafts'] });
    },
  });
}

export function useTrainingMatrixVesselDraftsByVesselV2(vesselId: string | null) {
  return useQuery({
    queryKey: [V2_KEY, 'training-matrix-vessel-drafts', 'by-vessel', vesselId],
    queryFn: () => adminApiV2.getTrainingMatrixVesselDraftsByVessel(vesselId!),
    enabled: !!vesselId,
    staleTime: STALE_TIME,
  });
}

export function useUpsertTrainingMatrixVesselDraftV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => adminApiV2.upsertTrainingMatrixVesselDraft(withAuditUser(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'training-matrix-vessel-drafts'] });
    },
  });
}

export function useTrainingMatrixVesselRevisionsByVesselV2(vesselId: string | null) {
  return useQuery({
    queryKey: [V2_KEY, 'training-matrix-vessel-revisions', 'by-vessel', vesselId],
    queryFn: () => adminApiV2.getTrainingMatrixVesselRevisionsByVessel(vesselId!),
    enabled: !!vesselId,
    staleTime: STALE_TIME,
  });
}

export function useNextTrainingMatrixVesselRevisionV2(vesselId: string | null) {
  return useQuery({
    queryKey: [V2_KEY, 'training-matrix-vessel-revisions', 'next-revision', vesselId],
    queryFn: () => adminApiV2.getNextTrainingMatrixVesselRevision(vesselId!),
    enabled: !!vesselId,
    staleTime: STALE_TIME,
  });
}

export function useSubmitTrainingMatrixVesselRevisionV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => adminApiV2.submitTrainingMatrixVesselRevision(withAuditUser(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'training-matrix-vessel-revisions'] });
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'training-matrix-vessel-drafts'] });
    },
  });
}

export function useMasterDataV2(type: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [V2_KEY, 'master-data', type],
    queryFn: () => adminApiV2.getMasterData(type),
    enabled: options?.enabled !== false,
    staleTime: STALE_TIME,
  });
}

export function useAccessControlMenusV2(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [V2_KEY, 'access-control', 'menus'],
    queryFn: () => adminApiV2.getAccessControlMenus(),
    enabled: options?.enabled !== false,
    staleTime: STALE_TIME,
  });
}

export function useAccessControlRolesV2(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [V2_KEY, 'access-control', 'roles'],
    queryFn: () => adminApiV2.getAccessControlRoles(),
    enabled: options?.enabled !== false,
    staleTime: STALE_TIME,
  });
}

export function useAccessControlPermissionsV2(ruid: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [V2_KEY, 'access-control', 'permissions', ruid],
    queryFn: () => ruid ? adminApiV2.getAccessControlPermissions(ruid) : Promise.reject('No ruid'),
    enabled: !!ruid && options?.enabled !== false,
    staleTime: STALE_TIME,
  });
}

export function useCreateAccessControlMenuV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => adminApiV2.createAccessControlMenu(withAuditUser(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'access-control', 'menus'] });
    },
  });
}

export function useUpdateAccessControlMenuV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ muid, data }: { muid: string; data: any }) => adminApiV2.updateAccessControlMenu(muid, withAuditUser(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'access-control', 'menus'] });
    },
  });
}

export function useDeleteAccessControlMenuV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (muid: string) => adminApiV2.deleteAccessControlMenu(muid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'access-control', 'menus'] });
    },
  });
}

export function useCreateAccessControlRoleV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => adminApiV2.createAccessControlRole(withAuditUser(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'access-control', 'roles'] });
    },
  });
}

export function useUpdateAccessControlRoleV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ruid, data }: { ruid: string; data: any }) => adminApiV2.updateAccessControlRole(ruid, withAuditUser(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'access-control', 'roles'] });
    },
  });
}

export function useDeleteAccessControlRoleV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ruid: string) => adminApiV2.deleteAccessControlRole(ruid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'access-control', 'roles'] });
    },
  });
}

export function useSaveAccessControlPermissionsV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ruid, permissions }: { ruid: string; permissions: any[] }) => adminApiV2.saveAccessControlPermissions(ruid, permissions),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_KEY, 'access-control', 'permissions', variables.ruid] });
    },
  });
}
