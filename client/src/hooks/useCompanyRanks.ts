import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AvailableRank, InsertAvailableRank } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

// Interface for Rank Master data that mirrors AdminModule structure
export interface RankMasterData {
  id: string;
  rank: string;
  rankId: string;
  applicableToCompany: boolean;
  label: string;
}

// Function to map AvailableRank from database to RankMasterData format
const mapAvailableRankToRankMasterData = (availableRank: AvailableRank): RankMasterData => {
  // Generate a simple rankId from the name (e.g., "Master" -> "S1", "Chief Officer" -> "S2")
  const getRankId = (name: string, id: number): string => {
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

  // Generate a label from the name (shortened version)
  const getLabel = (name: string): string => {
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

  // Since the database doesn't have applicableToCompany field, 
  // consider all ranks applicable to company by default
  // Senior Officers and Junior Officers are typically applicable to company
  const applicableToCompany = ['Senior Officers', 'Junior Officers'].includes(availableRank.category);

  return {
    id: availableRank.id.toString(),
    rank: availableRank.name,
    rankId: getRankId(availableRank.name, availableRank.id),
    applicableToCompany,
    label: getLabel(availableRank.name),
  };
};

// Hook to get all rank master data from database
export const useRankMasterData = () => {
  const query = useQuery<AvailableRank[]>({
    queryKey: ["/api/available-ranks"],
    queryFn: async () => {
      const response = await fetch("/api/available-ranks");
      if (!response.ok) {
        throw new Error("Failed to fetch available ranks");
      }
      return response.json();
    },
  });

  const mappedData = query.data?.map(mapAvailableRankToRankMasterData) || [];

  return {
    data: mappedData,
    isLoading: query.isLoading,
    error: query.error,
  };
};

// Hook to get company-applicable ranks (filtered from rank master data)
export const useCompanyRanks = () => {
  const { data: rankMasterData, isLoading, error } = useRankMasterData();
  
  const companyRanks = rankMasterData?.filter(rank => rank.applicableToCompany) || [];
  
  return {
    data: companyRanks,
    isLoading,
    error,
    // Convenience method to get just the rank names for dropdowns
    rankNames: companyRanks.map(rank => rank.rank),
  };
};

// Hook to get available ranks from API (for compatibility with existing code)
export const useAvailableRanks = () => {
  return useQuery<AvailableRank[]>({
    queryKey: ["/api/available-ranks"],
    queryFn: async () => {
      const response = await fetch("/api/available-ranks");
      if (!response.ok) {
        throw new Error("Failed to fetch available ranks");
      }
      return response.json();
    },
  });
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
      queryClient.invalidateQueries({ queryKey: ["/api/available-ranks"] });
    },
    onError: (error: any) => {
      // Force cache refresh on error to ensure data consistency
      queryClient.invalidateQueries({ queryKey: ["/api/available-ranks"] });
      
      // Enhance error message for 404s
      if (error?.status === 404 || error?.message?.includes('404') || error?.message?.includes('not found')) {
        throw new Error('Rank not found - this rank may have been deleted or may not exist in the database.');
      }
      throw error;
    },
  });
};