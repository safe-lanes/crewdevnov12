import { apiRequest } from '@/lib/queryClient';

const V2_BASE = '/api/v2/crew-pool';

export const crewPoolApiV2 = {
  async getCrewList(params?: {
    search?: string;
    rank?: string;
    nationality?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.rank) searchParams.set('rank', params.rank);
    if (params?.nationality) searchParams.set('nationality', params.nationality);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    
    const url = `${V2_BASE}/crew${searchParams.toString() ? '?' + searchParams : ''}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch crew list');
    return response.json();
  },

  async getCrewById(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}`);
    if (!response.ok) throw new Error('Failed to fetch crew member');
    return response.json();
  },

  async getCrewFullProfile(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/profile`);
    if (!response.ok) throw new Error('Failed to fetch crew profile');
    return response.json();
  },

  async createCrew(data: any) {
    const response = await apiRequest('POST', `${V2_BASE}/crew`, data);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to create crew member');
    }
    return response.json();
  },

  async updateCrew(crewUuid: string, data: any) {
    const response = await apiRequest('PATCH', `${V2_BASE}/crew/${crewUuid}`, data);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to update crew member');
    }
    return response.json();
  },

  async deleteCrew(crewUuid: string) {
    const response = await apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to delete crew member');
    }
    return response.json();
  },

  async getPersonalDetails(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/personal`);
    if (!response.ok) throw new Error('Failed to fetch personal details');
    return response.json();
  },

  async savePersonalDetails(crewUuid: string, data: any) {
    return apiRequest('PUT', `${V2_BASE}/crew/${crewUuid}/personal`, data);
  },

  async getAddress(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/address`);
    if (!response.ok) throw new Error('Failed to fetch address');
    return response.json();
  },

  async saveAddress(crewUuid: string, data: any) {
    return apiRequest('PUT', `${V2_BASE}/crew/${crewUuid}/address`, data);
  },

  async getFamilyInfo(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/family`);
    if (!response.ok) throw new Error('Failed to fetch family info');
    return response.json();
  },

  async saveFamilyInfo(crewUuid: string, data: any) {
    return apiRequest('PUT', `${V2_BASE}/crew/${crewUuid}/family`, data);
  },

  async getChildren(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/children`);
    if (!response.ok) throw new Error('Failed to fetch children');
    return response.json();
  },

  async createChild(crewUuid: string, data: any) {
    return apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/children`, data);
  },

  async updateChild(crewUuid: string, childUuid: string, data: any) {
    return apiRequest('PATCH', `${V2_BASE}/crew/${crewUuid}/children/${childUuid}`, data);
  },

  async deleteChild(crewUuid: string, childUuid: string) {
    return apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}/children/${childUuid}`);
  },

  async getNextOfKin(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/next-of-kin`);
    if (!response.ok) throw new Error('Failed to fetch next of kin');
    return response.json();
  },

  async saveNextOfKin(crewUuid: string, data: any) {
    return apiRequest('PUT', `${V2_BASE}/crew/${crewUuid}/next-of-kin`, data);
  },

  async getDocuments(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/documents`);
    if (!response.ok) throw new Error('Failed to fetch documents');
    return response.json();
  },

  async createDocument(crewUuid: string, data: any) {
    return apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/documents`, data);
  },

  async updateDocument(crewUuid: string, docUuid: string, data: any) {
    return apiRequest('PATCH', `${V2_BASE}/crew/${crewUuid}/documents/${docUuid}`, data);
  },

  async deleteDocument(crewUuid: string, docUuid: string) {
    return apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}/documents/${docUuid}`);
  },

  async getVisas(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/visas`);
    if (!response.ok) throw new Error('Failed to fetch visas');
    return response.json();
  },

  async createVisa(crewUuid: string, data: any) {
    return apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/visas`, data);
  },

  async updateVisa(crewUuid: string, visaUuid: string, data: any) {
    return apiRequest('PATCH', `${V2_BASE}/crew/${crewUuid}/visas/${visaUuid}`, data);
  },

  async deleteVisa(crewUuid: string, visaUuid: string) {
    return apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}/visas/${visaUuid}`);
  },

  async getEducation(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/education`);
    if (!response.ok) throw new Error('Failed to fetch education');
    return response.json();
  },

  async createEducation(crewUuid: string, data: any) {
    return apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/education`, data);
  },

  async updateEducation(crewUuid: string, eduUuid: string, data: any) {
    return apiRequest('PATCH', `${V2_BASE}/crew/${crewUuid}/education/${eduUuid}`, data);
  },

  async deleteEducation(crewUuid: string, eduUuid: string) {
    return apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}/education/${eduUuid}`);
  },

  async getLicenses(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/licenses`);
    if (!response.ok) throw new Error('Failed to fetch licenses');
    return response.json();
  },

  async createLicense(crewUuid: string, data: any) {
    return apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/licenses`, data);
  },

  async updateLicense(crewUuid: string, licUuid: string, data: any) {
    return apiRequest('PATCH', `${V2_BASE}/crew/${crewUuid}/licenses/${licUuid}`, data);
  },

  async deleteLicense(crewUuid: string, licUuid: string) {
    return apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}/licenses/${licUuid}`);
  },

  async archiveLicense(crewUuid: string, licUuid: string) {
    return apiRequest('PATCH', `${V2_BASE}/crew/${crewUuid}/licenses/${licUuid}/archive`, {});
  },

  async getTrainingCourses(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/training`);
    if (!response.ok) throw new Error('Failed to fetch training courses');
    return response.json();
  },

  async createTrainingCourse(crewUuid: string, data: any) {
    return apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/training`, data);
  },

  async updateTrainingCourse(crewUuid: string, trainUuid: string, data: any) {
    return apiRequest('PATCH', `${V2_BASE}/crew/${crewUuid}/training/${trainUuid}`, data);
  },

  async deleteTrainingCourse(crewUuid: string, trainUuid: string) {
    return apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}/training/${trainUuid}`);
  },

  async getSeaService(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/sea-service`);
    if (!response.ok) throw new Error('Failed to fetch sea service');
    return response.json();
  },

  async createSeaService(crewUuid: string, data: any) {
    return apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/sea-service`, data);
  },

  async updateSeaService(crewUuid: string, seaUuid: string, data: any) {
    return apiRequest('PATCH', `${V2_BASE}/crew/${crewUuid}/sea-service/${seaUuid}`, data);
  },

  async deleteSeaService(crewUuid: string, seaUuid: string) {
    return apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}/sea-service/${seaUuid}`);
  },

  async getMedicals(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/medicals`);
    if (!response.ok) throw new Error('Failed to fetch medicals');
    return response.json();
  },

  async createMedical(crewUuid: string, data: any) {
    return apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/medicals`, data);
  },

  async updateMedical(crewUuid: string, medUuid: string, data: any) {
    return apiRequest('PATCH', `${V2_BASE}/crew/${crewUuid}/medicals/${medUuid}`, data);
  },

  async deleteMedical(crewUuid: string, medUuid: string) {
    return apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}/medicals/${medUuid}`);
  },

  async getDoctorVisits(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/doctor-visits`);
    if (!response.ok) throw new Error('Failed to fetch doctor visits');
    return response.json();
  },

  async createDoctorVisit(crewUuid: string, data: any) {
    return apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/doctor-visits`, data);
  },

  async updateDoctorVisit(crewUuid: string, visitUuid: string, data: any) {
    return apiRequest('PATCH', `${V2_BASE}/crew/${crewUuid}/doctor-visits/${visitUuid}`, data);
  },

  async deleteDoctorVisit(crewUuid: string, visitUuid: string) {
    return apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}/doctor-visits/${visitUuid}`);
  },

  async getVesselTypesApplied(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/vessel-types`);
    if (!response.ok) throw new Error('Failed to fetch vessel types applied');
    return response.json();
  },

  async saveVesselTypesApplied(crewUuid: string, vesselTypeUuids: string[]) {
    return apiRequest('PUT', `${V2_BASE}/crew/${crewUuid}/vessel-types`, { vesselTypeUuids });
  },

  async getAssignments(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/assignments`);
    if (!response.ok) throw new Error('Failed to fetch assignments');
    return response.json();
  },

  async assignToVessel(crewUuid: string, data: any) {
    return apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/assign`, data);
  },

  async signOff(crewUuid: string, data: any) {
    return apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/sign-off`, data);
  },
};
