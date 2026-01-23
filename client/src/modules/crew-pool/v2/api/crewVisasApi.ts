import { apiRequest } from '@/lib/queryClient';
import type { CrewVisa, CrewVisaAttachment, InsertCrewVisa } from '@shared/v2/crew-pool/types';

const BASE_URL = '/api/v2/crew-pool';

async function fetchWithCredentials<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    const text = (await response.text()) || response.statusText;
    throw new Error(`${response.status}: ${text}`);
  }
  return response.json();
}

export type VisaWithAttachments = CrewVisa & {
  attachments: CrewVisaAttachment[];
};

export const crewVisasApi = {
  getAll: async (crewUuid: string): Promise<VisaWithAttachments[]> => {
    return fetchWithCredentials<VisaWithAttachments[]>(`${BASE_URL}/crew/${crewUuid}/visas`);
  },

  getExpiring: async (crewUuid: string, daysAhead?: number): Promise<VisaWithAttachments[]> => {
    const params = daysAhead ? `?daysAhead=${daysAhead}` : '';
    return fetchWithCredentials<VisaWithAttachments[]>(
      `${BASE_URL}/crew/${crewUuid}/visas/expiring${params}`
    );
  },

  create: async (
    crewUuid: string,
    data: Omit<InsertCrewVisa, 'visaUuid' | 'crewUuid'>
  ): Promise<CrewVisa> => {
    const response = await apiRequest('POST', `${BASE_URL}/crew/${crewUuid}/visas`, data);
    return response.json();
  },

  update: async (
    crewUuid: string,
    visaUuid: string,
    data: Partial<InsertCrewVisa>
  ): Promise<CrewVisa> => {
    const response = await apiRequest(
      'PATCH',
      `${BASE_URL}/crew/${crewUuid}/visas/${visaUuid}`,
      data
    );
    return response.json();
  },

  delete: async (crewUuid: string, visaUuid: string): Promise<void> => {
    await apiRequest('DELETE', `${BASE_URL}/crew/${crewUuid}/visas/${visaUuid}`);
  },

  addAttachment: async (
    crewUuid: string,
    visaUuid: string,
    data: { fileName: string; filePath?: string; fileData?: string }
  ): Promise<CrewVisaAttachment> => {
    const response = await apiRequest(
      'POST',
      `${BASE_URL}/crew/${crewUuid}/visas/${visaUuid}/attachments`,
      data
    );
    return response.json();
  },

  removeAttachment: async (crewUuid: string, visaUuid: string, attUuid: string): Promise<void> => {
    await apiRequest(
      'DELETE',
      `${BASE_URL}/crew/${crewUuid}/visas/${visaUuid}/attachments/${attUuid}`
    );
  },
};
