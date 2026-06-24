import { apiRequest } from '@/lib/queryClient';

const V2_BASE = '/api/v2/rest-hours';

function getCrewUserId(): string | null {
  try {
    return localStorage.getItem("crewUserId") || null;
  } catch {
    return null;
  }
}

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
    return {
      ...data,
      auditUserUuid,
    };
  }

  return data;
}

export const restHoursApiV2 = {
  vesselRecords: {
    async getAll(params?: { vesselUuid?: string | string[]; month?: string; year?: string; monthValue?: string; complianceMode?: 'Rest' | 'Work'; opaMode?: boolean }) {
      const searchParams = new URLSearchParams();
      if (params?.vesselUuid) {
        const v = Array.isArray(params.vesselUuid) ? params.vesselUuid.filter(Boolean).join(',') : params.vesselUuid;
        if (v) searchParams.set('vesselUuid', v);
      }
      if (params?.monthValue) {
        searchParams.set('monthValue', params.monthValue);
      } else if (params?.month && params?.year) {
        searchParams.set('monthValue', `${params.year}-${params.month.padStart(2, '0')}`);
      }
      if (params?.complianceMode) searchParams.set('complianceMode', params.complianceMode);
      if (params?.opaMode) searchParams.set('opaMode', 'true');
      const url = `${V2_BASE}/vessel-records${searchParams.toString() ? '?' + searchParams : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status}: Failed to fetch vessel records`);
      return response.json();
    },

    async getByUuid(uuid: string) {
      const response = await fetch(`${V2_BASE}/vessel-records/${uuid}`);
      if (!response.ok) throw new Error('Failed to fetch vessel record');
      return response.json();
    },

    async create(data: any) {
      const response = await apiRequest('POST', `${V2_BASE}/vessel-records`, withAuditUser(data));
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to create vessel record');
      }
      return response.json();
    },

    async update(uuid: string, data: any) {
      const response = await apiRequest('PATCH', `${V2_BASE}/vessel-records/${uuid}`, withAuditUser(data));
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to update vessel record');
      }
      return response.json();
    },

    async toggleLock(uuid: string, isLocked: boolean) {
      const response = await apiRequest('PATCH', `${V2_BASE}/vessel-records/${uuid}`, withAuditUser({ isLocked }));
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to update lock state');
      }
      return response.json();
    },

    async delete(uuid: string) {
      const response = await apiRequest('DELETE', `${V2_BASE}/vessel-records/${uuid}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to delete vessel record');
      }
      return response.json();
    },

    // V1 pattern: /api/rest-hours-vessel-records/submit-review
    async submitVesselReview(uuid: string, data: any) {
      const response = await apiRequest('POST', `${V2_BASE}/vessel-records/${uuid}/submit-vessel-review`, withAuditUser(data));
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to submit vessel review');
      }
      return response.json();
    },

    // V1 pattern: /api/rest-hours-vessel-records/submit-office-review
    async submitOfficeReview(uuid: string, data: any) {
      const response = await apiRequest('POST', `${V2_BASE}/vessel-records/${uuid}/submit-office-review`, withAuditUser(data));
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to submit office review');
      }
      return response.json();
    },
  },

  crewRecords: {
    async getAll(params?: { vesselId?: string | string[]; monthValue?: string; monthValues?: string[]; ranks?: string[]; search?: string; complianceMode?: 'Rest' | 'Work'; opaMode?: boolean }) {
      const searchParams = new URLSearchParams();
      if (params?.vesselId) {
        const v = Array.isArray(params.vesselId) ? params.vesselId.filter(Boolean).join(',') : params.vesselId;
        if (v) searchParams.set('vesselId', v);
      }
      if (params?.monthValue) searchParams.set('monthValue', params.monthValue);
      if (params?.monthValues && params.monthValues.length > 0) {
        const mv = params.monthValues.filter(Boolean).join(',');
        if (mv) searchParams.set('monthValues', mv);
      }
      if (params?.ranks && params.ranks.length > 0) {
        params.ranks.forEach(rank => searchParams.append('ranks', rank));
      }
      if (params?.search) searchParams.set('search', params.search);
      if (params?.complianceMode) searchParams.set('complianceMode', params.complianceMode);
      if (params?.opaMode) searchParams.set('opaMode', 'true');
      const url = `${V2_BASE}/crew-records${searchParams.toString() ? '?' + searchParams : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status}: Failed to fetch crew records`);
      return response.json();
    },

    async getByUuid(uuid: string) {
      const response = await fetch(`${V2_BASE}/crew-records/${uuid}`);
      if (!response.ok) throw new Error('Failed to fetch crew record');
      return response.json();
    },

    async create(data: any) {
      const response = await apiRequest('POST', `${V2_BASE}/crew-records`, withAuditUser(data));
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to create crew record');
      }
      return response.json();
    },

    async update(uuid: string, data: any) {
      const response = await apiRequest('PATCH', `${V2_BASE}/crew-records/${uuid}`, withAuditUser(data));
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to update crew record');
      }
      return response.json();
    },

    async delete(uuid: string) {
      const response = await apiRequest('DELETE', `${V2_BASE}/crew-records/${uuid}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to delete crew record');
      }
      return response.json();
    },

    // V1 pattern: /api/rest-hours-violations-by-rank
    async getViolationsByRank(params?: { vesselId?: string | string[]; monthValue?: string; complianceMode?: 'Rest' | 'Work'; opaMode?: boolean }) {
      const searchParams = new URLSearchParams();
      if (params?.vesselId) {
        const v = Array.isArray(params.vesselId) ? params.vesselId.filter(Boolean).join(',') : params.vesselId;
        if (v) searchParams.set('vesselId', v);
      }
      if (params?.monthValue) searchParams.set('monthValue', params.monthValue);
      if (params?.complianceMode) searchParams.set('complianceMode', params.complianceMode);
      if (params?.opaMode) searchParams.set('opaMode', 'true');
      const url = `${V2_BASE}/violations-by-rank${searchParams.toString() ? '?' + searchParams : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status}: Failed to fetch violations by rank`);
      return response.json();
    },

    // V1 pattern: /api/rest-hours-ncs-by-rank
    async getNcsByRank(params?: { vesselId?: string | string[]; monthValue?: string; complianceMode?: 'Rest' | 'Work'; opaMode?: boolean }) {
      const searchParams = new URLSearchParams();
      if (params?.vesselId) {
        const v = Array.isArray(params.vesselId) ? params.vesselId.filter(Boolean).join(',') : params.vesselId;
        if (v) searchParams.set('vesselId', v);
      }
      if (params?.monthValue) searchParams.set('monthValue', params.monthValue);
      if (params?.complianceMode) searchParams.set('complianceMode', params.complianceMode);
      if (params?.opaMode) searchParams.set('opaMode', 'true');
      const url = `${V2_BASE}/ncs-by-rank${searchParams.toString() ? '?' + searchParams : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status}: Failed to fetch NCs by rank`);
      return response.json();
    },
  },

  dailyRecords: {
    async getAll(params?: { crewMemberId?: string; date?: string; vesselId?: string; monthYear?: string }) {
      const searchParams = new URLSearchParams();
      if (params?.crewMemberId) searchParams.set('crewMemberId', params.crewMemberId);
      if (params?.date) searchParams.set('date', params.date);
      if (params?.vesselId) searchParams.set('vesselId', params.vesselId);
      if (params?.monthYear) searchParams.set('monthYear', params.monthYear);
      const url = `${V2_BASE}/daily-records${searchParams.toString() ? '?' + searchParams : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch daily records');
      return response.json();
    },

    async getByUuid(uuid: string) {
      const response = await fetch(`${V2_BASE}/daily-records/${uuid}`);
      if (!response.ok) throw new Error('Failed to fetch daily record');
      return response.json();
    },

    // V1 pattern: /api/rest-hours-daily-records/by-key/:crewMemberId/:vesselId/:monthYear
    // When `rank` is supplied, a promotion-split month returns the record for that
    // specific rank period so each rank row edits its own applicability window.
    async getByKey(crewMemberId: string, vesselId: string, monthYear: string, rank?: string) {
      const query = rank ? `?rank=${encodeURIComponent(rank)}` : '';
      const url = `${V2_BASE}/daily-records/by-key/${encodeURIComponent(crewMemberId)}/${encodeURIComponent(vesselId)}/${encodeURIComponent(monthYear)}${query}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch daily record by key');
      return response.json();
    },

    async create(data: any) {
      const response = await apiRequest('POST', `${V2_BASE}/daily-records`, withAuditUser(data));
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to create daily record');
      }
      return response.json();
    },

    async update(uuid: string, data: any) {
      const response = await apiRequest('PATCH', `${V2_BASE}/daily-records/${uuid}`, withAuditUser(data));
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to update daily record');
      }
      return response.json();
    },

    async delete(uuid: string) {
      const response = await apiRequest('DELETE', `${V2_BASE}/daily-records/${uuid}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to delete daily record');
      }
      return response.json();
    },

    async backfillViolations(data: { crewMemberId: string }) {
      const response = await apiRequest('POST', `${V2_BASE}/daily-records/backfill-violations`, data);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to backfill violations');
      }
      return response.json();
    },
  },

  vesselComments: {
    async getAll(params?: { vesselId?: string; monthValue?: string }) {
      const searchParams = new URLSearchParams();
      if (params?.vesselId) searchParams.set('vesselId', params.vesselId);
      if (params?.monthValue) searchParams.set('monthValue', params.monthValue);
      const url = `${V2_BASE}/vessel-comments${searchParams.toString() ? '?' + searchParams : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch vessel comments');
      return response.json();
    },

    async getByUuid(uuid: string) {
      const response = await fetch(`${V2_BASE}/vessel-comments/${uuid}`);
      if (!response.ok) throw new Error('Failed to fetch vessel comment');
      return response.json();
    },

    async create(data: any) {
      const response = await apiRequest('POST', `${V2_BASE}/vessel-comments`, withAuditUser(data));
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to create vessel comment');
      }
      return response.json();
    },

    async update(uuid: string, data: any) {
      const response = await apiRequest('PATCH', `${V2_BASE}/vessel-comments/${uuid}`, withAuditUser(data));
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to update vessel comment');
      }
      return response.json();
    },

    async delete(uuid: string) {
      const response = await apiRequest('DELETE', `${V2_BASE}/vessel-comments/${uuid}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to delete vessel comment');
      }
      return response.json();
    },
  },

  officeComments: {
    async getAll(params?: { vesselId?: string; monthValue?: string }) {
      const searchParams = new URLSearchParams();
      if (params?.vesselId) searchParams.set('vesselId', params.vesselId);
      if (params?.monthValue) searchParams.set('monthValue', params.monthValue);
      const url = `${V2_BASE}/office-comments${searchParams.toString() ? '?' + searchParams : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch office comments');
      return response.json();
    },

    async getByUuid(uuid: string) {
      const response = await fetch(`${V2_BASE}/office-comments/${uuid}`);
      if (!response.ok) throw new Error('Failed to fetch office comment');
      return response.json();
    },

    async create(data: any) {
      const response = await apiRequest('POST', `${V2_BASE}/office-comments`, withAuditUser(data));
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to create office comment');
      }
      return response.json();
    },

    async update(uuid: string, data: any) {
      const response = await apiRequest('PATCH', `${V2_BASE}/office-comments/${uuid}`, withAuditUser(data));
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to update office comment');
      }
      return response.json();
    },

    async delete(uuid: string) {
      const response = await apiRequest('DELETE', `${V2_BASE}/office-comments/${uuid}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to delete office comment');
      }
      return response.json();
    },
  },

  ncReports: {
    // V1 pattern: GET /api/nc-reports/all - returns all NC reports (no filtering)
    async getAll() {
      const response = await fetch(`${V2_BASE}/nc-reports/all`);
      if (!response.ok) throw new Error('Failed to fetch all NC reports');
      return response.json();
    },

    // V1 pattern: GET /api/nc-reports - filters by crewMemberId, vesselId, monthValue
    async getFiltered(params: { crewMemberId: string; vesselId: string; monthValue: string }) {
      const searchParams = new URLSearchParams();
      searchParams.set('crewMemberId', params.crewMemberId);
      searchParams.set('vesselId', params.vesselId);
      searchParams.set('monthValue', params.monthValue);
      const url = `${V2_BASE}/nc-reports?${searchParams}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch NC reports');
      return response.json();
    },

    async getByUuid(uuid: string) {
      const response = await fetch(`${V2_BASE}/nc-reports/${uuid}`);
      if (!response.ok) throw new Error('Failed to fetch NC report');
      return response.json();
    },

    async create(data: any) {
      const response = await apiRequest('POST', `${V2_BASE}/nc-reports`, withAuditUser(data));
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to create NC report');
      }
      return response.json();
    },

    async update(uuid: string, data: any) {
      const response = await apiRequest('PATCH', `${V2_BASE}/nc-reports/${uuid}`, withAuditUser(data));
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to update NC report');
      }
      return response.json();
    },

    async delete(uuid: string) {
      const response = await apiRequest('DELETE', `${V2_BASE}/nc-reports/${uuid}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to delete NC report');
      }
      return response.json();
    },
  },

  fixedTasks: {
    async getAll(params?: { vesselId?: string; monthYear?: string }) {
      const searchParams = new URLSearchParams();
      if (params?.vesselId) searchParams.set('vesselId', params.vesselId);
      if (params?.monthYear) searchParams.set('monthYear', params.monthYear);
      const url = `${V2_BASE}/fixed-tasks${searchParams.toString() ? '?' + searchParams : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch fixed tasks');
      return response.json();
    },

    async getByUuid(uuid: string) {
      const response = await fetch(`${V2_BASE}/fixed-tasks/${uuid}`);
      if (!response.ok) throw new Error('Failed to fetch fixed task');
      return response.json();
    },

    async getByKey(crewMemberId: string, vesselId: string, monthYear: string) {
      const url = `${V2_BASE}/fixed-tasks/by-key/${encodeURIComponent(crewMemberId)}/${encodeURIComponent(vesselId)}/${encodeURIComponent(monthYear)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch fixed task by key');
      return response.json();
    },

    async create(data: any) {
      const response = await apiRequest('POST', `${V2_BASE}/fixed-tasks`, withAuditUser(data));
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to create fixed task');
      }
      return response.json();
    },

    async update(uuid: string, data: any) {
      const response = await apiRequest('PATCH', `${V2_BASE}/fixed-tasks/${uuid}`, withAuditUser(data));
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to update fixed task');
      }
      return response.json();
    },

    async delete(uuid: string) {
      const response = await apiRequest('DELETE', `${V2_BASE}/fixed-tasks/${uuid}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to delete fixed task');
      }
      return response.json();
    },
  },

  variableTasks: {
    async getAll(params?: { vesselUuid?: string; date?: string; periodValue?: string }) {
      const searchParams = new URLSearchParams();
      if (params?.vesselUuid) searchParams.set('vesselUuid', params.vesselUuid);
      if (params?.periodValue) searchParams.set('periodValue', params.periodValue);
      else if (params?.date) searchParams.set('date', params.date);
      const url = `${V2_BASE}/variable-tasks${searchParams.toString() ? '?' + searchParams : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch variable tasks');
      return response.json();
    },

    async getDrafts(params?: { vesselUuid?: string }) {
      const searchParams = new URLSearchParams();
      if (params?.vesselUuid) searchParams.set('vesselUuid', params.vesselUuid);
      const url = `${V2_BASE}/variable-tasks/drafts${searchParams.toString() ? '?' + searchParams : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch draft variable tasks');
      return response.json();
    },

    async getByUuid(uuid: string) {
      const response = await fetch(`${V2_BASE}/variable-tasks/${uuid}`);
      if (!response.ok) throw new Error('Failed to fetch variable task');
      return response.json();
    },

    // Resolve the rank each crew member held on a given date (from promotion
    // history). Returns a map of crewMemberId (empNo) -> rank.
    async getRanksAsOfDate(date: string, crewMemberIds: string[]): Promise<Record<string, string>> {
      const ids = Array.from(new Set(crewMemberIds.filter(Boolean)));
      if (!date || ids.length === 0) return {};
      const searchParams = new URLSearchParams();
      searchParams.set('date', date);
      searchParams.set('crewMemberIds', ids.join(','));
      const response = await fetch(`${V2_BASE}/variable-tasks/ranks-as-of-date?${searchParams}`);
      if (!response.ok) throw new Error('Failed to resolve ranks as of date');
      return response.json();
    },

    async create(data: any) {
      const response = await apiRequest('POST', `${V2_BASE}/variable-tasks`, withAuditUser(data));
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to create variable task');
      }
      return response.json();
    },

    async update(uuid: string, data: any) {
      const response = await apiRequest('PATCH', `${V2_BASE}/variable-tasks/${uuid}`, withAuditUser(data));
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to update variable task');
      }
      return response.json();
    },

    async delete(uuid: string) {
      const response = await apiRequest('DELETE', `${V2_BASE}/variable-tasks/${uuid}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to delete variable task');
      }
      const text = await response.text();
      return text ? JSON.parse(text) : { success: true };
    },

    async publish(uuid: string) {
      const response = await apiRequest('POST', `${V2_BASE}/variable-tasks/${uuid}/publish`, withAuditUser({}));
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to publish variable task');
      }
      return response.json();
    },
  },

  // V1 pattern: /api/vessel-dateline-adjustments/:vesselId/:monthValue
  datelineAdjustments: {
    async getAll(params?: { vesselId?: string; monthValue?: string }) {
      const searchParams = new URLSearchParams();
      if (params?.vesselId) searchParams.set('vesselId', params.vesselId);
      if (params?.monthValue) searchParams.set('monthValue', params.monthValue);
      const url = `${V2_BASE}/dateline${searchParams.toString() ? '?' + searchParams : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch dateline adjustments');
      return response.json();
    },

    async getByUuid(uuid: string) {
      const response = await fetch(`${V2_BASE}/dateline/${uuid}`);
      if (!response.ok) throw new Error('Failed to fetch dateline adjustment');
      return response.json();
    },

    async create(data: any) {
      const response = await apiRequest('POST', `${V2_BASE}/dateline`, withAuditUser(data));
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to create dateline adjustment');
      }
      return response.json();
    },

    async update(uuid: string, data: any) {
      const response = await apiRequest('PATCH', `${V2_BASE}/dateline/${uuid}`, withAuditUser(data));
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to update dateline adjustment');
      }
      return response.json();
    },

    async delete(uuid: string) {
      const response = await apiRequest('DELETE', `${V2_BASE}/dateline/${uuid}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to delete dateline adjustment');
      }
      if (response.status === 204) return { success: true };
      return response.json();
    },
  },

  masters: {
    async getVessels() {
      const response = await fetch(`${V2_BASE}/masters/vessels`);
      if (!response.ok) throw new Error('Failed to fetch vessels');
      return response.json();
    },

    async getCrewMembers(params?: { vesselUuid?: string; rank?: string }) {
      const searchParams = new URLSearchParams();
      if (params?.vesselUuid) searchParams.set('vesselUuid', params.vesselUuid);
      if (params?.rank) searchParams.set('rank', params.rank);
      const url = `${V2_BASE}/masters/crew-members${searchParams.toString() ? '?' + searchParams : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch crew members');
      return response.json();
    },

    async getCrewCountByVessel(months?: string[]): Promise<Record<string, Record<string, number>>> {
      const searchParams = new URLSearchParams();
      if (months && months.length > 0) {
        searchParams.set('months', months.join(','));
      }
      const url = `${V2_BASE}/masters/crew-count-by-vessel${searchParams.toString() ? '?' + searchParams : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch crew count by vessel');
      return response.json();
    },

    async getFleetGroups() {
      const response = await fetch(`/api/v2/masters/fleet-groups`);
      if (!response.ok) throw new Error('Failed to fetch fleet groups');
      return response.json();
    },

    async getAdditionalGroups() {
      const response = await fetch(`/api/v2/masters/additional-groups`);
      if (!response.ok) throw new Error('Failed to fetch additional groups');
      return response.json();
    },
  },
};
