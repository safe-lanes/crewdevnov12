import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AvailableRank, InsertAvailableRank, VesselDraft, InsertVesselDraft } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

// Interface for Rank Master data that mirrors AdminModule structure
export interface RankMasterData {
  id: string;
  rank: string;
  rankId: string;
  applicableToCompany: boolean;
  label: string;
  isSystemRank?: boolean; // Protected starter pack ranks - cannot edit name or delete
}

// Function to map AvailableRank from database to RankMasterData format
const mapAvailableRankToRankMasterData = (availableRank: AvailableRank): RankMasterData => {
  // Helper functions to generate fallback values only when needed
  const generateRankId = (name: string, id: number): string => {
    if (name.toLowerCase().includes('master')) return 'S1';
    if (name.toLowerCase().includes('chief officer')) return 'S2';
    if (name.toLowerCase().includes('second officer') || name.toLowerCase().includes('2nd officer')) return 'S3';
    if (name.toLowerCase().includes('third officer') || name.toLowerCase().includes('3rd officer')) return 'S4';
    if (name.toLowerCase().includes('fourth officer') || name.toLowerCase().includes('4th officer')) return 'S5';
    if (name.toLowerCase().includes('deck cadet')) return 'S6';
    if (name.toLowerCase().includes('chief engineer')) return 'S7';
    // Default to S + id for other ranks
    return `S${id}`;
  };

  const generateLabel = (name: string): string => {
    if (name.toLowerCase().includes('master')) return 'Master';
    if (name.toLowerCase().includes('chief officer')) return 'Chief Off';
    if (name.toLowerCase().includes('second officer') || name.toLowerCase().includes('2nd officer')) return '2nd Off';
    if (name.toLowerCase().includes('third officer') || name.toLowerCase().includes('3rd officer')) return '3rd Off';
    if (name.toLowerCase().includes('fourth officer') || name.toLowerCase().includes('4th officer')) return '4th Off';
    if (name.toLowerCase().includes('deck cadet')) return 'Deck Cadet';
    if (name.toLowerCase().includes('chief engineer')) return 'Ch Eng';
    if (name.toLowerCase().includes('second engineer') || name.toLowerCase().includes('2nd engineer')) return '2nd Eng';
    if (name.toLowerCase().includes('third engineer') || name.toLowerCase().includes('3rd engineer')) return '3rd Eng';
    // Default to the full name for other ranks
    return name;
  };

  const generateApplicableToCompany = (category: string): boolean => {
    // Default fallback: Senior Officers and Junior Officers are typically applicable to company
    return ['Senior Officers', 'Junior Officers'].includes(category);
  };

  return {
    id: availableRank.id.toString(),
    rank: availableRank.name,
    // FIXED: Use actual database values, only generate fallbacks when null/undefined
    rankId: availableRank.rankId ?? generateRankId(availableRank.name, availableRank.id),
    label: availableRank.label ?? generateLabel(availableRank.name),
    applicableToCompany: availableRank.applicableToCompany ?? generateApplicableToCompany(availableRank.category),
    isSystemRank: availableRank.isSystemRank ?? false,
  };
};

// Hook to get all rank master data from database
export const useRankMasterData = (options?: { enabled?: boolean }) => {
  const query = useQuery<AvailableRank[]>({
    queryKey: ["/api/available-ranks"],
    queryFn: async () => {
      const response = await fetch("/api/available-ranks");
      if (!response.ok) {
        throw new Error("Failed to fetch available ranks");
      }
      return response.json();
    },
    // Optimize performance - reasonable cache time
    staleTime: 5 * 60 * 1000, // 5 minutes - data doesn't change frequently
    gcTime: 30 * 60 * 1000, // 30 minutes in memory
    refetchOnMount: false, // Use cache if available
    refetchOnWindowFocus: false, // Don't refetch on focus
    refetchOnReconnect: true, // Refetch on reconnect is fine
    enabled: options?.enabled ?? true, // Allow conditional fetching
  });

  const mappedData = query.data?.map(mapAvailableRankToRankMasterData) || [];

  return {
    data: mappedData,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

// Hook to get company-applicable ranks (server-filtered)
export const useCompanyRanks = () => {
  const query = useQuery<AvailableRank[]>({
    queryKey: ["/api/available-ranks", "companyOnly"],
    queryFn: async () => {
      const response = await fetch("/api/available-ranks?companyOnly=true");
      if (!response.ok) {
        throw new Error("Failed to fetch company ranks");
      }
      return response.json();
    },
    // Optimize performance - reasonable cache time
    staleTime: 5 * 60 * 1000, // 5 minutes - data doesn't change frequently
    gcTime: 30 * 60 * 1000, // 30 minutes in memory
    refetchOnMount: false, // Use cache if available
    refetchOnWindowFocus: false, // Don't refetch on focus
    refetchOnReconnect: true, // Refetch on reconnect is fine
  });

  const mappedData = query.data?.map(mapAvailableRankToRankMasterData) || [];
  
  return {
    data: mappedData,
    isLoading: query.isLoading,
    error: query.error,
    // Convenience method to get just the rank names for dropdowns (full names like "Master", "Chief Officer")
    rankNames: mappedData.map(rank => rank.rank),
    // Convenience method to get rank labels for display (company-specific labels like "3rd Officer", "2nd Engineer")
    rankLabels: mappedData.map(rank => rank.label),
    // Get a mapping for dropdown display - USES RANK LABELS as values (what users see and filter by)
    // value=label (e.g., "3rd Officer"), display=label (e.g., "3rd Officer")
    rankOptions: mappedData.map(rank => ({ value: rank.label, label: rank.label })),
  };
};

// Hook to fetch saved company rank data (including role variants)
export const useFetchCompanyRanks = (options?: { enabled?: boolean }) => {
  return useQuery<any[]>({
    queryKey: ["/api/company-ranks"],
    queryFn: async () => {
      const response = await fetch("/api/company-ranks");
      if (!response.ok) {
        throw new Error("Failed to fetch company ranks");
      }
      return response.json();
    },
    staleTime: 0,
    gcTime: 5000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    enabled: options?.enabled ?? true, // Allow conditional fetching
  });
};

// Hook to get available ranks from API (for compatibility with existing code)
export const useAvailableRanks = () => {
  // Reuse the same query as useRankMasterData for maximum efficiency
  return useRankMasterData();
};

// Mutation hooks for rank management
export const useCreateRank = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: InsertAvailableRank) => {
      return await apiRequest("POST", "/api/available-ranks", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/available-ranks"] });
    },
  });
};

export const useUpdateRank = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertAvailableRank> }) => {
      return await apiRequest("PUT", `/api/available-ranks/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/available-ranks"] });
    },
  });
};

export const useDeleteRank = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/available-ranks/${id}`);
    },
    onSuccess: () => {
      // Refresh cache after successful deletion
      queryClient.invalidateQueries({ queryKey: ["/api/available-ranks"] });
    },
    onError: (error: any) => {
      // Force cache refresh on error to ensure data consistency
      queryClient.invalidateQueries({ queryKey: ["/api/available-ranks"] });
      
      // Only show error to user if it's a genuine failure (not a 404 after successful deletion)
      if (error?.status === 404 || error?.message?.includes('404') || error?.message?.includes('not found')) {
        console.warn('Rank deletion: Received 404 during operation, but this may be expected after successful deletion');
        // Don't throw an error for 404s - they might be normal after successful deletion
        return;
      }
      throw error;
    },
  });
};

export const useClearAllRanks = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", "/api/available-ranks");
    },
    onSuccess: () => {
      // Force refresh of all rank-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/available-ranks"] });
      // Clear cache completely to ensure fresh start
      queryClient.resetQueries({ queryKey: ["/api/available-ranks"] });
    },
    onError: (error: any) => {
      // Still refresh cache on error
      queryClient.invalidateQueries({ queryKey: ["/api/available-ranks"] });
      throw error;
    },
  });
};

// Company Ranks Mutations
export const useSaveCompanyRanks = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (ranks: any[]) => {
      return await apiRequest("POST", "/api/company-ranks", ranks);
    },
    onSuccess: () => {
      // Refresh company ranks cache after successful save
      queryClient.invalidateQueries({ queryKey: ["/api/company-ranks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/available-ranks"] });
    },
    onError: (error: any) => {
      throw error;
    },
  });
};

// Vessel Draft mutation hooks
export const useCreateVesselDraft = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: InsertVesselDraft) => {
      return await apiRequest("POST", "/api/vessel-drafts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vessel-drafts"] });
    },
  });
};

export const useUpdateVesselDraft = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertVesselDraft> }) => {
      return await apiRequest("PATCH", `/api/vessel-drafts/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vessel-drafts"] });
    },
  });
};

export const useVesselDraftsByVessel = (vesselId: string) => {
  return useQuery<VesselDraft[]>({
    queryKey: ["/api/vessel-drafts", "by-vessel", vesselId],
    queryFn: async () => {
      const response = await fetch(`/api/vessel-drafts/by-vessel/${vesselId}`);
      if (!response.ok) throw new Error("Failed to fetch vessel drafts");
      return response.json();
    },
    enabled: !!vesselId
  });
};