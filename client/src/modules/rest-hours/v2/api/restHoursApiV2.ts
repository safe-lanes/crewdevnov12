import { apiRequest } from '@/lib/queryClient';

const V2_BASE = '/api/v2/rest-hours';

export const restHoursApiV2 = {
  vesselRecords: {
    async getAll(params?: { vesselUuid?: string; month?: string; year?: string }) {
      const searchParams = new URLSearchParams();
      if (params?.vesselUuid) searchParams.set('vesselUuid', params.vesselUuid);
      if (params?.month) searchParams.set('month', params.month);
      if (params?.year) searchParams.set('year', params.year);
      const url = `${V2_BASE}/vessel-records${searchParams.toString() ? '?' + searchParams : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch vessel records');
      return response.json();
    },

    async getByUuid(uuid: string) {
      const response = await fetch(`${V2_BASE}/vessel-records/${uuid}`);
      if (!response.ok) throw new Error('Failed to fetch vessel record');
      return response.json();
    },

    async create(data: any) {
      const response = await apiRequest('POST', `${V2_BASE}/vessel-records`, data);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to create vessel record');
      }
      return response.json();
    },

    async update(uuid: string, data: any) {
      const response = await apiRequest('PATCH', `${V2_BASE}/vessel-records/${uuid}`, data);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to update vessel record');
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

    async submitVesselReview(uuid: string, data: any) {
      const response = await apiRequest('POST', `${V2_BASE}/vessel-records/${uuid}/vessel-review`, data);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to submit vessel review');
      }
      return response.json();
    },

    async submitOfficeReview(uuid: string, data: any) {
      const response = await apiRequest('POST', `${V2_BASE}/vessel-records/${uuid}/office-review`, data);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to submit office review');
      }
      return response.json();
    },
  },

  crewRecords: {
    async getAll(params?: { vesselId?: string; monthValue?: string; ranks?: string[]; search?: string }) {
      const searchParams = new URLSearchParams();
      if (params?.vesselId) searchParams.set('vesselId', params.vesselId);
      if (params?.monthValue) searchParams.set('monthValue', params.monthValue);
      if (params?.ranks && params.ranks.length > 0) {
        params.ranks.forEach(rank => searchParams.append('ranks', rank));
      }
      if (params?.search) searchParams.set('search', params.search);
      const url = `${V2_BASE}/crew-records${searchParams.toString() ? '?' + searchParams : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch crew records');
      return response.json();
    },

    async getByUuid(uuid: string) {
      const response = await fetch(`${V2_BASE}/crew-records/${uuid}`);
      if (!response.ok) throw new Error('Failed to fetch crew record');
      return response.json();
    },

    async create(data: any) {
      const response = await apiRequest('POST', `${V2_BASE}/crew-records`, data);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to create crew record');
      }
      return response.json();
    },

    async update(uuid: string, data: any) {
      const response = await apiRequest('PATCH', `${V2_BASE}/crew-records/${uuid}`, data);
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

    async getViolationsByRank(params?: { vesselRecordUuid?: string }) {
      const searchParams = new URLSearchParams();
      if (params?.vesselRecordUuid) searchParams.set('vesselRecordUuid', params.vesselRecordUuid);
      const url = `${V2_BASE}/crew-records/violations-by-rank${searchParams.toString() ? '?' + searchParams : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch violations by rank');
      return response.json();
    },

    async getNcsByRank(params?: { vesselRecordUuid?: string }) {
      const searchParams = new URLSearchParams();
      if (params?.vesselRecordUuid) searchParams.set('vesselRecordUuid', params.vesselRecordUuid);
      const url = `${V2_BASE}/crew-records/ncs-by-rank${searchParams.toString() ? '?' + searchParams : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch NCs by rank');
      return response.json();
    },
  },

  dailyRecords: {
    async getAll(params?: { crewRecordUuid?: string; date?: string }) {
      const searchParams = new URLSearchParams();
      if (params?.crewRecordUuid) searchParams.set('crewRecordUuid', params.crewRecordUuid);
      if (params?.date) searchParams.set('date', params.date);
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

    async getByKey(crewRecordUuid: string, date: string) {
      const response = await fetch(`${V2_BASE}/daily-records/by-key/${crewRecordUuid}/${date}`);
      if (!response.ok) throw new Error('Failed to fetch daily record by key');
      return response.json();
    },

    async create(data: any) {
      const response = await apiRequest('POST', `${V2_BASE}/daily-records`, data);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to create daily record');
      }
      return response.json();
    },

    async update(uuid: string, data: any) {
      const response = await apiRequest('PATCH', `${V2_BASE}/daily-records/${uuid}`, data);
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

    async backfillViolations(data: { crewRecordUuid: string }) {
      const response = await apiRequest('POST', `${V2_BASE}/daily-records/backfill-violations`, data);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to backfill violations');
      }
      return response.json();
    },
  },

  vesselComments: {
    async getAll(params?: { vesselRecordUuid?: string }) {
      const searchParams = new URLSearchParams();
      if (params?.vesselRecordUuid) searchParams.set('vesselRecordUuid', params.vesselRecordUuid);
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
      const response = await apiRequest('POST', `${V2_BASE}/vessel-comments`, data);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to create vessel comment');
      }
      return response.json();
    },

    async update(uuid: string, data: any) {
      const response = await apiRequest('PATCH', `${V2_BASE}/vessel-comments/${uuid}`, data);
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
    async getAll(params?: { vesselRecordUuid?: string }) {
      const searchParams = new URLSearchParams();
      if (params?.vesselRecordUuid) searchParams.set('vesselRecordUuid', params.vesselRecordUuid);
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
      const response = await apiRequest('POST', `${V2_BASE}/office-comments`, data);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to create office comment');
      }
      return response.json();
    },

    async update(uuid: string, data: any) {
      const response = await apiRequest('PATCH', `${V2_BASE}/office-comments/${uuid}`, data);
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
    async getAll(params?: { vesselRecordUuid?: string; crewRecordUuid?: string }) {
      const searchParams = new URLSearchParams();
      if (params?.vesselRecordUuid) searchParams.set('vesselRecordUuid', params.vesselRecordUuid);
      if (params?.crewRecordUuid) searchParams.set('crewRecordUuid', params.crewRecordUuid);
      const url = `${V2_BASE}/nc-reports${searchParams.toString() ? '?' + searchParams : ''}`;
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
      const response = await apiRequest('POST', `${V2_BASE}/nc-reports`, data);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to create NC report');
      }
      return response.json();
    },

    async update(uuid: string, data: any) {
      const response = await apiRequest('PATCH', `${V2_BASE}/nc-reports/${uuid}`, data);
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
    async getAll(params?: { vesselUuid?: string }) {
      const searchParams = new URLSearchParams();
      if (params?.vesselUuid) searchParams.set('vesselUuid', params.vesselUuid);
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
      const response = await apiRequest('POST', `${V2_BASE}/fixed-tasks`, data);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to create fixed task');
      }
      return response.json();
    },

    async update(uuid: string, data: any) {
      const response = await apiRequest('PATCH', `${V2_BASE}/fixed-tasks/${uuid}`, data);
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
    async getAll(params?: { vesselUuid?: string; date?: string }) {
      const searchParams = new URLSearchParams();
      if (params?.vesselUuid) searchParams.set('vesselUuid', params.vesselUuid);
      if (params?.date) searchParams.set('date', params.date);
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

    async create(data: any) {
      const response = await apiRequest('POST', `${V2_BASE}/variable-tasks`, data);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to create variable task');
      }
      return response.json();
    },

    async update(uuid: string, data: any) {
      const response = await apiRequest('PATCH', `${V2_BASE}/variable-tasks/${uuid}`, data);
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
      return response.json();
    },

    async publish(uuid: string) {
      const response = await apiRequest('POST', `${V2_BASE}/variable-tasks/${uuid}/publish`, {});
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to publish variable task');
      }
      return response.json();
    },
  },

  datelineAdjustments: {
    async getAll(params?: { vesselUuid?: string }) {
      const searchParams = new URLSearchParams();
      if (params?.vesselUuid) searchParams.set('vesselUuid', params.vesselUuid);
      const url = `${V2_BASE}/dateline-adjustments${searchParams.toString() ? '?' + searchParams : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch dateline adjustments');
      return response.json();
    },

    async getByUuid(uuid: string) {
      const response = await fetch(`${V2_BASE}/dateline-adjustments/${uuid}`);
      if (!response.ok) throw new Error('Failed to fetch dateline adjustment');
      return response.json();
    },

    async create(data: any) {
      const response = await apiRequest('POST', `${V2_BASE}/dateline-adjustments`, data);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to create dateline adjustment');
      }
      return response.json();
    },

    async update(uuid: string, data: any) {
      const response = await apiRequest('PATCH', `${V2_BASE}/dateline-adjustments/${uuid}`, data);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to update dateline adjustment');
      }
      return response.json();
    },

    async delete(uuid: string) {
      const response = await apiRequest('DELETE', `${V2_BASE}/dateline-adjustments/${uuid}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to delete dateline adjustment');
      }
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

    async getCrewCountByVessel(): Promise<Record<string, number>> {
      const response = await fetch(`${V2_BASE}/masters/crew-count-by-vessel`);
      if (!response.ok) throw new Error('Failed to fetch crew count by vessel');
      return response.json();
    },
  },
};
