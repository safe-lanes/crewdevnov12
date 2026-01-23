import { apiRequest } from '@/lib/queryClient';
import type {
  CrewLicense,
  CrewLicenseAttachment,
  InsertCrewLicense,
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

export type LicenseWithAttachments = CrewLicense & {
  attachments: CrewLicenseAttachment[];
};

export const crewLicensesApi = {
  getAll: async (crewUuid: string): Promise<LicenseWithAttachments[]> => {
    return fetchWithCredentials<LicenseWithAttachments[]>(
      `${BASE_URL}/crew/${crewUuid}/licenses`
    );
  },

  getExpiring: async (crewUuid: string, daysAhead?: number): Promise<LicenseWithAttachments[]> => {
    const params = daysAhead ? `?daysAhead=${daysAhead}` : '';
    return fetchWithCredentials<LicenseWithAttachments[]>(
      `${BASE_URL}/crew/${crewUuid}/licenses/expiring${params}`
    );
  },

  create: async (
    crewUuid: string,
    data: Omit<InsertCrewLicense, 'licUuid' | 'crewUuid'>
  ): Promise<CrewLicense> => {
    const response = await apiRequest('POST', `${BASE_URL}/crew/${crewUuid}/licenses`, data);
    return response.json();
  },

  update: async (
    crewUuid: string,
    licUuid: string,
    data: Partial<InsertCrewLicense>
  ): Promise<CrewLicense> => {
    const response = await apiRequest(
      'PATCH',
      `${BASE_URL}/crew/${crewUuid}/licenses/${licUuid}`,
      data
    );
    return response.json();
  },

  delete: async (crewUuid: string, licUuid: string): Promise<void> => {
    await apiRequest('DELETE', `${BASE_URL}/crew/${crewUuid}/licenses/${licUuid}`);
  },

  addAttachment: async (
    crewUuid: string,
    licUuid: string,
    data: { fileName: string; filePath?: string; fileData?: string }
  ): Promise<CrewLicenseAttachment> => {
    const response = await apiRequest(
      'POST',
      `${BASE_URL}/crew/${crewUuid}/licenses/${licUuid}/attachments`,
      data
    );
    return response.json();
  },

  removeAttachment: async (crewUuid: string, licUuid: string, attUuid: string): Promise<void> => {
    await apiRequest(
      'DELETE',
      `${BASE_URL}/crew/${crewUuid}/licenses/${licUuid}/attachments/${attUuid}`
    );
  },
};
