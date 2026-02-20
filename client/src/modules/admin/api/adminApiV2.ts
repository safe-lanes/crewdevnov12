import { apiRequest } from '@/lib/queryClient';

const V2_BASE = '/api/v2/admin';

export const adminApiV2 = {
  async getForms() {
    const res = await fetch(`${V2_BASE}/forms`);
    if (!res.ok) throw new Error('Failed to fetch forms');
    return res.json();
  },

  async getFormById(id: number) {
    const res = await fetch(`${V2_BASE}/forms/${id}`);
    if (!res.ok) throw new Error('Failed to fetch form');
    return res.json();
  },

  async createForm(data: any) {
    const res = await apiRequest('POST', `${V2_BASE}/forms`, data);
    return res.json();
  },

  async updateForm(id: number, data: any) {
    const res = await apiRequest('PUT', `${V2_BASE}/forms/${id}`, data);
    return res.json();
  },

  async deleteForm(id: number) {
    const res = await apiRequest('DELETE', `${V2_BASE}/forms/${id}`);
    return res.json();
  },

  async getFormForRank(rankLabel: string, category?: string) {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    const res = await fetch(`${V2_BASE}/forms/for-rank/${encodeURIComponent(rankLabel)}?${params}`);
    if (!res.ok) throw new Error('Failed to fetch form for rank');
    return res.json();
  },

  async cleanupDuplicates() {
    const res = await apiRequest('POST', `${V2_BASE}/forms/cleanup-duplicates`);
    return res.json();
  },

  async getFormVersions(formId: number, rankGroupId?: number) {
    const params = new URLSearchParams();
    if (rankGroupId !== undefined) params.set('rankGroupId', rankGroupId.toString());
    const res = await fetch(`${V2_BASE}/forms/${formId}/versions?${params}`);
    if (!res.ok) throw new Error('Failed to fetch form versions');
    return res.json();
  },

  async createFormVersion(formId: number, data: any) {
    const res = await apiRequest('POST', `${V2_BASE}/forms/${formId}/versions`, data);
    return res.json();
  },

  async getRankGroups() {
    const res = await fetch(`${V2_BASE}/rank-groups`);
    if (!res.ok) throw new Error('Failed to fetch rank groups');
    return res.json();
  },

  async getRankGroupsByFormId(formId: number, includeArchived: boolean = true) {
    const params = new URLSearchParams();
    if (!includeArchived) params.set('includeArchived', 'false');
    const res = await fetch(`${V2_BASE}/rank-groups/form/${formId}?${params}`);
    if (!res.ok) throw new Error('Failed to fetch rank groups');
    return res.json();
  },

  async checkRankAssignment(rankLabel: string, formName: string) {
    const params = new URLSearchParams({ rankLabel, formName });
    const res = await fetch(`${V2_BASE}/rank-groups/check-assignment?${params}`);
    if (!res.ok) throw new Error('Failed to check rank assignment');
    return res.json();
  },

  async getRankGroupById(id: number) {
    const res = await fetch(`${V2_BASE}/rank-groups/${id}`);
    if (!res.ok) throw new Error('Failed to fetch rank group');
    return res.json();
  },

  async createRankGroup(data: any) {
    const res = await apiRequest('POST', `${V2_BASE}/rank-groups`, data);
    return res.json();
  },

  async updateRankGroup(id: number, data: any) {
    const res = await apiRequest('PUT', `${V2_BASE}/rank-groups/${id}`, data);
    return res.json();
  },

  async updateRankGroupConfiguration(id: number, configuration: any) {
    const res = await apiRequest('PUT', `${V2_BASE}/rank-groups/${id}/configuration`, { configuration });
    return res.json();
  },

  async archiveRankGroup(id: number) {
    const res = await apiRequest('POST', `${V2_BASE}/rank-groups/${id}/archive`);
    return res.json();
  },

  async unarchiveRankGroup(id: number) {
    const res = await apiRequest('POST', `${V2_BASE}/rank-groups/${id}/unarchive`);
    return res.json();
  },

  async deleteRankGroup(id: number) {
    const res = await apiRequest('DELETE', `${V2_BASE}/rank-groups/${id}`);
    return res.json();
  },

  async getRankConflicts(formId: number, excludeGroupId?: number) {
    const params = new URLSearchParams();
    if (excludeGroupId) params.set('excludeGroupId', excludeGroupId.toString());
    const res = await fetch(`${V2_BASE}/rank-groups/form/${formId}/rank-conflicts?${params}`);
    if (!res.ok) throw new Error('Failed to get rank conflicts');
    return res.json();
  },

  async getAvailableRanks(companyOnly?: boolean) {
    const params = new URLSearchParams();
    if (companyOnly) params.set('companyOnly', 'true');
    const res = await fetch(`${V2_BASE}/available-ranks?${params}`);
    if (!res.ok) throw new Error('Failed to fetch available ranks');
    return res.json();
  },

  async createAvailableRank(data: any) {
    const res = await apiRequest('POST', `${V2_BASE}/available-ranks`, data);
    return res.json();
  },

  async updateAvailableRank(id: number, data: any) {
    const res = await apiRequest('PUT', `${V2_BASE}/available-ranks/${id}`, data);
    return res.json();
  },

  async deleteAvailableRank(id: number) {
    const res = await apiRequest('DELETE', `${V2_BASE}/available-ranks/${id}`);
    return res.json();
  },

  async deleteAllAvailableRanks() {
    const res = await apiRequest('DELETE', `${V2_BASE}/available-ranks`);
    return res.json();
  },

  async reorderAvailableRanks(orders: { id: number; sortOrder: number }[]) {
    const res = await apiRequest('POST', `${V2_BASE}/available-ranks/reorder`, orders);
    return res.json();
  },

  async getPromotionHierarchies() {
    const res = await fetch(`${V2_BASE}/promotion-hierarchies`);
    if (!res.ok) throw new Error('Failed to fetch promotion hierarchies');
    return res.json();
  },

  async getPromotionHierarchyById(id: number) {
    const res = await fetch(`${V2_BASE}/promotion-hierarchies/${id}`);
    if (!res.ok) throw new Error('Failed to fetch promotion hierarchy');
    return res.json();
  },

  async createPromotionHierarchy(data: any) {
    const res = await apiRequest('POST', `${V2_BASE}/promotion-hierarchies`, data);
    return res.json();
  },

  async updatePromotionHierarchy(id: number, data: any) {
    const res = await apiRequest('PATCH', `${V2_BASE}/promotion-hierarchies/${id}`, data);
    return res.json();
  },

  async deletePromotionHierarchy(id: number) {
    const res = await apiRequest('DELETE', `${V2_BASE}/promotion-hierarchies/${id}`);
    return res.json();
  },

  async getTrainingMasters() {
    const res = await fetch(`${V2_BASE}/training-master`);
    if (!res.ok) throw new Error('Failed to fetch training masters');
    return res.json();
  },

  async getTrainingMaster(id: number) {
    const res = await fetch(`${V2_BASE}/training-master/${id}`);
    if (!res.ok) throw new Error('Failed to fetch training master');
    return res.json();
  },

  async createTrainingMaster(data: any) {
    const res = await apiRequest('POST', `${V2_BASE}/training-master`, data);
    return res.json();
  },

  async updateTrainingMaster(id: number, data: any) {
    const res = await apiRequest('PATCH', `${V2_BASE}/training-master/${id}`, data);
    return res.json();
  },

  async deleteTrainingMaster(id: number) {
    const res = await apiRequest('DELETE', `${V2_BASE}/training-master/${id}`);
    return res.json();
  },

  async batchUpdateTrainingMasters(updates: Array<{id: number, data: any}>) {
    const res = await apiRequest('PATCH', `${V2_BASE}/training-master/batch`, updates);
    return res.json();
  },

  async reorderTrainingMasters(orders: Array<{id: number, sortOrder: number}>) {
    const res = await apiRequest('POST', `${V2_BASE}/training-master/reorder`, orders);
    return res.json();
  },

  async getCompanyTrainingGroups() {
    const res = await fetch(`${V2_BASE}/company-training-groups`);
    if (!res.ok) throw new Error('Failed to fetch company training groups');
    return res.json();
  },

  async updateCompanyTrainingGroup(code: string, data: any) {
    const res = await apiRequest('PATCH', `${V2_BASE}/company-training-groups/${encodeURIComponent(code)}`, data);
    return res.json();
  },

  async getCompanyTrainings() {
    const res = await fetch(`${V2_BASE}/company-trainings`);
    if (!res.ok) throw new Error('Failed to fetch company trainings');
    return res.json();
  },

  async getCompanyTraining(id: number) {
    const res = await fetch(`${V2_BASE}/company-trainings/${id}`);
    if (!res.ok) throw new Error('Failed to fetch company training');
    return res.json();
  },

  async createCompanyTraining(data: any) {
    const res = await apiRequest('POST', `${V2_BASE}/company-trainings`, data);
    return res.json();
  },

  async updateCompanyTraining(id: number, data: any) {
    const res = await apiRequest('PATCH', `${V2_BASE}/company-trainings/${id}`, data);
    return res.json();
  },

  async deleteCompanyTraining(id: number) {
    const res = await apiRequest('DELETE', `${V2_BASE}/company-trainings/${id}`);
    return res.json();
  },

  async importCompanyTrainings() {
    const res = await apiRequest('POST', `${V2_BASE}/company-trainings/import`);
    return res.json();
  },

  async reorderCompanyTrainings(orders: Array<{id: number, sortOrder: number}>) {
    const res = await apiRequest('POST', `${V2_BASE}/company-trainings/reorder`, orders);
    return res.json();
  },

  async getCompanyTrainingRequirements() {
    const res = await fetch(`${V2_BASE}/company-training-requirements`);
    if (!res.ok) throw new Error('Failed to fetch company training requirements');
    return res.json();
  },

  async upsertCompanyTrainingRequirements(requirements: Array<{companyTrainingId: number, rankId: number, status: string | null}>) {
    const res = await apiRequest('POST', `${V2_BASE}/company-training-requirements/batch`, requirements);
    return res.json();
  },

  async getCompanyRanks() {
    const res = await fetch(`${V2_BASE}/company-ranks`);
    if (!res.ok) throw new Error('Failed to fetch company ranks');
    return res.json();
  },

  async saveCompanyRanks(ranks: any[]) {
    const res = await apiRequest('POST', `${V2_BASE}/company-ranks`, ranks);
    return res.json();
  },

  async getCompanyRankByName(rankName: string) {
    const res = await fetch(`${V2_BASE}/company-ranks/by-name/${encodeURIComponent(rankName)}`);
    if (!res.ok) throw new Error('Failed to fetch company rank by name');
    return res.json();
  },

  async getVesselGroups() {
    const res = await fetch(`${V2_BASE}/vessel-groups`);
    if (!res.ok) throw new Error('Failed to fetch vessel groups');
    return res.json();
  },

  async getVesselGroup(id: number) {
    const res = await fetch(`${V2_BASE}/vessel-groups/${id}`);
    if (!res.ok) throw new Error('Failed to fetch vessel group');
    return res.json();
  },

  async createVesselGroup(data: any) {
    const res = await apiRequest('POST', `${V2_BASE}/vessel-groups`, data);
    return res.json();
  },

  async updateVesselGroup(id: number, data: any) {
    const res = await apiRequest('PATCH', `${V2_BASE}/vessel-groups/${id}`, data);
    return res.json();
  },

  async deleteVesselGroup(id: number) {
    const res = await apiRequest('DELETE', `${V2_BASE}/vessel-groups/${id}`);
    return res.json();
  },

  async getVesselDrafts() {
    const res = await fetch(`${V2_BASE}/vessel-drafts`);
    if (!res.ok) throw new Error('Failed to fetch vessel drafts');
    return res.json();
  },

  async getVesselDraft(id: number) {
    const res = await fetch(`${V2_BASE}/vessel-drafts/${id}`);
    if (!res.ok) throw new Error('Failed to fetch vessel draft');
    return res.json();
  },

  async getVesselDraftsByVessel(vesselId: string) {
    const res = await fetch(`${V2_BASE}/vessel-drafts/by-vessel/${encodeURIComponent(vesselId)}`);
    if (!res.ok) throw new Error('Failed to fetch vessel drafts by vessel');
    return res.json();
  },

  async createVesselDraft(data: any) {
    const res = await apiRequest('POST', `${V2_BASE}/vessel-drafts`, data);
    return res.json();
  },

  async updateVesselDraft(id: number, data: any) {
    const res = await apiRequest('PATCH', `${V2_BASE}/vessel-drafts/${id}`, data);
    return res.json();
  },

  async deleteVesselDraft(id: number) {
    const res = await apiRequest('DELETE', `${V2_BASE}/vessel-drafts/${id}`);
    return res.json();
  },

  async upsertVesselDraft(data: any) {
    const res = await apiRequest('POST', `${V2_BASE}/vessel-drafts/upsert`, data);
    return res.json();
  },

  async getVesselRevisions() {
    const res = await fetch(`${V2_BASE}/vessel-revisions`);
    if (!res.ok) throw new Error('Failed to fetch vessel revisions');
    return res.json();
  },

  async getVesselRevision(id: number) {
    const res = await fetch(`${V2_BASE}/vessel-revisions/${id}`);
    if (!res.ok) throw new Error('Failed to fetch vessel revision');
    return res.json();
  },

  async getVesselRevisionsByVessel(vesselId: string) {
    const res = await fetch(`${V2_BASE}/vessel-revisions/by-vessel/${encodeURIComponent(vesselId)}`);
    if (!res.ok) throw new Error('Failed to fetch vessel revisions by vessel');
    return res.json();
  },

  async getNextVesselRevision(vesselId: string) {
    const res = await fetch(`${V2_BASE}/vessel-revisions/next-revision/${encodeURIComponent(vesselId)}`);
    if (!res.ok) throw new Error('Failed to fetch next vessel revision');
    return res.json();
  },

  async createVesselRevision(data: any) {
    const res = await apiRequest('POST', `${V2_BASE}/vessel-revisions`, data);
    return res.json();
  },

  async submitVesselRevision(data: any) {
    const res = await apiRequest('POST', `${V2_BASE}/vessel-revisions/submit`, data);
    return res.json();
  },

  async getTrainingMatrixVesselDrafts() {
    const res = await fetch(`${V2_BASE}/training-matrix-vessel-drafts`);
    if (!res.ok) throw new Error('Failed to fetch training matrix vessel drafts');
    return res.json();
  },

  async getTrainingMatrixVesselDraft(id: number) {
    const res = await fetch(`${V2_BASE}/training-matrix-vessel-drafts/${id}`);
    if (!res.ok) throw new Error('Failed to fetch training matrix vessel draft');
    return res.json();
  },

  async getTrainingMatrixVesselDraftsByVessel(vesselId: string) {
    const res = await fetch(`${V2_BASE}/training-matrix-vessel-drafts/by-vessel/${encodeURIComponent(vesselId)}`);
    if (!res.ok) throw new Error('Failed to fetch training matrix vessel drafts by vessel');
    return res.json();
  },

  async createTrainingMatrixVesselDraft(data: any) {
    const res = await apiRequest('POST', `${V2_BASE}/training-matrix-vessel-drafts`, data);
    return res.json();
  },

  async updateTrainingMatrixVesselDraft(id: number, data: any) {
    const res = await apiRequest('PATCH', `${V2_BASE}/training-matrix-vessel-drafts/${id}`, data);
    return res.json();
  },

  async deleteTrainingMatrixVesselDraft(id: number) {
    const res = await apiRequest('DELETE', `${V2_BASE}/training-matrix-vessel-drafts/${id}`);
    return res.json();
  },

  async upsertTrainingMatrixVesselDraft(data: any) {
    const res = await apiRequest('POST', `${V2_BASE}/training-matrix-vessel-drafts/upsert`, data);
    return res.json();
  },

  async getTrainingMatrixVesselRevisions() {
    const res = await fetch(`${V2_BASE}/training-matrix-vessel-revisions`);
    if (!res.ok) throw new Error('Failed to fetch training matrix vessel revisions');
    return res.json();
  },

  async getTrainingMatrixVesselRevision(id: number) {
    const res = await fetch(`${V2_BASE}/training-matrix-vessel-revisions/${id}`);
    if (!res.ok) throw new Error('Failed to fetch training matrix vessel revision');
    return res.json();
  },

  async getTrainingMatrixVesselRevisionsByVessel(vesselId: string) {
    const res = await fetch(`${V2_BASE}/training-matrix-vessel-revisions/by-vessel/${encodeURIComponent(vesselId)}`);
    if (!res.ok) throw new Error('Failed to fetch training matrix vessel revisions by vessel');
    return res.json();
  },

  async getNextTrainingMatrixVesselRevision(vesselId: string) {
    const res = await fetch(`${V2_BASE}/training-matrix-vessel-revisions/next-revision/${encodeURIComponent(vesselId)}`);
    if (!res.ok) throw new Error('Failed to fetch next training matrix vessel revision');
    return res.json();
  },

  async createTrainingMatrixVesselRevision(data: any) {
    const res = await apiRequest('POST', `${V2_BASE}/training-matrix-vessel-revisions`, data);
    return res.json();
  },

  async submitTrainingMatrixVesselRevision(data: any) {
    const res = await apiRequest('POST', `${V2_BASE}/training-matrix-vessel-revisions/submit`, data);
    return res.json();
  },

  async getMasterData(type: string) {
    const res = await fetch(`/api/v2/masters/external/${encodeURIComponent(type)}`);
    if (!res.ok) throw new Error(`Failed to fetch master data: ${type}`);
    const json = await res.json();
    return json.data;
  },
};
