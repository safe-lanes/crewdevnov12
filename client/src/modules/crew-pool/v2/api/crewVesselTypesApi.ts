import { apiRequest } from '@/lib/queryClient';
import type { CrewVesselTypesApplied } from '@shared/v2/crew-pool/types';

const BASE_URL = '/api/v2/crew-pool';

async function fetchWithCredentials<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    const text = (await response.text()) || response.statusText;
    throw new Error(`${response.status}: ${text}`);
  }
  return response.json();
}

export const crewVesselTypesApi = {
  getAll: async (crewUuid: string): Promise<CrewVesselTypesApplied[]> => {
    return fetchWithCredentials<CrewVesselTypesApplied[]>(
      `${BASE_URL}/crew/${crewUuid}/vessel-types`
    );
  },

  sync: async (crewUuid: string, vesselTypeIds: string[]): Promise<CrewVesselTypesApplied[]> => {
    const response = await apiRequest('PUT', `${BASE_URL}/crew/${crewUuid}/vessel-types`, {
      vesselTypeIds,
    });
    return response.json();
  },
};
