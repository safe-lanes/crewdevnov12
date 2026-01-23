import { apiRequest } from '@/lib/queryClient';
import type {
  CrewTrainingCourse,
  CrewTrainingAttachment,
  InsertCrewTrainingCourse,
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

export type TrainingWithAttachments = CrewTrainingCourse & {
  attachments: CrewTrainingAttachment[];
};

export const crewTrainingApi = {
  getAll: async (crewUuid: string): Promise<TrainingWithAttachments[]> => {
    return fetchWithCredentials<TrainingWithAttachments[]>(
      `${BASE_URL}/crew/${crewUuid}/training`
    );
  },

  getExpiring: async (crewUuid: string, daysAhead?: number): Promise<TrainingWithAttachments[]> => {
    const params = daysAhead ? `?daysAhead=${daysAhead}` : '';
    return fetchWithCredentials<TrainingWithAttachments[]>(
      `${BASE_URL}/crew/${crewUuid}/training/expiring${params}`
    );
  },

  create: async (
    crewUuid: string,
    data: Omit<InsertCrewTrainingCourse, 'trainUuid' | 'crewUuid'>
  ): Promise<CrewTrainingCourse> => {
    const response = await apiRequest('POST', `${BASE_URL}/crew/${crewUuid}/training`, data);
    return response.json();
  },

  update: async (
    crewUuid: string,
    trainUuid: string,
    data: Partial<InsertCrewTrainingCourse>
  ): Promise<CrewTrainingCourse> => {
    const response = await apiRequest(
      'PATCH',
      `${BASE_URL}/crew/${crewUuid}/training/${trainUuid}`,
      data
    );
    return response.json();
  },

  delete: async (crewUuid: string, trainUuid: string): Promise<void> => {
    await apiRequest('DELETE', `${BASE_URL}/crew/${crewUuid}/training/${trainUuid}`);
  },

  addAttachment: async (
    crewUuid: string,
    trainUuid: string,
    data: { fileName: string; filePath?: string; fileData?: string }
  ): Promise<CrewTrainingAttachment> => {
    const response = await apiRequest(
      'POST',
      `${BASE_URL}/crew/${crewUuid}/training/${trainUuid}/attachments`,
      data
    );
    return response.json();
  },

  removeAttachment: async (
    crewUuid: string,
    trainUuid: string,
    attUuid: string
  ): Promise<void> => {
    await apiRequest(
      'DELETE',
      `${BASE_URL}/crew/${crewUuid}/training/${trainUuid}/attachments/${attUuid}`
    );
  },
};
