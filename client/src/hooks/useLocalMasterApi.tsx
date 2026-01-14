import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/config/api";

const MASTER_TYPES = [
  'nationalities',
  'vessels',
  'vesselTypes',
  'additionalGroups',
  'ports',
  'fleetGroups',
  'languages',
  'countries',
  'users',
] as const;

type MasterType = typeof MASTER_TYPES[number];

interface LocalMasterDataResponse {
  type: string;
  count: number;
  data: any[];
  cached: boolean;
  timestamp: string;
}

interface SyncAllResponse {
  results: Record<string, { synced: number; error?: string }>;
  totalSynced: number;
  source: string;
  timestamp: string;
}

export function useLocalMasterData(type: MasterType) {
  return useQuery<LocalMasterDataResponse>({
    queryKey: ['/api/master-data/external', type],
    queryFn: async () => {
      const response = await fetch(`/api/master-data/external/${type}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${type} from local cache`);
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useSyncAllMasterData() {
  const queryClient = useQueryClient();

  return useMutation<SyncAllResponse, Error>({
    mutationFn: async () => {
      const domain = localStorage.getItem('domain') || 'rsms';
      const DEFAULT_API_BASE_URL = `${API_BASE_URL}/crewmasterdata/getallmasterdata`;
      const apiBaseUrl = DEFAULT_API_BASE_URL;
      
      const response = await fetch('/api/master-data/external/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiBaseUrl, domain }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to sync master data');
      }
      return response.json();
    },
    onSuccess: () => {
      MASTER_TYPES.forEach((type) => {
        queryClient.invalidateQueries({ queryKey: ['/api/master-data/external', type] });
      });
    },
  });
}

export function useAllLocalMasterData() {
  const nationalities = useLocalMasterData('nationalities');
  const vessels = useLocalMasterData('vessels');
  const vesselTypes = useLocalMasterData('vesselTypes');
  const additionalGroups = useLocalMasterData('additionalGroups');
  const ports = useLocalMasterData('ports');
  const fleetGroups = useLocalMasterData('fleetGroups');
  const languages = useLocalMasterData('languages');
  const countries = useLocalMasterData('countries');
  const users = useLocalMasterData('users');

  return {
    nationalities,
    vessels,
    vesselTypes,
    additionalGroups,
    ports,
    fleetGroups,
    languages,
    countries,
    users,
    isLoading: nationalities.isLoading || vessels.isLoading || vesselTypes.isLoading ||
      additionalGroups.isLoading || ports.isLoading || fleetGroups.isLoading ||
      languages.isLoading || countries.isLoading || users.isLoading,
  };
}
