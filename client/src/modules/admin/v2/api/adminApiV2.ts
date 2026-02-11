import { apiRequest } from '@/lib/queryClient';

const V2_BASE = '/api/v2/admin';

export const adminApiV2 = {
  async getForms() {
    const res = await fetch(`${V2_BASE}/forms`);
    if (!res.ok) throw new Error('Failed to fetch forms');
    return res.json();
  },

  async getFormByUuid(formUuid: string) {
    const res = await fetch(`${V2_BASE}/forms/${formUuid}`);
    if (!res.ok) throw new Error('Failed to fetch form');
    return res.json();
  },

  async createForm(data: any) {
    const res = await apiRequest('POST', `${V2_BASE}/forms`, data);
    return res.json();
  },

  async updateForm(formUuid: string, data: any) {
    const res = await apiRequest('PUT', `${V2_BASE}/forms/${formUuid}`, data);
    return res.json();
  },

  async deleteForm(formUuid: string) {
    const res = await apiRequest('DELETE', `${V2_BASE}/forms/${formUuid}`);
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

  async getFormVersions(formUuid: string, rankGroupId?: number) {
    const params = new URLSearchParams();
    if (rankGroupId !== undefined) params.set('rankGroupId', rankGroupId.toString());
    const res = await fetch(`${V2_BASE}/forms/${formUuid}/versions?${params}`);
    if (!res.ok) throw new Error('Failed to fetch form versions');
    return res.json();
  },

  async createFormVersion(formUuid: string, data: any) {
    const res = await apiRequest('POST', `${V2_BASE}/forms/${formUuid}/versions`, data);
    return res.json();
  },

  async getRankGroups() {
    const res = await fetch(`${V2_BASE}/rank-groups`);
    if (!res.ok) throw new Error('Failed to fetch rank groups');
    return res.json();
  },

  async getRankGroupsByFormUuid(formUuid: string, includeArchived: boolean = true) {
    const params = new URLSearchParams();
    if (!includeArchived) params.set('includeArchived', 'false');
    const res = await fetch(`${V2_BASE}/rank-groups/form/${formUuid}?${params}`);
    if (!res.ok) throw new Error('Failed to fetch rank groups');
    return res.json();
  },

  async checkRankAssignment(rankLabel: string, formName: string) {
    const params = new URLSearchParams({ rankLabel, formName });
    const res = await fetch(`${V2_BASE}/rank-groups/check-assignment?${params}`);
    if (!res.ok) throw new Error('Failed to check rank assignment');
    return res.json();
  },

  async getRankGroupByUuid(rgUuid: string) {
    const res = await fetch(`${V2_BASE}/rank-groups/${rgUuid}`);
    if (!res.ok) throw new Error('Failed to fetch rank group');
    return res.json();
  },

  async createRankGroup(data: any) {
    const res = await apiRequest('POST', `${V2_BASE}/rank-groups`, data);
    return res.json();
  },

  async updateRankGroup(rgUuid: string, data: any) {
    const res = await apiRequest('PUT', `${V2_BASE}/rank-groups/${rgUuid}`, data);
    return res.json();
  },

  async updateRankGroupConfiguration(rgUuid: string, configuration: any) {
    const res = await apiRequest('PUT', `${V2_BASE}/rank-groups/${rgUuid}/configuration`, { configuration });
    return res.json();
  },

  async archiveRankGroup(rgUuid: string) {
    const res = await apiRequest('POST', `${V2_BASE}/rank-groups/${rgUuid}/archive`);
    return res.json();
  },

  async unarchiveRankGroup(rgUuid: string) {
    const res = await apiRequest('POST', `${V2_BASE}/rank-groups/${rgUuid}/unarchive`);
    return res.json();
  },

  async deleteRankGroup(rgUuid: string) {
    const res = await apiRequest('DELETE', `${V2_BASE}/rank-groups/${rgUuid}`);
    return res.json();
  },

  async getRankConflicts(formUuid: string, excludeGroupUuid?: string) {
    const params = new URLSearchParams();
    if (excludeGroupUuid) params.set('excludeGroupUuid', excludeGroupUuid);
    const res = await fetch(`${V2_BASE}/rank-groups/form/${formUuid}/rank-conflicts?${params}`);
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

  async updateAvailableRank(arUuid: string, data: any) {
    const res = await apiRequest('PUT', `${V2_BASE}/available-ranks/${arUuid}`, data);
    return res.json();
  },

  async deleteAvailableRank(arUuid: string) {
    const res = await apiRequest('DELETE', `${V2_BASE}/available-ranks/${arUuid}`);
    return res.json();
  },

  async deleteAllAvailableRanks() {
    const res = await apiRequest('DELETE', `${V2_BASE}/available-ranks`);
    return res.json();
  },

  async reorderAvailableRanks(orders: { arUuid: string; sortOrder: number }[]) {
    const res = await apiRequest('POST', `${V2_BASE}/available-ranks/reorder`, { orders });
    return res.json();
  },

  async getPromotionHierarchies() {
    const res = await fetch(`${V2_BASE}/promotion-hierarchies`);
    if (!res.ok) throw new Error('Failed to fetch promotion hierarchies');
    return res.json();
  },

  async getPromotionHierarchyByUuid(phUuid: string) {
    const res = await fetch(`${V2_BASE}/promotion-hierarchies/${phUuid}`);
    if (!res.ok) throw new Error('Failed to fetch promotion hierarchy');
    return res.json();
  },

  async createPromotionHierarchy(data: any) {
    const res = await apiRequest('POST', `${V2_BASE}/promotion-hierarchies`, data);
    return res.json();
  },

  async updatePromotionHierarchy(phUuid: string, data: any) {
    const res = await apiRequest('PATCH', `${V2_BASE}/promotion-hierarchies/${phUuid}`, data);
    return res.json();
  },

  async deletePromotionHierarchy(phUuid: string) {
    const res = await apiRequest('DELETE', `${V2_BASE}/promotion-hierarchies/${phUuid}`);
    return res.json();
  },
};
