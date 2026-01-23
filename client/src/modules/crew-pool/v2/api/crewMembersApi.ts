import { apiRequest } from '@/lib/queryClient';
import type { CrewMemberV2, InsertCrewMemberV2 } from '@shared/v2/crew-pool/types';

const BASE_URL = '/api/v2/crew-pool';

async function fetchWithCredentials<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    const text = (await response.text()) || response.statusText;
    throw new Error(`${response.status}: ${text}`);
  }
  return response.json();
}

export interface CrewMembersFilters {
  status?: string;
  isActive?: boolean;
  search?: string;
}

export interface CrewDetailsFilters {
  rank?: string;
  nationality?: string;
  status?: string;
  search?: string;
  vesselUuid?: string;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    pages: number;
    currentPage: number;
  };
}

export const crewMembersApi = {
  getAll: async (filters?: CrewMembersFilters): Promise<CrewMemberV2[]> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));
    if (filters?.search) params.append('search', filters.search);

    const url = `${BASE_URL}/crew${params.toString() ? `?${params}` : ''}`;
    return fetchWithCredentials<CrewMemberV2[]>(url);
  },

  getAllWithDetails: async (filters?: CrewDetailsFilters): Promise<PaginatedResponse<CrewMemberV2>> => {
    const params = new URLSearchParams();
    if (filters?.rank) params.append('rank', filters.rank);
    if (filters?.nationality) params.append('nationality', filters.nationality);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.vesselUuid) params.append('vesselUuid', filters.vesselUuid);
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.offset) params.append('offset', String(filters.offset));

    const url = `${BASE_URL}/crew/details${params.toString() ? `?${params}` : ''}`;
    return fetchWithCredentials<PaginatedResponse<CrewMemberV2>>(url);
  },

  getByUuid: async (crewUuid: string): Promise<CrewMemberV2> => {
    return fetchWithCredentials<CrewMemberV2>(`${BASE_URL}/crew/${crewUuid}`);
  },

  getFullProfile: async (crewUuid: string): Promise<any> => {
    return fetchWithCredentials<any>(`${BASE_URL}/crew/${crewUuid}/profile`);
  },

  create: async (data: Omit<InsertCrewMemberV2, 'crewUuid'>): Promise<CrewMemberV2> => {
    const response = await apiRequest('POST', `${BASE_URL}/crew`, data);
    return response.json();
  },

  createWithRelatedData: async (data: any): Promise<CrewMemberV2> => {
    const response = await apiRequest('POST', `${BASE_URL}/crew/with-data`, data);
    return response.json();
  },

  update: async (crewUuid: string, data: Partial<InsertCrewMemberV2>): Promise<CrewMemberV2> => {
    const response = await apiRequest('PATCH', `${BASE_URL}/crew/${crewUuid}`, data);
    return response.json();
  },

  updateWithProtection: async (
    crewUuid: string,
    data: Partial<InsertCrewMemberV2>,
    options?: { allowVesselClear?: boolean }
  ): Promise<CrewMemberV2> => {
    const response = await apiRequest('PATCH', `${BASE_URL}/crew/${crewUuid}/protected`, {
      ...data,
      allowVesselClear: options?.allowVesselClear,
    });
    return response.json();
  },

  delete: async (crewUuid: string): Promise<void> => {
    await apiRequest('DELETE', `${BASE_URL}/crew/${crewUuid}`);
  },

  unarchive: async (crewUuid: string): Promise<void> => {
    await apiRequest('POST', `${BASE_URL}/crew/${crewUuid}/unarchive`);
  },
};
