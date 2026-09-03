import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const V2_BASE = '/api/v2/masters';

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
    queryKey: [`${V2_BASE}/external`, type],
    queryFn: async () => {
      const response = await fetch(`${V2_BASE}/external/${type}`);
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
      const response = await fetch(`${V2_BASE}/external/sync-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to sync master data');
      }
      return response.json();
    },
    onSuccess: () => {
      MASTER_TYPES.forEach((type) => {
        queryClient.invalidateQueries({ queryKey: [`${V2_BASE}/external`, type] });
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
