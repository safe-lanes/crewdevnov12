import { apiRequest } from '@/lib/queryClient';
import type { CrewAssignment, InsertCrewAssignment } from '@shared/v2/crew-pool/types';

const BASE_URL = '/api/v2/crew-pool';

async function fetchWithCredentials<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    const text = (await response.text()) || response.statusText;
    throw new Error(`${response.status}: ${text}`);
  }
  return response.json();
}

export interface AssignToVesselData {
  vesselUuid: string;
  vesselName?: string;
  rank?: string;
  assignmentType?: 'primary' | 'secondary';
  signOnDate?: string;
  reliefDue?: string;
  contractPeriod?: string;
  notes?: string;
}

export interface SignOffData {
  signOffDate?: string;
  signOffReason?: string;
  signOffNotes?: string;
}

export const crewAssignmentsApi = {
  getAll: async (crewUuid: string): Promise<CrewAssignment[]> => {
    return fetchWithCredentials<CrewAssignment[]>(`${BASE_URL}/crew/${crewUuid}/assignments`);
  },

  getCurrent: async (crewUuid: string): Promise<CrewAssignment | null> => {
    return fetchWithCredentials<CrewAssignment | null>(
      `${BASE_URL}/crew/${crewUuid}/assignments/current`
    );
  },

  getHistory: async (crewUuid: string, limit?: number): Promise<CrewAssignment[]> => {
    const params = limit ? `?limit=${limit}` : '';
    return fetchWithCredentials<CrewAssignment[]>(
      `${BASE_URL}/crew/${crewUuid}/assignments/history${params}`
    );
  },

  getVesselCrew: async (vesselUuid: string, includeSecondary?: boolean): Promise<CrewAssignment[]> => {
    const params = includeSecondary ? '?includeSecondary=true' : '';
    return fetchWithCredentials<CrewAssignment[]>(`${BASE_URL}/vessels/${vesselUuid}/crew${params}`);
  },

  create: async (
    crewUuid: string,
    data: Omit<InsertCrewAssignment, 'assignUuid' | 'crewUuid'>
  ): Promise<CrewAssignment> => {
    const response = await apiRequest('POST', `${BASE_URL}/crew/${crewUuid}/assignments`, data);
    return response.json();
  },

  assignToVessel: async (crewUuid: string, data: AssignToVesselData): Promise<CrewAssignment> => {
    const response = await apiRequest('POST', `${BASE_URL}/crew/${crewUuid}/assign`, data);
    return response.json();
  },

  signOff: async (crewUuid: string, data?: SignOffData): Promise<CrewAssignment | null> => {
    const response = await apiRequest('POST', `${BASE_URL}/crew/${crewUuid}/sign-off`, data || {});
    return response.json();
  },

  update: async (
    crewUuid: string,
    assignUuid: string,
    data: Partial<InsertCrewAssignment>
  ): Promise<CrewAssignment> => {
    const response = await apiRequest(
      'PATCH',
      `${BASE_URL}/crew/${crewUuid}/assignments/${assignUuid}`,
      data
    );
    return response.json();
  },

  delete: async (crewUuid: string, assignUuid: string): Promise<void> => {
    await apiRequest('DELETE', `${BASE_URL}/crew/${crewUuid}/assignments/${assignUuid}`);
  },
};
