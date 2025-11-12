/**
 * API service layer for crew-related operations
 * Handles HTTP requests for crew members and appraisals
 */

import { apiRequest } from "@/lib/queryClient";

export interface CrewMemberResponse {
  id: string;
  firstName: string;
  middleName?: string;
  familyName: string;
  nationality: string;
  presentRank: string;
  dob: string;
  age: string;
  status: string;
  presentVessel: string;
}

export interface AppraisalResponse {
  id: number;
  crewMemberId: string;
  formId: number;
  appraisalType: string;
  appraisalDate: string;
  competenceRating?: string;
  behavioralRating?: string;
  overallRating?: string;
  status: string;
}

/**
 * Fetch all crew members with optional filtering
 */
export async function fetchCrewMembers(filters?: any): Promise<CrewMemberResponse[]> {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, String(value));
    });
  }
  
  const url = `/api/crew-members${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch crew members');
  return response.json();
}

/**
 * Fetch a single crew member by ID
 */
export async function fetchCrewMember(id: string): Promise<CrewMemberResponse> {
  const response = await fetch(`/api/crew-members/${id}`);
  if (!response.ok) throw new Error('Failed to fetch crew member');
  return response.json();
}

/**
 * Create a new crew member
 */
export async function createCrewMember(data: any): Promise<CrewMemberResponse> {
  const response = await apiRequest('POST', `/api/crew-members`, data);
  return response.json();
}

/**
 * Update an existing crew member
 */
export async function updateCrewMember(id: string, data: any): Promise<CrewMemberResponse> {
  const response = await apiRequest('PATCH', `/api/crew-members/${id}`, data);
  return response.json();
}

/**
 * Delete a crew member
 */
export async function deleteCrewMember(id: string): Promise<void> {
  await apiRequest('DELETE', `/api/crew-members/${id}`);
}

/**
 * Fetch all appraisals with optional filtering
 */
export async function fetchAppraisals(filters?: { crewMemberId?: string; status?: string }): Promise<AppraisalResponse[]> {
  const params = new URLSearchParams();
  if (filters?.crewMemberId) params.append('crewMemberId', filters.crewMemberId);
  if (filters?.status) params.append('status', filters.status);
  
  const url = `/api/appraisals${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch appraisals');
  return response.json();
}

/**
 * Fetch a single appraisal by ID
 */
export async function fetchAppraisal(id: number): Promise<AppraisalResponse> {
  const response = await fetch(`/api/appraisals/${id}`);
  if (!response.ok) throw new Error('Failed to fetch appraisal');
  return response.json();
}

/**
 * Create a new appraisal
 */
export async function createAppraisal(data: any): Promise<AppraisalResponse> {
  const response = await apiRequest('POST', `/api/appraisals`, data);
  return response.json();
}

/**
 * Update an existing appraisal
 */
export async function updateAppraisal(id: number, data: any): Promise<AppraisalResponse> {
  const response = await apiRequest('PATCH', `/api/appraisals/${id}`, data);
  return response.json();
}

/**
 * Delete an appraisal
 */
export async function deleteAppraisal(id: number): Promise<void> {
  await apiRequest('DELETE', `/api/appraisals/${id}`);
}

/**
 * Submit an appraisal
 */
export async function submitAppraisal(id: number): Promise<AppraisalResponse> {
  const response = await apiRequest('POST', `/api/appraisals/${id}/submit`);
  return response.json();
}

/**
 * Approve an appraisal
 */
export async function approveAppraisal(id: number): Promise<AppraisalResponse> {
  const response = await apiRequest('POST', `/api/appraisals/${id}/approve`);
  return response.json();
}
