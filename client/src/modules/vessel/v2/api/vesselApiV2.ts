import { apiRequest } from '@/lib/queryClient';

const V2_BASE = '/api/v2/vessel';

export interface VesselPlanningV2 {
  planUuid: string;
  vesselUuid: string;
  vesselName?: string;
  activeRevisionUuid: string | null;
  rankId: string;
  rank: string;
  crewUuid: string | null;
  crewName?: string;
  crewStatus: string;
  signOnDate: string | null;
  reliefDue: string | null;
  signOffDate: string | null;
  signOffPortUuid: string | null;
  signOffPortName?: string;
  signOffReason: string | null;
  reliefStatus: string | null;
  takeOverDate: string | null;
  takeOverConfirmation: boolean;
  handOverDate: string | null;
  relieverCrewUuid: string | null;
  relieverCrewName?: string;
  relieverSignOnDate: string | null;
  joiningPortUuid: string | null;
  joiningPortName?: string;
  joiningStatus: string | null;
  contractPeriodMonths: number | null;
  contractEndRangeStartMonths: number | null;
  contractEndRangeEndMonths: number | null;
  relieverContractPeriodMonths: number | null;
  relieverContractEndRangeStartMonths: number | null;
  relieverContractEndRangeEndMonths: number | null;
  deploymentChecklistCompleted: boolean | null;
  applicableDocsChecked: boolean | null;
  isArchived: boolean;
  archivedDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VesselPlanningAttachmentV2 {
  attUuid: string;
  planUuid: string;
  fileName: string | null;
  fileType: string | null;
  fileSize: string | null;
  filePath: string | null;
  fileData: string | null;
  uploadedByUuid: string | null;
  uploadDate: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlanningInput {
  vesselUuid: string;
  rankId: string;
  rank: string;
  crewUuid?: string;
  crewStatus?: string;
  signOnDate?: string;
  reliefDue?: string;
  contractPeriodMonths?: number;
  contractEndRangeStartMonths?: number;
  contractEndRangeEndMonths?: number;
  relieverCrewUuid?: string;
  relieverSignOnDate?: string;
  joiningPortUuid?: string;
  joiningStatus?: string;
  relieverContractPeriodMonths?: number;
  relieverContractEndRangeStartMonths?: number;
  relieverContractEndRangeEndMonths?: number;
}

export interface UpdatePlanningInput {
  crewUuid?: string;
  crewStatus?: string;
  signOnDate?: string;
  reliefDue?: string;
  signOffDate?: string;
  signOffPortUuid?: string;
  signOffReason?: string;
  reliefStatus?: string;
  takeOverDate?: string;
  takeOverConfirmation?: boolean;
  handOverDate?: string;
  relieverCrewUuid?: string;
  relieverSignOnDate?: string;
  joiningPortUuid?: string;
  joiningStatus?: string;
  contractPeriodMonths?: number;
  contractEndRangeStartMonths?: number;
  contractEndRangeEndMonths?: number;
  relieverContractPeriodMonths?: number;
  relieverContractEndRangeStartMonths?: number;
  relieverContractEndRangeEndMonths?: number;
  deploymentChecklistCompleted?: boolean;
  applicableDocsChecked?: boolean;
}

export const vesselApiV2 = {
  async getVesselPlanning(vesselCode: string): Promise<VesselPlanningV2[]> {
    const response = await fetch(`${V2_BASE}/${encodeURIComponent(vesselCode)}/planning`);
    if (!response.ok) throw new Error('Failed to fetch vessel planning');
    return response.json();
  },

  async getPlanningById(planUuid: string): Promise<VesselPlanningV2 & { attachments: VesselPlanningAttachmentV2[] }> {
    const response = await fetch(`${V2_BASE}/planning/${planUuid}`);
    if (!response.ok) throw new Error('Failed to fetch planning');
    return response.json();
  },

  async createPlanning(data: CreatePlanningInput): Promise<VesselPlanningV2> {
    const response = await apiRequest('POST', `${V2_BASE}/${encodeURIComponent(data.vesselUuid)}/planning`, data);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to create planning');
    }
    return response.json();
  },

  async updatePlanning(planUuid: string, data: UpdatePlanningInput): Promise<VesselPlanningV2> {
    const response = await apiRequest('PATCH', `${V2_BASE}/planning/${planUuid}`, data);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to update planning');
    }
    return response.json();
  },

  async archivePlanning(planUuid: string, archivedByUuid: string): Promise<VesselPlanningV2> {
    const response = await apiRequest('POST', `${V2_BASE}/planning/${planUuid}/archive`, { archivedByUuid });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to archive planning');
    }
    return response.json();
  },

  async getAttachments(planUuid: string): Promise<VesselPlanningAttachmentV2[]> {
    const response = await fetch(`${V2_BASE}/planning/${planUuid}/attachments`);
    if (!response.ok) throw new Error('Failed to fetch attachments');
    return response.json();
  },

  async uploadAttachment(planUuid: string, file: File, uploadedByUuid: string): Promise<VesselPlanningAttachmentV2> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploadedByUuid', uploadedByUuid);
    
    const response = await fetch(`${V2_BASE}/planning/${planUuid}/attachments`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to upload attachment');
    }
    return response.json();
  },

  async deleteAttachment(planUuid: string, attUuid: string): Promise<void> {
    const response = await apiRequest('DELETE', `${V2_BASE}/planning/${planUuid}/attachments/${attUuid}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to delete attachment');
    }
  },
};
