import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { candidateApi } from "../api";
import type {
  CandidateV2,
  CreateCandidateRequest,
  UpdateCandidateRequest,
} from "../../../../../shared/v2/recruitment/types";

// ============================================================================
// QUERY KEYS
// ============================================================================

export const candidateKeys = {
  all: ["v2", "candidates"] as const,
  list: () => [...candidateKeys.all, "list"] as const,
  detail: (id: number) => [...candidateKeys.all, "detail", id] as const,
};

// ============================================================================
// QUERIES
// ============================================================================

export function useCandidatesV2() {
  return useQuery<CandidateV2[]>({
    queryKey: candidateKeys.list(),
    queryFn: candidateApi.getAll,
  });
}

export function useCandidateV2(id: number) {
  return useQuery<CandidateV2>({
    queryKey: candidateKeys.detail(id),
    queryFn: () => candidateApi.getById(id),
    enabled: !!id,
  });
}

// ============================================================================
// MUTATIONS
// ============================================================================

export function useCreateCandidateV2() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCandidateRequest) => candidateApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: candidateKeys.list() });
    },
  });
}

export function useUpdateCandidateV2() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateCandidateRequest }) =>
      candidateApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: candidateKeys.list() });
      queryClient.invalidateQueries({ queryKey: candidateKeys.detail(variables.id) });
    },
  });
}

export function useDeleteCandidateV2() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => candidateApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: candidateKeys.list() });
    },
  });
}
