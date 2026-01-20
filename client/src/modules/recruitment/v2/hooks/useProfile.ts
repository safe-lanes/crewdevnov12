import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  vesselTypesAppliedApi,
  personalDetailsApi,
  addressApi,
  familyInfoApi,
  childrenApi,
  nextOfKinApi,
} from "../api";
import type {
  VesselTypesApplied,
  PersonalDetails,
  Address,
  FamilyInfo,
  Child,
  NextOfKin,
  AddVesselTypeAppliedRequest,
  UpsertPersonalDetailsRequest,
  UpsertAddressRequest,
  UpsertFamilyInfoRequest,
  CreateChildRequest,
  UpdateChildRequest,
  CreateNextOfKinRequest,
  UpdateNextOfKinRequest,
} from "../../../../../shared/v2/recruitment/types";
import { candidateKeys } from "./useCandidates";

// ============================================================================
// QUERY KEYS
// ============================================================================

export const profileKeys = {
  vesselTypesApplied: (candidateId: number) =>
    [...candidateKeys.detail(candidateId), "vesselTypesApplied"] as const,
  personalDetails: (candidateId: number) =>
    [...candidateKeys.detail(candidateId), "personalDetails"] as const,
  address: (candidateId: number) =>
    [...candidateKeys.detail(candidateId), "address"] as const,
  familyInfo: (candidateId: number) =>
    [...candidateKeys.detail(candidateId), "familyInfo"] as const,
  children: (candidateId: number) =>
    [...candidateKeys.detail(candidateId), "children"] as const,
  nextOfKin: (candidateId: number) =>
    [...candidateKeys.detail(candidateId), "nextOfKin"] as const,
};

// ============================================================================
// VESSEL TYPES APPLIED
// ============================================================================

export function useVesselTypesApplied(candidateId: number) {
  return useQuery<VesselTypesApplied[]>({
    queryKey: profileKeys.vesselTypesApplied(candidateId),
    queryFn: () => vesselTypesAppliedApi.getByCandidateId(candidateId),
    enabled: !!candidateId,
  });
}

export function useAddVesselTypeApplied() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      candidateId,
      data,
    }: {
      candidateId: number;
      data: AddVesselTypeAppliedRequest;
    }) => vesselTypesAppliedApi.add(candidateId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: profileKeys.vesselTypesApplied(variables.candidateId),
      });
    },
  });
}

export function useRemoveVesselTypeApplied() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ candidateId, vtaId }: { candidateId: number; vtaId: number }) =>
      vesselTypesAppliedApi.remove(candidateId, vtaId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: profileKeys.vesselTypesApplied(variables.candidateId),
      });
    },
  });
}

// ============================================================================
// PERSONAL DETAILS
// ============================================================================

export function usePersonalDetails(candidateId: number) {
  return useQuery<PersonalDetails | null>({
    queryKey: profileKeys.personalDetails(candidateId),
    queryFn: () => personalDetailsApi.getByCandidateId(candidateId),
    enabled: !!candidateId,
  });
}

export function useUpsertPersonalDetails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      candidateId,
      data,
    }: {
      candidateId: number;
      data: UpsertPersonalDetailsRequest;
    }) => personalDetailsApi.upsert(candidateId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: profileKeys.personalDetails(variables.candidateId),
      });
    },
  });
}

// ============================================================================
// ADDRESS
// ============================================================================

export function useAddress(candidateId: number) {
  return useQuery<Address | null>({
    queryKey: profileKeys.address(candidateId),
    queryFn: () => addressApi.getByCandidateId(candidateId),
    enabled: !!candidateId,
  });
}

export function useUpsertAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      candidateId,
      data,
    }: {
      candidateId: number;
      data: UpsertAddressRequest;
    }) => addressApi.upsert(candidateId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: profileKeys.address(variables.candidateId),
      });
    },
  });
}

// ============================================================================
// FAMILY INFO
// ============================================================================

export function useFamilyInfo(candidateId: number) {
  return useQuery<FamilyInfo | null>({
    queryKey: profileKeys.familyInfo(candidateId),
    queryFn: () => familyInfoApi.getByCandidateId(candidateId),
    enabled: !!candidateId,
  });
}

export function useUpsertFamilyInfo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      candidateId,
      data,
    }: {
      candidateId: number;
      data: UpsertFamilyInfoRequest;
    }) => familyInfoApi.upsert(candidateId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: profileKeys.familyInfo(variables.candidateId),
      });
    },
  });
}

// ============================================================================
// CHILDREN
// ============================================================================

export function useChildren(candidateId: number) {
  return useQuery<Child[]>({
    queryKey: profileKeys.children(candidateId),
    queryFn: () => childrenApi.getByCandidateId(candidateId),
    enabled: !!candidateId,
  });
}

export function useCreateChild() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      candidateId,
      data,
    }: {
      candidateId: number;
      data: CreateChildRequest;
    }) => childrenApi.create(candidateId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: profileKeys.children(variables.candidateId),
      });
    },
  });
}

export function useUpdateChild() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      candidateId,
      childId,
      data,
    }: {
      candidateId: number;
      childId: number;
      data: UpdateChildRequest;
    }) => childrenApi.update(candidateId, childId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: profileKeys.children(variables.candidateId),
      });
    },
  });
}

export function useDeleteChild() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ candidateId, childId }: { candidateId: number; childId: number }) =>
      childrenApi.delete(candidateId, childId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: profileKeys.children(variables.candidateId),
      });
    },
  });
}

// ============================================================================
// NEXT OF KIN
// ============================================================================

export function useNextOfKin(candidateId: number) {
  return useQuery<NextOfKin[]>({
    queryKey: profileKeys.nextOfKin(candidateId),
    queryFn: () => nextOfKinApi.getByCandidateId(candidateId),
    enabled: !!candidateId,
  });
}

export function useCreateNextOfKin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      candidateId,
      data,
    }: {
      candidateId: number;
      data: CreateNextOfKinRequest;
    }) => nextOfKinApi.create(candidateId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: profileKeys.nextOfKin(variables.candidateId),
      });
    },
  });
}

export function useUpdateNextOfKin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      candidateId,
      nokId,
      data,
    }: {
      candidateId: number;
      nokId: number;
      data: UpdateNextOfKinRequest;
    }) => nextOfKinApi.update(candidateId, nokId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: profileKeys.nextOfKin(variables.candidateId),
      });
    },
  });
}

export function useDeleteNextOfKin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ candidateId, nokId }: { candidateId: number; nokId: number }) =>
      nextOfKinApi.delete(candidateId, nokId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: profileKeys.nextOfKin(variables.candidateId),
      });
    },
  });
}
