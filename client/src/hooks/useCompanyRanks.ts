import { useQuery } from "@tanstack/react-query";
import { AvailableRank } from "@shared/schema";

// Interface for Rank Master data that mirrors AdminModule structure
export interface RankMasterData {
  id: string;
  rank: string;
  rankId: string;
  applicableToCompany: boolean;
  label: string;
}

// Default rank master data (same as AdminModule)
const DEFAULT_RANK_MASTER_DATA: RankMasterData[] = [
  { id: "1", rank: "Master", rankId: "S1", applicableToCompany: true, label: "Master" },
  { id: "2", rank: "Chief Officer", rankId: "S2", applicableToCompany: true, label: "Chief Off" },
  { id: "3", rank: "Second Officer", rankId: "S3", applicableToCompany: true, label: "2nd Off" },
  { id: "4", rank: "Third Officer", rankId: "S4", applicableToCompany: true, label: "3rd Off" },
  { id: "5", rank: "Fourth Officer", rankId: "S5", applicableToCompany: false, label: "" },
  { id: "6", rank: "Deck Cadet", rankId: "S6", applicableToCompany: true, label: "Deck Cadet" },
  { id: "7", rank: "Chief Engineer", rankId: "S7", applicableToCompany: true, label: "Ch Eng" },
];

// Hook to get all rank master data
export const useRankMasterData = () => {
  return {
    data: DEFAULT_RANK_MASTER_DATA,
    isLoading: false,
    error: null,
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