import { apiRequest } from '@/lib/queryClient';
import type {
  CrewDocument,
  CrewDocumentAttachment,
  InsertCrewDocument,
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

export type DocumentWithAttachments = CrewDocument & {
  attachments: CrewDocumentAttachment[];
};

export const crewDocumentsApi = {
  getAll: async (crewUuid: string): Promise<DocumentWithAttachments[]> => {
    return fetchWithCredentials<DocumentWithAttachments[]>(
      `${BASE_URL}/crew/${crewUuid}/documents`
    );
  },

  create: async (
    crewUuid: string,
    data: Omit<InsertCrewDocument, 'docUuid' | 'crewUuid'>
  ): Promise<CrewDocument> => {
    const response = await apiRequest('POST', `${BASE_URL}/crew/${crewUuid}/documents`, data);
    return response.json();
  },

  update: async (
    crewUuid: string,
    docUuid: string,
    data: Partial<InsertCrewDocument>
  ): Promise<CrewDocument> => {
    const response = await apiRequest(
      'PATCH',
      `${BASE_URL}/crew/${crewUuid}/documents/${docUuid}`,
      data
    );
    return response.json();
  },

  delete: async (crewUuid: string, docUuid: string): Promise<void> => {
    await apiRequest('DELETE', `${BASE_URL}/crew/${crewUuid}/documents/${docUuid}`);
  },

  addAttachment: async (
    crewUuid: string,
    docUuid: string,
    data: { fileName: string; filePath?: string; fileData?: string }
  ): Promise<CrewDocumentAttachment> => {
    const response = await apiRequest(
      'POST',
      `${BASE_URL}/crew/${crewUuid}/documents/${docUuid}/attachments`,
      data
    );
    return response.json();
  },

  removeAttachment: async (crewUuid: string, docUuid: string, attUuid: string): Promise<void> => {
    await apiRequest(
      'DELETE',
      `${BASE_URL}/crew/${crewUuid}/documents/${docUuid}/attachments/${attUuid}`
    );
  },
};
