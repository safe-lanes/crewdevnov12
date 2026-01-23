import { apiRequest } from '@/lib/queryClient';
import type {
  CrewFamilyInfo,
  CrewChild,
  CrewNextOfKin,
  InsertCrewFamilyInfo,
  InsertCrewChild,
  InsertCrewNextOfKin,
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

export const crewFamilyApi = {
  getFamily: async (crewUuid: string): Promise<CrewFamilyInfo | null> => {
    return fetchWithCredentials<CrewFamilyInfo | null>(`${BASE_URL}/crew/${crewUuid}/family`);
  },

  upsertFamily: async (
    crewUuid: string,
    data: Omit<InsertCrewFamilyInfo, 'crewUuid'>
  ): Promise<CrewFamilyInfo> => {
    const response = await apiRequest('PUT', `${BASE_URL}/crew/${crewUuid}/family`, data);
    return response.json();
  },

  getChildren: async (crewUuid: string): Promise<CrewChild[]> => {
    return fetchWithCredentials<CrewChild[]>(`${BASE_URL}/crew/${crewUuid}/children`);
  },

  addChild: async (
    crewUuid: string,
    data: Omit<InsertCrewChild, 'childUuid' | 'crewUuid'>
  ): Promise<CrewChild> => {
    const response = await apiRequest('POST', `${BASE_URL}/crew/${crewUuid}/children`, data);
    return response.json();
  },

  updateChild: async (
    crewUuid: string,
    childUuid: string,
    data: Partial<InsertCrewChild>
  ): Promise<CrewChild> => {
    const response = await apiRequest(
      'PATCH',
      `${BASE_URL}/crew/${crewUuid}/children/${childUuid}`,
      data
    );
    return response.json();
  },

  removeChild: async (crewUuid: string, childUuid: string): Promise<void> => {
    await apiRequest('DELETE', `${BASE_URL}/crew/${crewUuid}/children/${childUuid}`);
  },

  getNextOfKin: async (crewUuid: string): Promise<CrewNextOfKin | null> => {
    return fetchWithCredentials<CrewNextOfKin | null>(`${BASE_URL}/crew/${crewUuid}/next-of-kin`);
  },

  upsertNextOfKin: async (
    crewUuid: string,
    data: Omit<InsertCrewNextOfKin, 'crewUuid'>
  ): Promise<CrewNextOfKin> => {
    const response = await apiRequest('PUT', `${BASE_URL}/crew/${crewUuid}/next-of-kin`, data);
    return response.json();
  },
};
