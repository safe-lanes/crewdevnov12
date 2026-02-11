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
};
