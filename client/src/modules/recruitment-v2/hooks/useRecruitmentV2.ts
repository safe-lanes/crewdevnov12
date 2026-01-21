import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CandidateCore,
  CandidateVesselType,
  CandidatePersonalDetails,
  CandidateAddress,
  CandidateFamilyInfo,
  CandidateChild,
  CandidateNextOfKin,
  CandidateDocument,
  CandidateVisa,
  CandidateEducation,
  CandidateLicense,
  CandidateTrainingCourse,
  CandidateSeaService,
  CandidateAdditionalInfo,
  Attachment,
  ScreeningB1,
  ScreeningB2,
  ScreeningB3,
  ScreeningB4,
  ScreeningB5,
  ScreeningB6,
  ScreeningB7,
  ScreeningB8,
  CandidateApproval,
  CandidateSuitability,
  SuitabilityVesselType,
  SuitabilityFleetGroup,
  CandidateRecruitmentDecision,
  AssignedGroup,
  V2CandidateListItem,
} from '../types/formTypes';

const API_BASE = '/api/v2/recruitment';

async function fetchApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`);
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  return response.json();
}

async function postApi<T>(endpoint: string, data: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  return response.json();
}

async function putApi<T>(endpoint: string, data: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  return response.json();
}

async function patchApi<T>(endpoint: string, data: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  return response.json();
}

async function deleteApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  return response.json();
}

export function useV2Candidates() {
  return useQuery<V2CandidateListItem[]>({
    queryKey: ['v2', 'candidates'],
    queryFn: () => fetchApi('/candidates'),
  });
}

export function useV2Candidate(recCanUuid: string | null) {
  return useQuery<CandidateCore>({
    queryKey: ['v2', 'candidates', recCanUuid],
    queryFn: () => fetchApi(`/candidates/${recCanUuid}`),
    enabled: !!recCanUuid,
  });
}

export function useV2CreateCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CandidateCore>) => postApi<CandidateCore>('/candidates', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'candidates'] });
    },
  });
}

export function useV2UpdateCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recCanUuid, data }: { recCanUuid: string; data: Partial<CandidateCore> }) =>
      patchApi<CandidateCore>(`/candidates/${recCanUuid}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'candidates'] });
      queryClient.invalidateQueries({ queryKey: ['v2', 'candidates', variables.recCanUuid] });
    },
  });
}

export function useV2DeleteCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recCanUuid: string) => deleteApi(`/candidates/${recCanUuid}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'candidates'] });
    },
  });
}

export function useV2NextFileNumber() {
  return useQuery<{ nextFileNo: string }>({
    queryKey: ['v2', 'candidates', 'next-file-number'],
    queryFn: () => fetchApi('/candidates/next-file-number'),
  });
}

export function useV2PersonalDetails(recCanUuid: string | null) {
  return useQuery<CandidatePersonalDetails>({
    queryKey: ['v2', 'personal-details', recCanUuid],
    queryFn: () => fetchApi(`/candidates/${recCanUuid}/personal-details`),
    enabled: !!recCanUuid,
  });
}

export function useV2SavePersonalDetails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recCanUuid, data }: { recCanUuid: string; data: Partial<CandidatePersonalDetails> }) =>
      putApi<CandidatePersonalDetails>(`/candidates/${recCanUuid}/personal-details`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'personal-details', variables.recCanUuid] });
    },
  });
}

export function useV2VesselTypes(recCanUuid: string | null) {
  return useQuery<CandidateVesselType[]>({
    queryKey: ['v2', 'vessel-types', recCanUuid],
    queryFn: () => fetchApi(`/candidates/${recCanUuid}/vessel-types`),
    enabled: !!recCanUuid,
  });
}

export function useV2SaveVesselTypes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recCanUuid, data }: { recCanUuid: string; data: CandidateVesselType[] }) =>
      postApi<CandidateVesselType[]>(`/candidates/${recCanUuid}/vessel-types`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'vessel-types', variables.recCanUuid] });
    },
  });
}

export function useV2Address(recCanUuid: string | null) {
  return useQuery<CandidateAddress>({
    queryKey: ['v2', 'address', recCanUuid],
    queryFn: () => fetchApi(`/candidates/${recCanUuid}/address`),
    enabled: !!recCanUuid,
  });
}

export function useV2SaveAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recCanUuid, data }: { recCanUuid: string; data: Partial<CandidateAddress> }) =>
      putApi<CandidateAddress>(`/candidates/${recCanUuid}/address`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'address', variables.recCanUuid] });
    },
  });
}

export function useV2FamilyInfo(recCanUuid: string | null) {
  return useQuery<CandidateFamilyInfo>({
    queryKey: ['v2', 'family-info', recCanUuid],
    queryFn: () => fetchApi(`/candidates/${recCanUuid}/family-info`),
    enabled: !!recCanUuid,
  });
}

export function useV2SaveFamilyInfo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recCanUuid, data }: { recCanUuid: string; data: Partial<CandidateFamilyInfo> }) =>
      putApi<CandidateFamilyInfo>(`/candidates/${recCanUuid}/family-info`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'family-info', variables.recCanUuid] });
    },
  });
}

export function useV2Children(recCanUuid: string | null) {
  return useQuery<CandidateChild[]>({
    queryKey: ['v2', 'children', recCanUuid],
    queryFn: () => fetchApi(`/candidates/${recCanUuid}/children`),
    enabled: !!recCanUuid,
  });
}

export function useV2SaveChildren() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recCanUuid, data }: { recCanUuid: string; data: CandidateChild[] }) =>
      postApi<CandidateChild[]>(`/candidates/${recCanUuid}/children`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'children', variables.recCanUuid] });
    },
  });
}

export function useV2NextOfKin(recCanUuid: string | null) {
  return useQuery<CandidateNextOfKin>({
    queryKey: ['v2', 'next-of-kin', recCanUuid],
    queryFn: () => fetchApi(`/candidates/${recCanUuid}/next-of-kin`),
    enabled: !!recCanUuid,
  });
}

export function useV2SaveNextOfKin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recCanUuid, data }: { recCanUuid: string; data: Partial<CandidateNextOfKin> }) =>
      putApi<CandidateNextOfKin>(`/candidates/${recCanUuid}/next-of-kin`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'next-of-kin', variables.recCanUuid] });
    },
  });
}

export function useV2Documents(recCanUuid: string | null) {
  return useQuery<CandidateDocument[]>({
    queryKey: ['v2', 'documents', recCanUuid],
    queryFn: () => fetchApi(`/candidates/${recCanUuid}/documents`),
    enabled: !!recCanUuid,
  });
}

export function useV2SaveDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recCanUuid, data }: { recCanUuid: string; data: Partial<CandidateDocument> }) =>
      postApi<CandidateDocument>(`/candidates/${recCanUuid}/documents`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'documents', variables.recCanUuid] });
    },
  });
}

export function useV2UpdateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CandidateDocument>; recCanUuid: string }) =>
      patchApi<CandidateDocument>(`/documents/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'documents', variables.recCanUuid] });
    },
  });
}

export function useV2DeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, recCanUuid }: { id: number; recCanUuid: string }) =>
      deleteApi(`/documents/${id}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'documents', variables.recCanUuid] });
    },
  });
}

export function useV2Visas(recCanUuid: string | null) {
  return useQuery<CandidateVisa[]>({
    queryKey: ['v2', 'visas', recCanUuid],
    queryFn: () => fetchApi(`/candidates/${recCanUuid}/visas`),
    enabled: !!recCanUuid,
  });
}

export function useV2SaveVisa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recCanUuid, data }: { recCanUuid: string; data: Partial<CandidateVisa> }) =>
      postApi<CandidateVisa>(`/candidates/${recCanUuid}/visas`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'visas', variables.recCanUuid] });
    },
  });
}

export function useV2UpdateVisa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CandidateVisa>; recCanUuid: string }) =>
      patchApi<CandidateVisa>(`/visas/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'visas', variables.recCanUuid] });
    },
  });
}

export function useV2DeleteVisa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, recCanUuid }: { id: number; recCanUuid: string }) =>
      deleteApi(`/visas/${id}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'visas', variables.recCanUuid] });
    },
  });
}

export function useV2Education(recCanUuid: string | null) {
  return useQuery<CandidateEducation[]>({
    queryKey: ['v2', 'education', recCanUuid],
    queryFn: () => fetchApi(`/candidates/${recCanUuid}/education`),
    enabled: !!recCanUuid,
  });
}

export function useV2SaveEducation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recCanUuid, data }: { recCanUuid: string; data: Partial<CandidateEducation> }) =>
      postApi<CandidateEducation>(`/candidates/${recCanUuid}/education`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'education', variables.recCanUuid] });
    },
  });
}

export function useV2UpdateEducation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CandidateEducation>; recCanUuid: string }) =>
      patchApi<CandidateEducation>(`/education/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'education', variables.recCanUuid] });
    },
  });
}

export function useV2DeleteEducation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, recCanUuid }: { id: number; recCanUuid: string }) =>
      deleteApi(`/education/${id}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'education', variables.recCanUuid] });
    },
  });
}

export function useV2Licenses(recCanUuid: string | null) {
  return useQuery<CandidateLicense[]>({
    queryKey: ['v2', 'licenses', recCanUuid],
    queryFn: () => fetchApi(`/candidates/${recCanUuid}/licenses`),
    enabled: !!recCanUuid,
  });
}

export function useV2SaveLicense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recCanUuid, data }: { recCanUuid: string; data: Partial<CandidateLicense> }) =>
      postApi<CandidateLicense>(`/candidates/${recCanUuid}/licenses`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'licenses', variables.recCanUuid] });
    },
  });
}

export function useV2UpdateLicense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CandidateLicense>; recCanUuid: string }) =>
      patchApi<CandidateLicense>(`/licenses/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'licenses', variables.recCanUuid] });
    },
  });
}

export function useV2DeleteLicense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, recCanUuid }: { id: number; recCanUuid: string }) =>
      deleteApi(`/licenses/${id}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'licenses', variables.recCanUuid] });
    },
  });
}

export function useV2TrainingCourses(recCanUuid: string | null) {
  return useQuery<CandidateTrainingCourse[]>({
    queryKey: ['v2', 'training-courses', recCanUuid],
    queryFn: () => fetchApi(`/candidates/${recCanUuid}/training-courses`),
    enabled: !!recCanUuid,
  });
}

export function useV2SaveTrainingCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recCanUuid, data }: { recCanUuid: string; data: Partial<CandidateTrainingCourse> }) =>
      postApi<CandidateTrainingCourse>(`/candidates/${recCanUuid}/training-courses`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'training-courses', variables.recCanUuid] });
    },
  });
}

export function useV2UpdateTrainingCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CandidateTrainingCourse>; recCanUuid: string }) =>
      patchApi<CandidateTrainingCourse>(`/training/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'training-courses', variables.recCanUuid] });
    },
  });
}

export function useV2DeleteTrainingCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, recCanUuid }: { id: number; recCanUuid: string }) =>
      deleteApi(`/training/${id}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'training-courses', variables.recCanUuid] });
    },
  });
}

export function useV2SeaService(recCanUuid: string | null) {
  return useQuery<CandidateSeaService[]>({
    queryKey: ['v2', 'sea-service', recCanUuid],
    queryFn: () => fetchApi(`/candidates/${recCanUuid}/sea-service`),
    enabled: !!recCanUuid,
  });
}

export function useV2SaveSeaService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recCanUuid, data }: { recCanUuid: string; data: Partial<CandidateSeaService> }) =>
      postApi<CandidateSeaService>(`/candidates/${recCanUuid}/sea-service`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'sea-service', variables.recCanUuid] });
    },
  });
}

export function useV2UpdateSeaService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CandidateSeaService>; recCanUuid: string }) =>
      patchApi<CandidateSeaService>(`/sea-service/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'sea-service', variables.recCanUuid] });
    },
  });
}

export function useV2DeleteSeaService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, recCanUuid }: { id: number; recCanUuid: string }) =>
      deleteApi(`/sea-service/${id}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'sea-service', variables.recCanUuid] });
    },
  });
}

export function useV2AdditionalInfo(recCanUuid: string | null) {
  return useQuery<CandidateAdditionalInfo[]>({
    queryKey: ['v2', 'additional-info', recCanUuid],
    queryFn: () => fetchApi(`/candidates/${recCanUuid}/additional-info`),
    enabled: !!recCanUuid,
  });
}

export function useV2SaveAdditionalInfo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recCanUuid, data }: { recCanUuid: string; data: Partial<CandidateAdditionalInfo> }) =>
      postApi<CandidateAdditionalInfo>(`/candidates/${recCanUuid}/additional-info`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'additional-info', variables.recCanUuid] });
    },
  });
}

export function useV2UpdateAdditionalInfo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CandidateAdditionalInfo>; recCanUuid: string }) =>
      patchApi<CandidateAdditionalInfo>(`/additional-info/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'additional-info', variables.recCanUuid] });
    },
  });
}

export function useV2DeleteAdditionalInfo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, recCanUuid }: { id: number; recCanUuid: string }) =>
      deleteApi(`/additional-info/${id}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'additional-info', variables.recCanUuid] });
    },
  });
}

export function useV2ScreeningB1(recCanUuid: string | null) {
  return useQuery<ScreeningB1>({
    queryKey: ['v2', 'screening-b1', recCanUuid],
    queryFn: () => fetchApi(`/candidates/${recCanUuid}/screening/b1`),
    enabled: !!recCanUuid,
  });
}

export function useV2SaveScreeningB1() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recCanUuid, data }: { recCanUuid: string; data: Partial<ScreeningB1> }) =>
      putApi<ScreeningB1>(`/candidates/${recCanUuid}/screening/b1`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'screening-b1', variables.recCanUuid] });
    },
  });
}

export function useV2ScreeningB2(recCanUuid: string | null) {
  return useQuery<ScreeningB2>({
    queryKey: ['v2', 'screening-b2', recCanUuid],
    queryFn: () => fetchApi(`/candidates/${recCanUuid}/screening/b2`),
    enabled: !!recCanUuid,
  });
}

export function useV2SaveScreeningB2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recCanUuid, data }: { recCanUuid: string; data: Partial<ScreeningB2> }) =>
      putApi<ScreeningB2>(`/candidates/${recCanUuid}/screening/b2`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'screening-b2', variables.recCanUuid] });
    },
  });
}

export function useV2ScreeningB3(recCanUuid: string | null) {
  return useQuery<ScreeningB3>({
    queryKey: ['v2', 'screening-b3', recCanUuid],
    queryFn: () => fetchApi(`/candidates/${recCanUuid}/screening/b3`),
    enabled: !!recCanUuid,
  });
}

export function useV2SaveScreeningB3() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recCanUuid, data }: { recCanUuid: string; data: Partial<ScreeningB3> }) =>
      putApi<ScreeningB3>(`/candidates/${recCanUuid}/screening/b3`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'screening-b3', variables.recCanUuid] });
    },
  });
}

export function useV2ScreeningB4(recCanUuid: string | null) {
  return useQuery<ScreeningB4>({
    queryKey: ['v2', 'screening-b4', recCanUuid],
    queryFn: () => fetchApi(`/candidates/${recCanUuid}/screening/b4`),
    enabled: !!recCanUuid,
  });
}

export function useV2SaveScreeningB4() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recCanUuid, data }: { recCanUuid: string; data: Partial<ScreeningB4> }) =>
      putApi<ScreeningB4>(`/candidates/${recCanUuid}/screening/b4`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'screening-b4', variables.recCanUuid] });
    },
  });
}

export function useV2ScreeningB5(recCanUuid: string | null) {
  return useQuery<ScreeningB5>({
    queryKey: ['v2', 'screening-b5', recCanUuid],
    queryFn: () => fetchApi(`/candidates/${recCanUuid}/screening/b5`),
    enabled: !!recCanUuid,
  });
}

export function useV2SaveScreeningB5() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recCanUuid, data }: { recCanUuid: string; data: Partial<ScreeningB5> }) =>
      putApi<ScreeningB5>(`/candidates/${recCanUuid}/screening/b5`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'screening-b5', variables.recCanUuid] });
    },
  });
}

export function useV2ScreeningB6(recCanUuid: string | null) {
  return useQuery<ScreeningB6>({
    queryKey: ['v2', 'screening-b6', recCanUuid],
    queryFn: () => fetchApi(`/candidates/${recCanUuid}/screening/b6`),
    enabled: !!recCanUuid,
  });
}

export function useV2SaveScreeningB6() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recCanUuid, data }: { recCanUuid: string; data: Partial<ScreeningB6> }) =>
      putApi<ScreeningB6>(`/candidates/${recCanUuid}/screening/b6`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'screening-b6', variables.recCanUuid] });
    },
  });
}

export function useV2ScreeningB7(recCanUuid: string | null) {
  return useQuery<ScreeningB7>({
    queryKey: ['v2', 'screening-b7', recCanUuid],
    queryFn: () => fetchApi(`/candidates/${recCanUuid}/screening/b7`),
    enabled: !!recCanUuid,
  });
}

export function useV2SaveScreeningB7() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recCanUuid, data }: { recCanUuid: string; data: Partial<ScreeningB7> }) =>
      putApi<ScreeningB7>(`/candidates/${recCanUuid}/screening/b7`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'screening-b7', variables.recCanUuid] });
    },
  });
}

export function useV2ScreeningB8(recCanUuid: string | null) {
  return useQuery<ScreeningB8>({
    queryKey: ['v2', 'screening-b8', recCanUuid],
    queryFn: () => fetchApi(`/candidates/${recCanUuid}/screening/b8`),
    enabled: !!recCanUuid,
  });
}

export function useV2SaveScreeningB8() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recCanUuid, data }: { recCanUuid: string; data: Partial<ScreeningB8> }) =>
      putApi<ScreeningB8>(`/candidates/${recCanUuid}/screening/b8`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'screening-b8', variables.recCanUuid] });
    },
  });
}

export function useV2Approvals(recCanUuid: string | null) {
  return useQuery<CandidateApproval[]>({
    queryKey: ['v2', 'approvals', recCanUuid],
    queryFn: () => fetchApi(`/candidates/${recCanUuid}/approvals`),
    enabled: !!recCanUuid,
  });
}

export function useV2SaveApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recCanUuid, data }: { recCanUuid: string; data: Partial<CandidateApproval> }) =>
      postApi<CandidateApproval>(`/candidates/${recCanUuid}/approvals`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'approvals', variables.recCanUuid] });
    },
  });
}

export function useV2UpdateApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recCanUuid, id, data }: { recCanUuid: string; id: number; data: Partial<CandidateApproval> }) =>
      patchApi<CandidateApproval>(`/approvals/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'approvals', variables.recCanUuid] });
    },
  });
}

export function useV2Suitability(recCanUuid: string | null) {
  return useQuery<CandidateSuitability>({
    queryKey: ['v2', 'suitability', recCanUuid],
    queryFn: () => fetchApi(`/candidates/${recCanUuid}/suitability`),
    enabled: !!recCanUuid,
  });
}

export function useV2SaveSuitability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recCanUuid, data }: { recCanUuid: string; data: Partial<CandidateSuitability> }) =>
      putApi<CandidateSuitability>(`/candidates/${recCanUuid}/suitability`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'suitability', variables.recCanUuid] });
    },
  });
}

export function useV2RecruitmentDecision(recCanUuid: string | null) {
  return useQuery<CandidateRecruitmentDecision>({
    queryKey: ['v2', 'recruitment-decision', recCanUuid],
    queryFn: () => fetchApi(`/candidates/${recCanUuid}/decision`),
    enabled: !!recCanUuid,
  });
}

export function useV2SaveRecruitmentDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recCanUuid, data }: { recCanUuid: string; data: Partial<CandidateRecruitmentDecision> }) =>
      putApi<CandidateRecruitmentDecision>(`/candidates/${recCanUuid}/decision`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'recruitment-decision', variables.recCanUuid] });
      queryClient.invalidateQueries({ queryKey: ['v2', 'candidates'] });
    },
  });
}

export function useV2SuitabilityVesselTypes(suitUuid: string | null) {
  return useQuery<SuitabilityVesselType[]>({
    queryKey: ['v2', 'suitability-vessel-types', suitUuid],
    queryFn: () => fetchApi(`/suitability/${suitUuid}/vessel-types`),
    enabled: !!suitUuid,
  });
}

export function useV2SaveSuitabilityVesselType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ suitUuid, data }: { suitUuid: string; data: Partial<SuitabilityVesselType> }) =>
      postApi<SuitabilityVesselType>(`/suitability/${suitUuid}/vessel-types`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'suitability-vessel-types', variables.suitUuid] });
    },
  });
}

export function useV2SuitabilityFleetGroups(suitUuid: string | null) {
  return useQuery<SuitabilityFleetGroup[]>({
    queryKey: ['v2', 'suitability-fleet-groups', suitUuid],
    queryFn: () => fetchApi(`/suitability/${suitUuid}/fleet-groups`),
    enabled: !!suitUuid,
  });
}

export function useV2SaveSuitabilityFleetGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ suitUuid, data }: { suitUuid: string; data: Partial<SuitabilityFleetGroup> }) =>
      postApi<SuitabilityFleetGroup>(`/suitability/${suitUuid}/fleet-groups`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'suitability-fleet-groups', variables.suitUuid] });
    },
  });
}

export function useV2DecisionAssignedGroups(decisionUuid: string | null) {
  return useQuery<AssignedGroup[]>({
    queryKey: ['v2', 'decision-assigned-groups', decisionUuid],
    queryFn: () => fetchApi(`/decisions/${decisionUuid}/assigned-groups`),
    enabled: !!decisionUuid,
  });
}

export function useV2SaveDecisionAssignedGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ decisionUuid, data }: { decisionUuid: string; data: Partial<AssignedGroup> }) =>
      postApi<AssignedGroup>(`/decisions/${decisionUuid}/assigned-groups`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'decision-assigned-groups', variables.decisionUuid] });
    },
  });
}

export function useV2DocumentAttachments(docUuid: string | null) {
  return useQuery<Attachment[]>({
    queryKey: ['v2', 'document-attachments', docUuid],
    queryFn: () => fetchApi(`/documents/${docUuid}/attachments`),
    enabled: !!docUuid,
  });
}

export function useV2SaveDocumentAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ docUuid, data }: { docUuid: string; data: Partial<Attachment> }) =>
      postApi<Attachment>(`/documents/${docUuid}/attachments`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'document-attachments', variables.docUuid] });
    },
  });
}

export function useV2DeleteAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ attUuid, parentUuid, parentType }: { attUuid: string; parentUuid: string; parentType: string }) =>
      deleteApi(`/attachments/${attUuid}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', `${variables.parentType}-attachments`, variables.parentUuid] });
    },
  });
}

// Screening B2 Items (Reference Checks)
export interface ScreeningB2Item {
  id: number;
  itemUuid: string;
  b2Uuid: string;
  employerName?: string;
  contactPerson?: string;
  contactNumber?: string;
  dateContacted?: string;
  feedback?: string;
  rating?: string;
}

export function useV2ScreeningB2Items(b2Uuid: string | null) {
  return useQuery<ScreeningB2Item[]>({
    queryKey: ['v2', 'screening-b2-items', b2Uuid],
    queryFn: () => fetchApi(`/screening/b2/${b2Uuid}/items`),
    enabled: !!b2Uuid,
  });
}

export function useV2CreateScreeningB2Item() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ b2Uuid, data }: { b2Uuid: string; data: Partial<ScreeningB2Item> }) =>
      postApi<ScreeningB2Item>(`/screening/b2/${b2Uuid}/items`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'screening-b2-items', variables.b2Uuid] });
    },
  });
}

// Screening B3 Authorities
export interface ScreeningB3Authority {
  id: number;
  authorityUuid: string;
  b3Uuid: string;
  authorityName?: string;
  checkType?: string;
  dateChecked?: string;
  result?: string;
  remarks?: string;
}

export function useV2ScreeningB3Authorities(b3Uuid: string | null) {
  return useQuery<ScreeningB3Authority[]>({
    queryKey: ['v2', 'screening-b3-authorities', b3Uuid],
    queryFn: () => fetchApi(`/screening/b3/${b3Uuid}/authorities`),
    enabled: !!b3Uuid,
  });
}

export function useV2CreateScreeningB3Authority() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ b3Uuid, data }: { b3Uuid: string; data: Partial<ScreeningB3Authority> }) =>
      postApi<ScreeningB3Authority>(`/screening/b3/${b3Uuid}/authorities`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'screening-b3-authorities', variables.b3Uuid] });
    },
  });
}

// Screening B4 Cert Items
export interface ScreeningB4CertItem {
  id: number;
  certItemUuid: string;
  b4Uuid: string;
  certificateName?: string;
  issuingAuthority?: string;
  dateVerified?: string;
  verificationResult?: string;
  remarks?: string;
}

export function useV2ScreeningB4CertItems(b4Uuid: string | null) {
  return useQuery<ScreeningB4CertItem[]>({
    queryKey: ['v2', 'screening-b4-cert-items', b4Uuid],
    queryFn: () => fetchApi(`/screening/b4/${b4Uuid}/cert-items`),
    enabled: !!b4Uuid,
  });
}

export function useV2CreateScreeningB4CertItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ b4Uuid, data }: { b4Uuid: string; data: Partial<ScreeningB4CertItem> }) =>
      postApi<ScreeningB4CertItem>(`/screening/b4/${b4Uuid}/cert-items`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'screening-b4-cert-items', variables.b4Uuid] });
    },
  });
}

// Screening B5 Test Items
export interface ScreeningB5TestItem {
  id: number;
  testItemUuid: string;
  b5Uuid: string;
  testType?: string;
  testDate?: string;
  result?: string;
  score?: string;
  remarks?: string;
}

export function useV2ScreeningB5TestItems(b5Uuid: string | null) {
  return useQuery<ScreeningB5TestItem[]>({
    queryKey: ['v2', 'screening-b5-test-items', b5Uuid],
    queryFn: () => fetchApi(`/screening/b5/${b5Uuid}/test-items`),
    enabled: !!b5Uuid,
  });
}

export function useV2CreateScreeningB5TestItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ b5Uuid, data }: { b5Uuid: string; data: Partial<ScreeningB5TestItem> }) =>
      postApi<ScreeningB5TestItem>(`/screening/b5/${b5Uuid}/test-items`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'screening-b5-test-items', variables.b5Uuid] });
    },
  });
}

// Screening B6 Interview Items
// DB columns: int_uuid, b6_uuid, interview_date, interviewer_uuid, status, result, comments, sort_order
export interface ScreeningB6InterviewItem {
  id: number;
  intUuid: string;
  b6Uuid: string;
  interviewDate?: string;
  interviewerUuid?: string;
  status?: string;
  result?: string;
  comments?: string;
  sortOrder?: number;
}

export function useV2ScreeningB6InterviewItems(b6Uuid: string | null) {
  return useQuery<ScreeningB6InterviewItem[]>({
    queryKey: ['v2', 'screening-b6-interview-items', b6Uuid],
    queryFn: () => fetchApi(`/screening/b6/${b6Uuid}/interview-items`),
    enabled: !!b6Uuid,
  });
}

export function useV2CreateScreeningB6InterviewItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ b6Uuid, data }: { b6Uuid: string; data: Partial<ScreeningB6InterviewItem> }) =>
      postApi<ScreeningB6InterviewItem>(`/screening/b6/${b6Uuid}/interview-items`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'screening-b6-interview-items', variables.b6Uuid] });
    },
  });
}

// Screening B7 Training Items
// DB columns: train_item_uuid, b7_uuid, training, identified_by_uuid, category, due_date, comments, sort_order
export interface ScreeningB7TrainingItem {
  id: number;
  trainItemUuid: string;
  b7Uuid: string;
  training?: string;
  identifiedByUuid?: string;
  category?: string;
  dueDate?: string;
  comments?: string;
  sortOrder?: number;
}

export function useV2ScreeningB7TrainingItems(b7Uuid: string | null) {
  return useQuery<ScreeningB7TrainingItem[]>({
    queryKey: ['v2', 'screening-b7-training-items', b7Uuid],
    queryFn: () => fetchApi(`/screening/b7/${b7Uuid}/training-items`),
    enabled: !!b7Uuid,
  });
}

export function useV2CreateScreeningB7TrainingItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ b7Uuid, data }: { b7Uuid: string; data: Partial<ScreeningB7TrainingItem> }) =>
      postApi<ScreeningB7TrainingItem>(`/screening/b7/${b7Uuid}/training-items`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'screening-b7-training-items', variables.b7Uuid] });
    },
  });
}

// Screening B8 Approvers
export interface ScreeningB8Approver {
  id: number;
  approverUuid: string;
  b8Uuid: string;
  approverName?: string;
  approverRole?: string;
  approvalDate?: string;
  decision?: string;
  remarks?: string;
}

export function useV2ScreeningB8Approvers(b8Uuid: string | null) {
  return useQuery<ScreeningB8Approver[]>({
    queryKey: ['v2', 'screening-b8-approvers', b8Uuid],
    queryFn: () => fetchApi(`/screening/b8/${b8Uuid}/approvers`),
    enabled: !!b8Uuid,
  });
}

export function useV2CreateScreeningB8Approver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ b8Uuid, data }: { b8Uuid: string; data: Partial<ScreeningB8Approver> }) =>
      postApi<ScreeningB8Approver>(`/screening/b8/${b8Uuid}/approvers`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'screening-b8-approvers', variables.b8Uuid] });
    },
  });
}
