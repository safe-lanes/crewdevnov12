import { apiRequest } from '@/lib/queryClient';
import { getAuthToken } from '@/lib/authToken';
import { getTenantId } from '@/lib/tenantStorage';

const V2_BASE = '/api/v2/crew-pool';

export const crewPoolApiV2 = {
  async getCrewList(params?: {
    search?: string;
    rank?: string;
    nationality?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }, signal?: AbortSignal) {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.rank) searchParams.set('rank', params.rank);
    if (params?.nationality) searchParams.set('nationality', params.nationality);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    
    const url = `${V2_BASE}/crew/details${searchParams.toString() ? '?' + searchParams : ''}`;
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error('Failed to fetch crew list');
    return response.json();
  },

  async getTerminatedCrewList(signal?: AbortSignal) {
    const response = await fetch(`${V2_BASE}/crew/details?view=terminated`, { signal });
    if (!response.ok) throw new Error('Failed to fetch terminated crew list');
    return response.json();
  },

  async terminateEmployment(crewUuid: string, payload: any) {
    const response = await apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/terminations`, payload);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || error.error || 'Failed to terminate employment');
    }
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
    const response = await apiRequest('PUT', `${V2_BASE}/crew/${crewUuid}/personal`, data);
    if (!response.ok) throw new Error('Failed to save personal details');
    return response.json();
  },

  async getAddress(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/address`);
    if (!response.ok) throw new Error('Failed to fetch address');
    return response.json();
  },

  async saveAddress(crewUuid: string, data: any) {
    const response = await apiRequest('PUT', `${V2_BASE}/crew/${crewUuid}/address`, data);
    if (!response.ok) throw new Error('Failed to save address');
    return response.json();
  },

  async getFamilyInfo(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/family`);
    if (!response.ok) throw new Error('Failed to fetch family info');
    return response.json();
  },

  async saveFamilyInfo(crewUuid: string, data: any) {
    const response = await apiRequest('PUT', `${V2_BASE}/crew/${crewUuid}/family`, data);
    if (!response.ok) throw new Error('Failed to save family info');
    return response.json();
  },

  async getChildren(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/children`);
    if (!response.ok) throw new Error('Failed to fetch children');
    return response.json();
  },

  async createChild(crewUuid: string, data: any) {
    const response = await apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/children`, data);
    return response.json();
  },

  async updateChild(crewUuid: string, childUuid: string, data: any) {
    const response = await apiRequest('PATCH', `${V2_BASE}/crew/${crewUuid}/children/${childUuid}`, data);
    return response.json();
  },

  async deleteChild(crewUuid: string, childUuid: string) {
    const response = await apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}/children/${childUuid}`);
    return response.json().catch(() => ({}));
  },

  async getNextOfKin(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/next-of-kin`);
    if (!response.ok) throw new Error('Failed to fetch next of kin');
    return response.json();
  },

  async saveNextOfKin(crewUuid: string, data: any) {
    const response = await apiRequest('PUT', `${V2_BASE}/crew/${crewUuid}/next-of-kin`, data);
    return response.json();
  },

  async getDocuments(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/documents`);
    if (!response.ok) throw new Error('Failed to fetch documents');
    return response.json();
  },

  async createDocument(crewUuid: string, data: any) {
    const response = await apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/documents`, data);
    return response.json();
  },

  async updateDocument(crewUuid: string, docUuid: string, data: any) {
    const response = await apiRequest('PATCH', `${V2_BASE}/crew/${crewUuid}/documents/${docUuid}`, data);
    return response.json();
  },

  async deleteDocument(crewUuid: string, docUuid: string) {
    const response = await apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}/documents/${docUuid}`);
    return response.json().catch(() => ({}));
  },

  async addDocumentAttachment(crewUuid: string, docUuid: string, data: any) {
    const response = await apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/documents/${docUuid}/attachments`, data);
    return response.json();
  },

  async removeDocumentAttachment(crewUuid: string, docUuid: string, attUuid: string) {
    const response = await apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}/documents/${docUuid}/attachments/${attUuid}`);
    return response.json().catch(() => ({}));
  },

  async getVisas(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/visas`);
    if (!response.ok) throw new Error('Failed to fetch visas');
    return response.json();
  },

  async createVisa(crewUuid: string, data: any) {
    const response = await apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/visas`, data);
    return response.json();
  },

  async updateVisa(crewUuid: string, visaUuid: string, data: any) {
    const response = await apiRequest('PATCH', `${V2_BASE}/crew/${crewUuid}/visas/${visaUuid}`, data);
    return response.json();
  },

  async deleteVisa(crewUuid: string, visaUuid: string) {
    const response = await apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}/visas/${visaUuid}`);
    return response.json().catch(() => ({}));
  },

  async addVisaAttachment(crewUuid: string, visaUuid: string, data: any) {
    const response = await apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/visas/${visaUuid}/attachments`, data);
    return response.json();
  },

  async removeVisaAttachment(crewUuid: string, visaUuid: string, attUuid: string) {
    const response = await apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}/visas/${visaUuid}/attachments/${attUuid}`);
    return response.json().catch(() => ({}));
  },

  async getEducation(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/education`);
    if (!response.ok) throw new Error('Failed to fetch education');
    return response.json();
  },

  async createEducation(crewUuid: string, data: any) {
    const response = await apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/education`, data);
    return response.json();
  },

  async updateEducation(crewUuid: string, eduUuid: string, data: any) {
    const response = await apiRequest('PATCH', `${V2_BASE}/crew/${crewUuid}/education/${eduUuid}`, data);
    return response.json();
  },

  async deleteEducation(crewUuid: string, eduUuid: string) {
    const response = await apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}/education/${eduUuid}`);
    return response.json().catch(() => ({}));
  },

  async addEducationAttachment(crewUuid: string, eduUuid: string, data: any) {
    const response = await apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/education/${eduUuid}/attachments`, data);
    return response.json();
  },

  async removeEducationAttachment(crewUuid: string, eduUuid: string, attUuid: string) {
    const response = await apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}/education/${eduUuid}/attachments/${attUuid}`);
    return response.json().catch(() => ({}));
  },

  async getLicenses(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/licenses`);
    if (!response.ok) throw new Error('Failed to fetch licenses');
    return response.json();
  },

  async createLicense(crewUuid: string, data: any) {
    const response = await apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/licenses`, data);
    return response.json();
  },

  async updateLicense(crewUuid: string, licUuid: string, data: any) {
    const response = await apiRequest('PATCH', `${V2_BASE}/crew/${crewUuid}/licenses/${licUuid}`, data);
    return response.json();
  },

  async deleteLicense(crewUuid: string, licUuid: string) {
    const response = await apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}/licenses/${licUuid}`);
    return response.json().catch(() => ({}));
  },

  async archiveLicense(crewUuid: string, licUuid: string) {
    const response = await apiRequest('PATCH', `${V2_BASE}/crew/${crewUuid}/licenses/${licUuid}/archive`, {});
    return response.json();
  },

  async addLicenseAttachment(crewUuid: string, licUuid: string, data: any) {
    const response = await apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/licenses/${licUuid}/attachments`, data);
    return response.json();
  },

  async removeLicenseAttachment(crewUuid: string, licUuid: string, attUuid: string) {
    const response = await apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}/licenses/${licUuid}/attachments/${attUuid}`);
    return response.json().catch(() => ({}));
  },

  async getTrainingCourses(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/training`);
    if (!response.ok) throw new Error('Failed to fetch training courses');
    return response.json();
  },

  async createTrainingCourse(crewUuid: string, data: any) {
    const response = await apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/training`, data);
    return response.json();
  },

  async updateTrainingCourse(crewUuid: string, trainUuid: string, data: any) {
    const response = await apiRequest('PATCH', `${V2_BASE}/crew/${crewUuid}/training/${trainUuid}`, data);
    return response.json();
  },

  async deleteTrainingCourse(crewUuid: string, trainUuid: string) {
    const response = await apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}/training/${trainUuid}`);
    return response.json().catch(() => ({}));
  },

  async addTrainingAttachment(crewUuid: string, trainUuid: string, data: any) {
    const response = await apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/training/${trainUuid}/attachments`, data);
    return response.json();
  },

  async removeTrainingAttachment(crewUuid: string, trainUuid: string, attUuid: string) {
    const response = await apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}/training/${trainUuid}/attachments/${attUuid}`);
    return response.json().catch(() => ({}));
  },

  async getSeaService(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/sea-service`);
    if (!response.ok) throw new Error('Failed to fetch sea service');
    return response.json();
  },

  async createSeaService(crewUuid: string, data: any) {
    const response = await apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/sea-service`, data);
    return response.json();
  },

  async updateSeaService(crewUuid: string, seaUuid: string, data: any) {
    const response = await apiRequest('PATCH', `${V2_BASE}/crew/${crewUuid}/sea-service/${seaUuid}`, data);
    return response.json();
  },

  async deleteSeaService(crewUuid: string, seaUuid: string) {
    const response = await apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}/sea-service/${seaUuid}`);
    return response.json().catch(() => ({}));
  },

  async addSeaServiceAttachment(crewUuid: string, seaUuid: string, data: any) {
    const response = await apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/sea-service/${seaUuid}/attachments`, data);
    return response.json();
  },

  async removeSeaServiceAttachment(crewUuid: string, seaUuid: string, attUuid: string) {
    const response = await apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}/sea-service/${seaUuid}/attachments/${attUuid}`);
    return response.json().catch(() => ({}));
  },

  async getMedicals(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/medicals`);
    if (!response.ok) throw new Error('Failed to fetch medicals');
    return response.json();
  },

  async createMedical(crewUuid: string, data: any) {
    const response = await apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/medicals`, data);
    return response.json();
  },

  async updateMedical(crewUuid: string, medUuid: string, data: any) {
    const response = await apiRequest('PATCH', `${V2_BASE}/crew/${crewUuid}/medicals/${medUuid}`, data);
    return response.json();
  },

  async deleteMedical(crewUuid: string, medUuid: string) {
    const response = await apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}/medicals/${medUuid}`);
    return response.json().catch(() => ({}));
  },

  async addMedicalAttachment(crewUuid: string, medUuid: string, data: any) {
    const response = await apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/medicals/${medUuid}/attachments`, data);
    return response.json();
  },

  async removeMedicalAttachment(crewUuid: string, medUuid: string, attUuid: string) {
    const response = await apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}/medicals/${medUuid}/attachments/${attUuid}`);
    return response.json().catch(() => ({}));
  },

  async getDoctorVisits(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/doctor-visits`);
    if (!response.ok) throw new Error('Failed to fetch doctor visits');
    return response.json();
  },

  async createDoctorVisit(crewUuid: string, data: any) {
    const response = await apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/doctor-visits`, data);
    return response.json();
  },

  async updateDoctorVisit(crewUuid: string, visitUuid: string, data: any) {
    const response = await apiRequest('PATCH', `${V2_BASE}/crew/${crewUuid}/doctor-visits/${visitUuid}`, data);
    return response.json();
  },

  async deleteDoctorVisit(crewUuid: string, visitUuid: string) {
    const response = await apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}/doctor-visits/${visitUuid}`);
    return response.json().catch(() => ({}));
  },

  async addDoctorVisitAttachment(crewUuid: string, visitUuid: string, data: any) {
    const response = await apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/doctor-visits/${visitUuid}/attachments`, data);
    return response.json();
  },

  async removeDoctorVisitAttachment(crewUuid: string, visitUuid: string, attUuid: string) {
    const response = await apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}/doctor-visits/${visitUuid}/attachments/${attUuid}`);
    return response.json().catch(() => ({}));
  },

  async getBriefings(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/briefings`);
    if (!response.ok) throw new Error('Failed to fetch briefings');
    return response.json();
  },

  async createBriefing(crewUuid: string, data: any) {
    const response = await apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/briefings`, data);
    return response.json();
  },

  async updateBriefing(crewUuid: string, briefingUuid: string, data: any) {
    const response = await apiRequest('PATCH', `${V2_BASE}/crew/${crewUuid}/briefings/${briefingUuid}`, data);
    return response.json();
  },

  async deleteBriefing(crewUuid: string, briefingUuid: string) {
    const response = await apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}/briefings/${briefingUuid}`);
    return response.json().catch(() => ({}));
  },

  async addBriefingAttachment(crewUuid: string, briefingUuid: string, data: any) {
    const response = await apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/briefings/${briefingUuid}/attachments`, data);
    return response.json();
  },

  async removeBriefingAttachment(crewUuid: string, briefingUuid: string, attUuid: string) {
    const response = await apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}/briefings/${briefingUuid}/attachments/${attUuid}`);
    return response.json().catch(() => ({}));
  },

  async getDebriefings(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/debriefings`);
    if (!response.ok) throw new Error('Failed to fetch debriefings');
    return response.json();
  },

  async createDebriefing(crewUuid: string, data: any) {
    const response = await apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/debriefings`, data);
    return response.json();
  },

  async updateDebriefing(crewUuid: string, debriefingUuid: string, data: any) {
    const response = await apiRequest('PATCH', `${V2_BASE}/crew/${crewUuid}/debriefings/${debriefingUuid}`, data);
    return response.json();
  },

  async deleteDebriefing(crewUuid: string, debriefingUuid: string) {
    const response = await apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}/debriefings/${debriefingUuid}`);
    return response.json().catch(() => ({}));
  },

  async addDebriefingAttachment(crewUuid: string, debriefingUuid: string, data: any) {
    const response = await apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/debriefings/${debriefingUuid}/attachments`, data);
    return response.json();
  },

  async removeDebriefingAttachment(crewUuid: string, debriefingUuid: string, attUuid: string) {
    const response = await apiRequest('DELETE', `${V2_BASE}/crew/${crewUuid}/debriefings/${debriefingUuid}/attachments/${attUuid}`);
    return response.json().catch(() => ({}));
  },

  async getVesselTypesApplied(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/vessel-types`);
    if (!response.ok) throw new Error('Failed to fetch vessel types applied');
    return response.json();
  },

  async saveVesselTypesApplied(crewUuid: string, vesselTypeUuids: string[]) {
    const response = await apiRequest('PUT', `${V2_BASE}/crew/${crewUuid}/vessel-types`, { vesselTypeUuids });
    return response.json();
  },

  async getAssignments(crewUuid: string) {
    const response = await fetch(`${V2_BASE}/crew/${crewUuid}/assignments`);
    if (!response.ok) throw new Error('Failed to fetch assignments');
    return response.json();
  },

  async assignToVessel(crewUuid: string, data: any) {
    const response = await apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/assign`, data);
    return response.json();
  },

  async signOff(crewUuid: string, data: any) {
    const response = await apiRequest('POST', `${V2_BASE}/crew/${crewUuid}/sign-off`, data);
    return response.json();
  },

  async downloadTemplate() {
    const response = await fetch(`${V2_BASE}/import/template`);
    if (!response.ok) throw new Error('Failed to download template');
    return response.blob();
  },

  // Send the workbook as raw binary (application/octet-stream) so very large
  // files (lakhs of rows) are not inflated ~33% by base64 or blocked by the
  // global JSON body limit. tenant/auth headers are injected by the global
  // fetch wrapper (tenantFetch.ts).
  async validateImport(fileBuffer: ArrayBuffer) {
    const response = await fetch(`${V2_BASE}/import/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: fileBuffer,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Validation failed');
    }
    return response.json();
  },

  async executeImport(fileBuffer: ArrayBuffer) {
    const response = await fetch(`${V2_BASE}/import/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: fileBuffer,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Import failed');
    }
    return response.json();
  },

  // Upload a ZIP of attachment files as raw binary using XHR so we get real
  // upload progress events. Each file must live under a
  // <Employee ID>/<Attachment Ref>/<file> folder path.
  // onProgress receives a value 0-100 representing upload percent.
  uploadAttachmentsZip(
    fileBuffer: ArrayBuffer,
    onProgress?: (percent: number) => void,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${V2_BASE}/import/attachments`);
      xhr.setRequestHeader('Content-Type', 'application/zip');

      const tenantId = getTenantId();
      if (tenantId) xhr.setRequestHeader('x-tenant-id', tenantId);
      const token = getAuthToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable && onProgress) {
          onProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status === 401) {
          reject(new Error('401: Unauthorized - redirecting to login'));
          return;
        }
        if (xhr.status < 200 || xhr.status >= 300) {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.message || err.error || 'Attachment import failed'));
          } catch {
            reject(new Error(xhr.statusText || 'Attachment import failed'));
          }
          return;
        }
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error('Invalid response from server'));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(fileBuffer);
    });
  },
};
