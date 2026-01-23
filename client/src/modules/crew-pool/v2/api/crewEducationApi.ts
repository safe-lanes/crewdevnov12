import { apiRequest } from '@/lib/queryClient';
import type {
  CrewEducation,
  CrewEducationAttachment,
  InsertCrewEducation,
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

export type EducationWithAttachments = CrewEducation & {
  attachments: CrewEducationAttachment[];
};

export const crewEducationApi = {
  getAll: async (crewUuid: string): Promise<EducationWithAttachments[]> => {
    return fetchWithCredentials<EducationWithAttachments[]>(
      `${BASE_URL}/crew/${crewUuid}/education`
    );
  },

  create: async (
    crewUuid: string,
    data: Omit<InsertCrewEducation, 'eduUuid' | 'crewUuid'>
  ): Promise<CrewEducation> => {
    const response = await apiRequest('POST', `${BASE_URL}/crew/${crewUuid}/education`, data);
    return response.json();
  },

  update: async (
    crewUuid: string,
    eduUuid: string,
    data: Partial<InsertCrewEducation>
  ): Promise<CrewEducation> => {
    const response = await apiRequest(
      'PATCH',
      `${BASE_URL}/crew/${crewUuid}/education/${eduUuid}`,
      data
    );
    return response.json();
  },

  delete: async (crewUuid: string, eduUuid: string): Promise<void> => {
    await apiRequest('DELETE', `${BASE_URL}/crew/${crewUuid}/education/${eduUuid}`);
  },

  addAttachment: async (
    crewUuid: string,
    eduUuid: string,
    data: { fileName: string; filePath?: string; fileData?: string }
  ): Promise<CrewEducationAttachment> => {
    const response = await apiRequest(
      'POST',
      `${BASE_URL}/crew/${crewUuid}/education/${eduUuid}/attachments`,
      data
    );
    return response.json();
  },

  removeAttachment: async (crewUuid: string, eduUuid: string, attUuid: string): Promise<void> => {
    await apiRequest(
      'DELETE',
      `${BASE_URL}/crew/${crewUuid}/education/${eduUuid}/attachments/${attUuid}`
    );
  },
};
