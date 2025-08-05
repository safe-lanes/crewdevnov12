/**
 * API service for crew-related operations
 * Handles all HTTP requests for crew management
 */

import { CrewMember, AppraisalResult } from "@shared/schema";
import { get, post, patch, del } from "@/utils/http";
import { CrewMemberFormData, AppraisalFormData, CrewSearchData } from "../validation/crew.schema";

const API_BASE = "/api";

/**
 * Fetch all crew members with optional filtering
 */
export async function fetchCrewMembers(filters?: CrewSearchData): Promise<CrewMember[]> {
  const params = new URLSearchParams();
  
  if (filters?.search) params.append("search", filters.search);
  if (filters?.rank) params.append("rank", filters.rank);
  if (filters?.vessel) params.append("vessel", filters.vessel);
  if (filters?.vesselType) params.append("vesselType", filters.vesselType);
  if (filters?.nationality) params.append("nationality", filters.nationality);
  
  const query = params.toString();
  return get<CrewMember[]>(`${API_BASE}/crew-members${query ? `?${query}` : ""}`);
}

/**
 * Fetch a single crew member by ID
 */
export async function fetchCrewMember(id: string): Promise<CrewMember> {
  return get<CrewMember>(`${API_BASE}/crew-members/${id}`);
}

/**
 * Create a new crew member
 */
export async function createCrewMember(data: CrewMemberFormData): Promise<CrewMember> {
  return post<CrewMember>(`${API_BASE}/crew-members`, data);
}

/**
 * Update an existing crew member
 */
export async function updateCrewMember(id: string, data: Partial<CrewMemberFormData>): Promise<CrewMember> {
  return patch<CrewMember>(`${API_BASE}/crew-members/${id}`, data);
}

/**
 * Delete a crew member
 */
export async function deleteCrewMember(id: string): Promise<void> {
  return del<void>(`${API_BASE}/crew-members/${id}`);
}

/**
 * Fetch all appraisals with optional filtering
 */
export async function fetchAppraisals(filters?: { crewMemberId?: string; status?: string }): Promise<AppraisalResult[]> {
  const params = new URLSearchParams();
  
  if (filters?.crewMemberId) params.append("crewMemberId", filters.crewMemberId);
  if (filters?.status) params.append("status", filters.status);
  
  const query = params.toString();
  return get<AppraisalResult[]>(`${API_BASE}/appraisals${query ? `?${query}` : ""}`);
}

/**
 * Fetch a single appraisal by ID
 */
export async function fetchAppraisal(id: number): Promise<AppraisalResult> {
  return get<AppraisalResult>(`${API_BASE}/appraisals/${id}`);
}

/**
 * Create a new appraisal
 */
export async function createAppraisal(data: AppraisalFormData): Promise<AppraisalResult> {
  return post<AppraisalResult>(`${API_BASE}/appraisals`, data);
}

/**
 * Update an existing appraisal
 */
export async function updateAppraisal(id: number, data: Partial<AppraisalFormData>): Promise<AppraisalResult> {
  return patch<AppraisalResult>(`${API_BASE}/appraisals/${id}`, data);
}

/**
 * Delete an appraisal
 */
export async function deleteAppraisal(id: number): Promise<void> {
  return del<void>(`${API_BASE}/appraisals/${id}`);
}

/**
 * Submit an appraisal (change status to submitted)
 */
export async function submitAppraisal(id: number): Promise<AppraisalResult> {
  return patch<AppraisalResult>(`${API_BASE}/appraisals/${id}/submit`);
}

/**
 * Approve an appraisal (change status to approved)
 */
export async function approveAppraisal(id: number): Promise<AppraisalResult> {
  return patch<AppraisalResult>(`${API_BASE}/appraisals/${id}/approve`);
}