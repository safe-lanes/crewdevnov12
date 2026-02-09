import { apiRequest } from '@/lib/queryClient';

const V2_BASE = '/api/v2/drugs-alcohol';

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

export const drugsAlcoholApiV2 = {
  testRecords: {
    async getAll(params?: { vesselId?: string; testType?: string }) {
      const searchParams = new URLSearchParams();
      if (params?.vesselId) searchParams.set('vesselId', params.vesselId);
      if (params?.testType) searchParams.set('testType', params.testType);
      const url = `${V2_BASE}/test-records${searchParams.toString() ? '?' + searchParams : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch test records');
      return response.json();
    },

    async getByUuid(uuid: string) {
      const response = await fetch(`${V2_BASE}/test-records/${uuid}`);
      if (!response.ok) throw new Error('Failed to fetch test record');
      return response.json();
    },

    async getByVessel(vesselId: string, testType?: string) {
      const searchParams = new URLSearchParams();
      if (testType) searchParams.set('testType', testType);
      const url = `${V2_BASE}/test-records/vessel/${encodeURIComponent(vesselId)}${searchParams.toString() ? '?' + searchParams : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch vessel test records');
      return response.json();
    },

    async create(data: any) {
      const response = await apiRequest('POST', `${V2_BASE}/test-records`, withAuditUser(data));
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to create test record');
      }
      return response.json();
    },

    async update(uuid: string, data: any) {
      const response = await apiRequest('PATCH', `${V2_BASE}/test-records/${uuid}`, withAuditUser(data));
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to update test record');
      }
      return response.json();
    },

    async delete(uuid: string) {
      const response = await apiRequest('DELETE', `${V2_BASE}/test-records/${uuid}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to delete test record');
      }
      return response.json();
    },
  },
};
