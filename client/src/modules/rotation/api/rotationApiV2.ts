import { apiRequest } from '@/lib/queryClient';

const V2_BASE = '/api/v2/rotation';

export interface CrewExperienceV2 {
  company: number;
  rank: number;
  tankers: number;
  oow: number;
  endorsements: string;
}

export interface RotationCrewV2 {
  crewUuid: string;
  empNo: string;
  employeeId: string | null;
  firstName: string;
  familyName: string;
  fullName: string;
  presentRank: string;
  status: string;
  availability: string | null;
  nextAvailability: string | null;
  nationalityUuid: string | null;
  vesselTypeUuid: string | null;
  shipType: string | null;
  nationality: string | null;
  currentVesselUuid: string | null;
  currentSignOnDate: string | null;
  reliefDue: string | null;
  isOnboard: boolean;
  pool: string | null;
  manningAgent: string | null;
  experience: CrewExperienceV2;
}

export interface RotationDraftV2 {
  draftUuid: string;
  draftId: string;
  lastEdited: string | null;
  planFromDate: string;
  planToDate: string;
  createdByUuid: string;
  planStatus: string;
  proposedByUuid: string | null;
  proposedDate: string | null;
  createdAt: string;
  updatedAt: string;
  // Summary fields for list view (populated by backend)
  vesselNames?: string;
  crewRanks?: string;
  createdByName?: string;
}

export interface RotationEntryV2 {
  entryUuid: string;
  draftUuid: string;
  vesselUuid: string;
  vesselName?: string;
  activeRevisionUuid: string | null;
  rankId: string | null;
  rank: string;
  crewUuid: string | null;
  crewName?: string;
  signOnDate: string | null;
  joiningPortUuid: string | null;
  joiningPortName?: string;
  contractPeriod: number | null;
  signOffDate: string | null;
  proposalStatus: string;
  proposedByUuid: string | null;
  proposedDate: string | null;
  deployedDate: string | null;
  deployedByUuid: string | null;
  rejectionReason: string | null;
  deployedToPlanUuid: string | null;
  currentCrewUuid: string | null;
  currentCrewName?: string;
  currentCrewSignOnDate: string | null;
  currentCrewContractEnd: string | null;
  currentCrewRangeStart: string | null;
  currentCrewRangeEnd: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RotationDraftVesselV2 {
  rvUuid: string;
  draftUuid: string;
  vesselUuid: string;
  vesselName?: string;
  sortOrder: number;
}

export interface RotationDraftRankV2 {
  rrUuid: string;
  draftUuid: string;
  rankName: string;
  sortOrder: number;
}

export interface CreateDraftInput {
  planFromDate: string;
  planToDate: string;
  createdByUuid: string;
}

export interface CreateEntryInput {
  draftUuid: string;
  vesselUuid: string;
  rank: string;
  rankId?: string;
  crewUuid?: string;
  signOnDate?: string;
  joiningPortUuid?: string;
  contractPeriod?: number;
  currentCrewUuid?: string;
  currentCrewSignOnDate?: string;
  currentCrewContractEnd?: string;
  currentCrewRangeStart?: string;
  currentCrewRangeEnd?: string;
}

export const rotationApiV2 = {
  async getCrewByRank(rank: string): Promise<RotationCrewV2[]> {
    const encodedRank = encodeURIComponent(rank);
    const response = await fetch(`${V2_BASE}/crew/by-rank/${encodedRank}`);
    if (!response.ok) throw new Error('Failed to fetch crew by rank');
    return response.json();
  },

  async getDrafts(): Promise<RotationDraftV2[]> {
    const response = await fetch(`${V2_BASE}/drafts`);
    if (!response.ok) throw new Error('Failed to fetch drafts');
    return response.json();
  },

  async getDraftById(draftUuid: string): Promise<RotationDraftV2 & {
    vessels: RotationDraftVesselV2[];
    ranks: RotationDraftRankV2[];
    entries: RotationEntryV2[];
  }> {
    const response = await fetch(`${V2_BASE}/drafts/${draftUuid}`);
    if (!response.ok) throw new Error('Failed to fetch draft');
    return response.json();
  },

  async createDraft(data: CreateDraftInput): Promise<RotationDraftV2> {
    const response = await apiRequest('POST', `${V2_BASE}/drafts`, data);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to create draft');
    }
    return response.json();
  },

  async updateDraft(draftUuid: string, data: Partial<RotationDraftV2>): Promise<RotationDraftV2> {
    const response = await apiRequest('PATCH', `${V2_BASE}/drafts/${draftUuid}`, data);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to update draft');
    }
    return response.json();
  },

  async deleteDraft(draftUuid: string): Promise<void> {
    const response = await apiRequest('DELETE', `${V2_BASE}/drafts/${draftUuid}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to delete draft');
    }
  },

  async archiveDraft(draftUuid: string): Promise<RotationDraftV2> {
    const response = await apiRequest('POST', `${V2_BASE}/drafts/${draftUuid}/archive`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to archive draft');
    }
    return response.json();
  },

  async unarchiveDraft(draftUuid: string): Promise<RotationDraftV2> {
    const response = await apiRequest('POST', `${V2_BASE}/drafts/${draftUuid}/unarchive`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to unarchive draft');
    }
    return response.json();
  },

  async proposeDraft(draftUuid: string, proposedByUuid: string): Promise<RotationDraftV2> {
    const response = await apiRequest('POST', `${V2_BASE}/drafts/${draftUuid}/propose`, { proposedByUuid });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to propose draft');
    }
    return response.json();
  },

  async addVesselToDraft(draftUuid: string, vesselUuid: string, sortOrder?: number): Promise<RotationDraftVesselV2> {
    const response = await apiRequest('POST', `${V2_BASE}/drafts/${draftUuid}/vessels`, { vesselUuid, sortOrder });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to add vessel to draft');
    }
    return response.json();
  },

  async removeVesselFromDraft(draftUuid: string, rvUuid: string): Promise<void> {
    const response = await apiRequest('DELETE', `${V2_BASE}/drafts/${draftUuid}/vessels/${rvUuid}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to remove vessel from draft');
    }
  },

  async addRankToDraft(draftUuid: string, rankName: string, sortOrder?: number): Promise<RotationDraftRankV2> {
    const response = await apiRequest('POST', `${V2_BASE}/drafts/${draftUuid}/ranks`, { rankName, sortOrder });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to add rank to draft');
    }
    return response.json();
  },

  async removeRankFromDraft(draftUuid: string, rrUuid: string): Promise<void> {
    const response = await apiRequest('DELETE', `${V2_BASE}/drafts/${draftUuid}/ranks/${rrUuid}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to remove rank from draft');
    }
  },

  async getEntries(draftUuid?: string): Promise<RotationEntryV2[]> {
    const url = draftUuid ? `${V2_BASE}/entries?draftUuid=${draftUuid}` : `${V2_BASE}/entries`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch entries');
    return response.json();
  },

  async getEntryById(entryUuid: string): Promise<RotationEntryV2> {
    const response = await fetch(`${V2_BASE}/entries/${entryUuid}`);
    if (!response.ok) throw new Error('Failed to fetch entry');
    return response.json();
  },

  async createEntry(data: CreateEntryInput): Promise<RotationEntryV2> {
    const response = await apiRequest('POST', `${V2_BASE}/entries`, data);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to create entry');
    }
    return response.json();
  },

  async updateEntry(entryUuid: string, data: Partial<RotationEntryV2>): Promise<RotationEntryV2> {
    const response = await apiRequest('PATCH', `${V2_BASE}/entries/${entryUuid}`, data);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to update entry');
    }
    return response.json();
  },

  async deleteEntry(entryUuid: string): Promise<void> {
    const response = await apiRequest('DELETE', `${V2_BASE}/entries/${entryUuid}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to delete entry');
    }
  },

  async deployEntry(entryUuid: string, deployedByUuid: string): Promise<{ success: boolean; planUuid: string }> {
    const response = await apiRequest('POST', `${V2_BASE}/entries/${entryUuid}/deploy`, { 
      deployedByUuid,
      auditUserUuid: deployedByUuid 
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to deploy entry');
    }
    return response.json();
  },

  async rejectEntry(entryUuid: string, rejectionReason: string, rejectedByUuid: string): Promise<RotationEntryV2> {
    const response = await apiRequest('POST', `${V2_BASE}/entries/${entryUuid}/reject`, { 
      rejectionReason, 
      rejectedByUuid,
      auditUserUuid: rejectedByUuid 
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to reject entry');
    }
    return response.json();
  },

  async getArchive(filters?: { vesselUuid?: string; result?: string }): Promise<any[]> {
    const params = new URLSearchParams();
    if (filters?.vesselUuid) params.set('vesselUuid', filters.vesselUuid);
    if (filters?.result) params.set('result', filters.result);
    const url = `${V2_BASE}/archive${params.toString() ? '?' + params : ''}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch archive');
    return response.json();
  },
};
