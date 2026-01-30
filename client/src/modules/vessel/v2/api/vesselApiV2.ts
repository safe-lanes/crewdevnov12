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
  docExpiringCount?: string;
  medicalExpiring?: string;
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
  signOffDate?: string;
  signOffPortUuid?: string;
  signOffReason?: string;
  reliefStatus?: string;
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
  crewUuid?: string | null;
  crewStatus?: string | null;
  signOnDate?: string | null;
  reliefDue?: string | null;
  signOffDate?: string | null;
  signOffPortUuid?: string | null;
  signOffReason?: string | null;
  reliefStatus?: string | null;
  takeOverDate?: string | null;
  takeOverConfirmation?: boolean | null;
  handOverDate?: string | null;
  relieverCrewUuid?: string | null;
  relieverSignOnDate?: string | null;
  joiningPortUuid?: string | null;
  joiningStatus?: string | null;
  contractPeriodMonths?: number | null;
  contractEndRangeStartMonths?: number | null;
  contractEndRangeEndMonths?: number | null;
  relieverContractPeriodMonths?: number | null;
  relieverContractEndRangeStartMonths?: number | null;
  relieverContractEndRangeEndMonths?: number | null;
  deploymentChecklistCompleted?: boolean | null;
  applicableDocsChecked?: boolean | null;
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

  /**
   * Sign on reliever: moves crew from Reliever Status to On Board Status
   * This updates crew_assignments.isCurrent to true and moves relieverCrewUuid to crewUuid
   */
  async signOnReliever(planUuid: string, data: {
    signOnDate?: string;
    signOnPort?: string;
    contractPeriodMonths?: number;
  }): Promise<VesselPlanningV2> {
    const response = await apiRequest('POST', `${V2_BASE}/planning/${planUuid}/sign-on`, data);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to sign on reliever');
    }
    return response.json();
  },

  /**
   * Update reliever status without signing on
   * For status changes: Planned -> Confirmed -> In Transit
   */
  async updateRelieverStatus(planUuid: string, data: {
    joiningStatus: string;
    relieverSignOnDate?: string;
    joiningPortUuid?: string;
    relieverContractPeriodMonths?: number;
  }): Promise<VesselPlanningV2> {
    const response = await apiRequest('PATCH', `${V2_BASE}/planning/${planUuid}/reliever-status`, data);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to update reliever status');
    }
    return response.json();
  },

  /**
   * Get Officer Matrix data for a crew member
   * Returns experience metrics, certifications, and English proficiency
   */
  async getOfficerMatrixData(crewUuid: string, rank: string, signOnDate: string | null, department: 'deck' | 'engine'): Promise<OfficerMatrixData> {
    const params = new URLSearchParams();
    if (rank) params.append('rank', rank);
    if (signOnDate) params.append('signOnDate', signOnDate);
    params.append('department', department);
    
    const response = await fetch(`${V2_BASE}/officer-matrix/${crewUuid}?${params.toString()}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to fetch officer matrix data');
    }
    return response.json();
  },
};

export interface OfficerMatrixData {
  companyYears: number;
  rankYears: number;
  tankerTypeYears: number;
  allTankersYears: number;
  oowYears: number;
  timeOnBoardMonths: number;
  certComp: string;
  issuingCountry: string;
  tankerCert: string;
  splTankerTraining: string;
  radioQual: boolean;
  englishProficiency: string;
}
