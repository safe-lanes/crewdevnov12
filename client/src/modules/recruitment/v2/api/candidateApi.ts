import type {
  CandidateV2,
  VesselTypesApplied,
  PersonalDetails,
  Address,
  FamilyInfo,
  Child,
  NextOfKin,
  CreateCandidateRequest,
  UpdateCandidateRequest,
  UpsertPersonalDetailsRequest,
  UpsertAddressRequest,
  UpsertFamilyInfoRequest,
  CreateChildRequest,
  UpdateChildRequest,
  CreateNextOfKinRequest,
  UpdateNextOfKinRequest,
  AddVesselTypeAppliedRequest,
} from "../../../../../shared/v2/recruitment/types";

const BASE_URL = "/api/v2/recruitment";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || "Request failed");
  }
  
  if (response.status === 204) {
    return undefined as T;
  }
  
  return response.json();
}

// ============================================================================
// CANDIDATE API
// ============================================================================

export const candidateApi = {
  getAll: async (): Promise<CandidateV2[]> => {
    const response = await fetch(`${BASE_URL}/candidates`);
    return handleResponse<CandidateV2[]>(response);
  },

  getById: async (id: number): Promise<CandidateV2> => {
    const response = await fetch(`${BASE_URL}/candidates/${id}`);
    return handleResponse<CandidateV2>(response);
  },

  create: async (data: CreateCandidateRequest): Promise<CandidateV2> => {
    const response = await fetch(`${BASE_URL}/candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<CandidateV2>(response);
  },

  update: async (id: number, data: UpdateCandidateRequest): Promise<CandidateV2> => {
    const response = await fetch(`${BASE_URL}/candidates/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<CandidateV2>(response);
  },

  delete: async (id: number): Promise<void> => {
    const response = await fetch(`${BASE_URL}/candidates/${id}`, {
      method: "DELETE",
    });
    return handleResponse<void>(response);
  },
};

// ============================================================================
// VESSEL TYPES APPLIED API
// ============================================================================

export const vesselTypesAppliedApi = {
  getByCandidateId: async (candidateId: number): Promise<VesselTypesApplied[]> => {
    const response = await fetch(`${BASE_URL}/candidates/${candidateId}/vessel-types-applied`);
    return handleResponse<VesselTypesApplied[]>(response);
  },

  add: async (candidateId: number, data: AddVesselTypeAppliedRequest): Promise<VesselTypesApplied> => {
    const response = await fetch(`${BASE_URL}/candidates/${candidateId}/vessel-types-applied`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<VesselTypesApplied>(response);
  },

  remove: async (candidateId: number, vtaId: number): Promise<void> => {
    const response = await fetch(`${BASE_URL}/candidates/${candidateId}/vessel-types-applied/${vtaId}`, {
      method: "DELETE",
    });
    return handleResponse<void>(response);
  },
};

// ============================================================================
// PERSONAL DETAILS API
// ============================================================================

export const personalDetailsApi = {
  getByCandidateId: async (candidateId: number): Promise<PersonalDetails | null> => {
    const response = await fetch(`${BASE_URL}/candidates/${candidateId}/personal-details`);
    const data = await handleResponse<PersonalDetails | Record<string, never>>(response);
    return Object.keys(data).length === 0 ? null : data as PersonalDetails;
  },

  upsert: async (candidateId: number, data: UpsertPersonalDetailsRequest): Promise<PersonalDetails> => {
    const response = await fetch(`${BASE_URL}/candidates/${candidateId}/personal-details`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<PersonalDetails>(response);
  },
};

// ============================================================================
// ADDRESS API
// ============================================================================

export const addressApi = {
  getByCandidateId: async (candidateId: number): Promise<Address | null> => {
    const response = await fetch(`${BASE_URL}/candidates/${candidateId}/addresses`);
    const data = await handleResponse<Address | Record<string, never>>(response);
    return Object.keys(data).length === 0 ? null : data as Address;
  },

  upsert: async (candidateId: number, data: UpsertAddressRequest): Promise<Address> => {
    const response = await fetch(`${BASE_URL}/candidates/${candidateId}/addresses`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<Address>(response);
  },
};

// ============================================================================
// FAMILY INFO API
// ============================================================================

export const familyInfoApi = {
  getByCandidateId: async (candidateId: number): Promise<FamilyInfo | null> => {
    const response = await fetch(`${BASE_URL}/candidates/${candidateId}/family-info`);
    const data = await handleResponse<FamilyInfo | Record<string, never>>(response);
    return Object.keys(data).length === 0 ? null : data as FamilyInfo;
  },

  upsert: async (candidateId: number, data: UpsertFamilyInfoRequest): Promise<FamilyInfo> => {
    const response = await fetch(`${BASE_URL}/candidates/${candidateId}/family-info`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<FamilyInfo>(response);
  },
};

// ============================================================================
// CHILDREN API
// ============================================================================

export const childrenApi = {
  getByCandidateId: async (candidateId: number): Promise<Child[]> => {
    const response = await fetch(`${BASE_URL}/candidates/${candidateId}/children`);
    return handleResponse<Child[]>(response);
  },

  create: async (candidateId: number, data: CreateChildRequest): Promise<Child> => {
    const response = await fetch(`${BASE_URL}/candidates/${candidateId}/children`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<Child>(response);
  },

  update: async (candidateId: number, childId: number, data: UpdateChildRequest): Promise<Child> => {
    const response = await fetch(`${BASE_URL}/candidates/${candidateId}/children/${childId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<Child>(response);
  },

  delete: async (candidateId: number, childId: number): Promise<void> => {
    const response = await fetch(`${BASE_URL}/candidates/${candidateId}/children/${childId}`, {
      method: "DELETE",
    });
    return handleResponse<void>(response);
  },
};

// ============================================================================
// NEXT OF KIN API
// ============================================================================

export const nextOfKinApi = {
  getByCandidateId: async (candidateId: number): Promise<NextOfKin[]> => {
    const response = await fetch(`${BASE_URL}/candidates/${candidateId}/next-of-kin`);
    return handleResponse<NextOfKin[]>(response);
  },

  create: async (candidateId: number, data: CreateNextOfKinRequest): Promise<NextOfKin> => {
    const response = await fetch(`${BASE_URL}/candidates/${candidateId}/next-of-kin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<NextOfKin>(response);
  },

  update: async (candidateId: number, nokId: number, data: UpdateNextOfKinRequest): Promise<NextOfKin> => {
    const response = await fetch(`${BASE_URL}/candidates/${candidateId}/next-of-kin/${nokId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<NextOfKin>(response);
  },

  delete: async (candidateId: number, nokId: number): Promise<void> => {
    const response = await fetch(`${BASE_URL}/candidates/${candidateId}/next-of-kin/${nokId}`, {
      method: "DELETE",
    });
    return handleResponse<void>(response);
  },
};
