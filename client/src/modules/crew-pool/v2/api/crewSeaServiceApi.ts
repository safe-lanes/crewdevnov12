import { apiRequest } from '@/lib/queryClient';
import type {
  CrewSeaService,
  CrewSeaServiceAttachment,
  InsertCrewSeaService,
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

export type SeaServiceWithAttachments = CrewSeaService & {
  attachments: CrewSeaServiceAttachment[];
};

export interface ExperienceMetrics {
  totalMonths: number;
  companyMonths: number;
  externalMonths: number;
  currentRankMonths: number;
  vesselTypeBreakdown: Record<string, number>;
  rankBreakdown: Record<string, number>;
}

export interface SeaServiceWithMetrics {
  records: SeaServiceWithAttachments[];
  metrics: ExperienceMetrics;
}

export const crewSeaServiceApi = {
  getAll: async (crewUuid: string): Promise<SeaServiceWithAttachments[]> => {
    return fetchWithCredentials<SeaServiceWithAttachments[]>(
      `${BASE_URL}/crew/${crewUuid}/sea-service`
    );
  },

  getByType: async (crewUuid: string, serviceType: string): Promise<SeaServiceWithAttachments[]> => {
    return fetchWithCredentials<SeaServiceWithAttachments[]>(
      `${BASE_URL}/crew/${crewUuid}/sea-service/by-type?type=${serviceType}`
    );
  },

  getTotalExperience: async (crewUuid: string): Promise<{ totalMonths: number }> => {
    return fetchWithCredentials<{ totalMonths: number }>(
      `${BASE_URL}/crew/${crewUuid}/sea-service/experience`
    );
  },

  create: async (
    crewUuid: string,
    data: Omit<InsertCrewSeaService, 'seaUuid' | 'crewUuid'>
  ): Promise<CrewSeaService> => {
    const response = await apiRequest('POST', `${BASE_URL}/crew/${crewUuid}/sea-service`, data);
    return response.json();
  },

  update: async (
    crewUuid: string,
    seaUuid: string,
    data: Partial<InsertCrewSeaService>
  ): Promise<CrewSeaService> => {
    const response = await apiRequest(
      'PATCH',
      `${BASE_URL}/crew/${crewUuid}/sea-service/${seaUuid}`,
      data
    );
    return response.json();
  },

  delete: async (crewUuid: string, seaUuid: string): Promise<void> => {
    await apiRequest('DELETE', `${BASE_URL}/crew/${crewUuid}/sea-service/${seaUuid}`);
  },

  addAttachment: async (
    crewUuid: string,
    seaUuid: string,
    data: { fileName: string; filePath?: string; fileData?: string }
  ): Promise<CrewSeaServiceAttachment> => {
    const response = await apiRequest(
      'POST',
      `${BASE_URL}/crew/${crewUuid}/sea-service/${seaUuid}/attachments`,
      data
    );
    return response.json();
  },

  removeAttachment: async (crewUuid: string, seaUuid: string, attUuid: string): Promise<void> => {
    await apiRequest(
      'DELETE',
      `${BASE_URL}/crew/${crewUuid}/sea-service/${seaUuid}/attachments/${attUuid}`
    );
  },
};
