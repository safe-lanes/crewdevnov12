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
  CandidateRecruitmentDecision,
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
      postApi<ScreeningB1>(`/candidates/${recCanUuid}/screening/b1`, data),
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
      postApi<ScreeningB2>(`/candidates/${recCanUuid}/screening/b2`, data),
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
      postApi<ScreeningB3>(`/candidates/${recCanUuid}/screening/b3`, data),
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
      postApi<ScreeningB4>(`/candidates/${recCanUuid}/screening/b4`, data),
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
      postApi<ScreeningB5>(`/candidates/${recCanUuid}/screening/b5`, data),
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
      postApi<ScreeningB6>(`/candidates/${recCanUuid}/screening/b6`, data),
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
      postApi<ScreeningB7>(`/candidates/${recCanUuid}/screening/b7`, data),
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
      postApi<ScreeningB8>(`/candidates/${recCanUuid}/screening/b8`, data),
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
      postApi<CandidateSuitability>(`/candidates/${recCanUuid}/suitability`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'suitability', variables.recCanUuid] });
    },
  });
}

export function useV2RecruitmentDecision(recCanUuid: string | null) {
  return useQuery<CandidateRecruitmentDecision>({
    queryKey: ['v2', 'recruitment-decision', recCanUuid],
    queryFn: () => fetchApi(`/candidates/${recCanUuid}/recruitment-decision`),
    enabled: !!recCanUuid,
  });
}

export function useV2SaveRecruitmentDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recCanUuid, data }: { recCanUuid: string; data: Partial<CandidateRecruitmentDecision> }) =>
      postApi<CandidateRecruitmentDecision>(`/candidates/${recCanUuid}/recruitment-decision`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'recruitment-decision', variables.recCanUuid] });
      queryClient.invalidateQueries({ queryKey: ['v2', 'candidates'] });
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
