import { apiRequest } from '@/lib/queryClient';
import type {
  CrewPersonalDetails,
  CrewAddress,
  InsertCrewPersonalDetails,
  InsertCrewAddress,
} from '@shared/v2/crew-pool/types';

const BASE_URL = '/api/v2/crew-pool';

async function fetchWithCredentials<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    const text = (await response.text()) || response.statusText;
    throw new Error(`${response.status}: ${text}`);
  }
  return response.json();
}

export const crewPersonalApi = {
  getPersonal: async (crewUuid: string): Promise<CrewPersonalDetails | null> => {
    return fetchWithCredentials<CrewPersonalDetails | null>(
      `${BASE_URL}/crew/${crewUuid}/personal`
    );
  },

  upsertPersonal: async (
    crewUuid: string,
    data: Omit<InsertCrewPersonalDetails, 'crewUuid'>
  ): Promise<CrewPersonalDetails> => {
    const response = await apiRequest('PUT', `${BASE_URL}/crew/${crewUuid}/personal`, data);
    return response.json();
  },

  getAddress: async (crewUuid: string): Promise<CrewAddress | null> => {
    return fetchWithCredentials<CrewAddress | null>(`${BASE_URL}/crew/${crewUuid}/address`);
  },

  upsertAddress: async (
    crewUuid: string,
    data: Omit<InsertCrewAddress, 'crewUuid'>
  ): Promise<CrewAddress> => {
    const response = await apiRequest('PUT', `${BASE_URL}/crew/${crewUuid}/address`, data);
    return response.json();
  },
};
