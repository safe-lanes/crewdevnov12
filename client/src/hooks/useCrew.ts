/**
 * Custom hooks for crew-related data management
 * Uses TanStack Query for caching and state management
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  fetchCrewMembers, 
  fetchCrewMember, 
  createCrewMember, 
  updateCrewMember, 
  deleteCrewMember,
  fetchAppraisals,
  fetchAppraisal,
  createAppraisal,
  updateAppraisal,
  deleteAppraisal,
  submitAppraisal,
  approveAppraisal
} from "../modules/crewing/services/crew.api";
import { CrewMemberFormData, AppraisalFormData, CrewSearchData } from "../modules/crewing/validation/crew.schema";
import { useToast } from "@/hooks/use-toast";

// Query keys for cache management
export const crewQueryKeys = {
  all: ['crew'] as const,
  lists: () => [...crewQueryKeys.all, 'list'] as const,
  list: (filters?: CrewSearchData) => [...crewQueryKeys.lists(), filters] as const,
  details: () => [...crewQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...crewQueryKeys.details(), id] as const,
  appraisals: () => [...crewQueryKeys.all, 'appraisals'] as const,
  appraisal: (id: number) => [...crewQueryKeys.appraisals(), id] as const,
};

/**
 * Hook to fetch crew members with optional filtering
 */
export function useCrewMembers(filters?: CrewSearchData) {
  return useQuery({
    queryKey: crewQueryKeys.list(filters),
    queryFn: () => fetchCrewMembers(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch a single crew member
 */
export function useCrewMember(id: string) {
  return useQuery({
    queryKey: crewQueryKeys.detail(id),
    queryFn: () => fetchCrewMember(id),
    enabled: !!id,
  });
}

/**
 * Hook to create a new crew member
 */
export function useCreateCrewMember() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: createCrewMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crewQueryKeys.lists() });
      toast({
        title: "Success",
        description: "Crew member created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create crew member",
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook to update an existing crew member
 */
export function useUpdateCrewMember() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CrewMemberFormData> }) =>
      updateCrewMember(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: crewQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: crewQueryKeys.detail(id) });
      toast({
        title: "Success",
        description: "Crew member updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update crew member",
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook to delete a crew member
 */
export function useDeleteCrewMember() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: deleteCrewMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crewQueryKeys.lists() });
      toast({
        title: "Success",
        description: "Crew member deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete crew member",
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook to fetch appraisals
 */
export function useAppraisals(filters?: { crewMemberId?: string; status?: string }) {
  return useQuery({
    queryKey: [...crewQueryKeys.appraisals(), filters],
    queryFn: () => fetchAppraisals(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch a single appraisal
 */
export function useAppraisal(id: number) {
  return useQuery({
    queryKey: crewQueryKeys.appraisal(id),
    queryFn: () => fetchAppraisal(id),
    enabled: !!id && id > 0,
  });
}

/**
 * Hook to create a new appraisal
 */
export function useCreateAppraisal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: createAppraisal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crewQueryKeys.appraisals() });
      toast({
        title: "Success",
        description: "Appraisal created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create appraisal",
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook to update an appraisal
 */
export function useUpdateAppraisal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AppraisalFormData> }) =>
      updateAppraisal(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: crewQueryKeys.appraisals() });
      queryClient.invalidateQueries({ queryKey: crewQueryKeys.appraisal(id) });
      toast({
        title: "Success",
        description: "Appraisal updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update appraisal",
        variant: "destructive",
      });
    },
  });
}