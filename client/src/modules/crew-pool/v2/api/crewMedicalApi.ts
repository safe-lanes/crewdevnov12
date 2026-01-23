import { apiRequest } from '@/lib/queryClient';
import type {
  CrewPreJoiningMedical,
  CrewMedicalAttachment,
  CrewDoctorVisit,
  CrewDoctorVisitAttachment,
  InsertCrewPreJoiningMedical,
  InsertCrewDoctorVisit,
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

export type MedicalWithAttachments = CrewPreJoiningMedical & {
  attachments: CrewMedicalAttachment[];
};

export type DoctorVisitWithAttachments = CrewDoctorVisit & {
  attachments: CrewDoctorVisitAttachment[];
};

export interface FitnessStatus {
  isFitForDuty: boolean;
  latestMedical: CrewPreJoiningMedical | null;
}

export interface AllMedicalData {
  medicals: MedicalWithAttachments[];
  doctorVisits: DoctorVisitWithAttachments[];
}

export const crewMedicalApi = {
  getMedicals: async (crewUuid: string): Promise<MedicalWithAttachments[]> => {
    return fetchWithCredentials<MedicalWithAttachments[]>(
      `${BASE_URL}/crew/${crewUuid}/medicals`
    );
  },

  getFitnessStatus: async (crewUuid: string): Promise<FitnessStatus> => {
    return fetchWithCredentials<FitnessStatus>(
      `${BASE_URL}/crew/${crewUuid}/medicals/fitness-status`
    );
  },

  getAllMedicalData: async (crewUuid: string): Promise<AllMedicalData> => {
    return fetchWithCredentials<AllMedicalData>(`${BASE_URL}/crew/${crewUuid}/medicals/all`);
  },

  createMedical: async (
    crewUuid: string,
    data: Omit<InsertCrewPreJoiningMedical, 'medUuid' | 'crewUuid'>
  ): Promise<CrewPreJoiningMedical> => {
    const response = await apiRequest('POST', `${BASE_URL}/crew/${crewUuid}/medicals`, data);
    return response.json();
  },

  updateMedical: async (
    crewUuid: string,
    medUuid: string,
    data: Partial<InsertCrewPreJoiningMedical>
  ): Promise<CrewPreJoiningMedical> => {
    const response = await apiRequest(
      'PATCH',
      `${BASE_URL}/crew/${crewUuid}/medicals/${medUuid}`,
      data
    );
    return response.json();
  },

  deleteMedical: async (crewUuid: string, medUuid: string): Promise<void> => {
    await apiRequest('DELETE', `${BASE_URL}/crew/${crewUuid}/medicals/${medUuid}`);
  },

  addMedicalAttachment: async (
    crewUuid: string,
    medUuid: string,
    data: { fileName: string; filePath?: string; fileData?: string }
  ): Promise<CrewMedicalAttachment> => {
    const response = await apiRequest(
      'POST',
      `${BASE_URL}/crew/${crewUuid}/medicals/${medUuid}/attachments`,
      data
    );
    return response.json();
  },

  removeMedicalAttachment: async (
    crewUuid: string,
    medUuid: string,
    attUuid: string
  ): Promise<void> => {
    await apiRequest(
      'DELETE',
      `${BASE_URL}/crew/${crewUuid}/medicals/${medUuid}/attachments/${attUuid}`
    );
  },

  getDoctorVisits: async (crewUuid: string): Promise<DoctorVisitWithAttachments[]> => {
    return fetchWithCredentials<DoctorVisitWithAttachments[]>(
      `${BASE_URL}/crew/${crewUuid}/doctor-visits`
    );
  },

  createDoctorVisit: async (
    crewUuid: string,
    data: Omit<InsertCrewDoctorVisit, 'visitUuid' | 'crewUuid'>
  ): Promise<CrewDoctorVisit> => {
    const response = await apiRequest('POST', `${BASE_URL}/crew/${crewUuid}/doctor-visits`, data);
    return response.json();
  },

  updateDoctorVisit: async (
    crewUuid: string,
    visitUuid: string,
    data: Partial<InsertCrewDoctorVisit>
  ): Promise<CrewDoctorVisit> => {
    const response = await apiRequest(
      'PATCH',
      `${BASE_URL}/crew/${crewUuid}/doctor-visits/${visitUuid}`,
      data
    );
    return response.json();
  },

  deleteDoctorVisit: async (crewUuid: string, visitUuid: string): Promise<void> => {
    await apiRequest('DELETE', `${BASE_URL}/crew/${crewUuid}/doctor-visits/${visitUuid}`);
  },

  addDoctorVisitAttachment: async (
    crewUuid: string,
    visitUuid: string,
    data: { fileName: string; filePath?: string; fileData?: string }
  ): Promise<CrewDoctorVisitAttachment> => {
    const response = await apiRequest(
      'POST',
      `${BASE_URL}/crew/${crewUuid}/doctor-visits/${visitUuid}/attachments`,
      data
    );
    return response.json();
  },

  removeDoctorVisitAttachment: async (
    crewUuid: string,
    visitUuid: string,
    attUuid: string
  ): Promise<void> => {
    await apiRequest(
      'DELETE',
      `${BASE_URL}/crew/${crewUuid}/doctor-visits/${visitUuid}/attachments/${attUuid}`
    );
  },
};
